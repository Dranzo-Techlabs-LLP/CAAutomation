-- Migration: add tasks.review_comments + tasks.sort_order columns + new scoped permissions
-- Idempotent: safe to run multiple times.

-- 0. Add tasks.sort_order column (used to order subtasks under their parent)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'sort_order'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
  'SELECT "tasks.sort_order already present" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1. Add review_comments column to tasks (no-op if already present)
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'review_comments'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN review_comments TEXT NULL AFTER resolution',
  'SELECT "tasks.review_comments already present" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Insert missing permissions referenced by controllers but never seeded.
--    customer.edit + customer.delete were referenced in CustomersController but
--    not present in the permissions table, so every customer update returned 403.
INSERT IGNORE INTO permissions (id, code, description, module, created_at, updated_at)
VALUES
  (UUID(), 'customer.edit',     'Edit existing customers',                                     'customers', NOW(6), NOW(6)),
  (UUID(), 'customer.delete',   'Delete customers',                                            'customers', NOW(6), NOW(6)),
  (UUID(), 'task.view_all',     'View all firm tasks (otherwise scoped to own assignments)',   'tasks',     NOW(6), NOW(6)),
  (UUID(), 'calendar.view_all', 'View firm-wide compliance calendar (otherwise own only)',     'dashboard', NOW(6), NOW(6)),
  (UUID(), 'report.view_all',   'View firm-wide analytics & revenue (otherwise own only)',     'reports',   NOW(6), NOW(6));

-- 3a. Grant scoped-view permissions to admin/manager/partner roles.
INSERT IGNORE INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT r.id, p.id, NOW(6), NOW(6)
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('task.view_all', 'calendar.view_all', 'report.view_all')
  AND (r.name LIKE '%dmin%' OR r.name LIKE '%anager%' OR r.name LIKE '%artner%' OR r.is_system_role = 1);

-- 3b. Grant customer.edit + customer.delete to Admin / Partner / Manager (and
--     any existing role that already has customer.create — that role clearly
--     needed full customer rights but never got them seeded).
INSERT IGNORE INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT DISTINCT r.id, p.id, NOW(6), NOW(6)
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('customer.edit', 'customer.delete')
  AND (
    r.name LIKE '%dmin%' OR r.name LIKE '%anager%' OR r.name LIKE '%artner%'
    OR r.id IN (
      SELECT rp.role_id FROM role_permissions rp
      JOIN permissions pp ON pp.id = rp.permission_id
      WHERE pp.code = 'customer.create'
    )
  );

SELECT
  (SELECT COUNT(*) FROM permissions WHERE code IN ('task.view_all','calendar.view_all','report.view_all')) AS new_perms,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'review_comments') AS review_col_exists;
