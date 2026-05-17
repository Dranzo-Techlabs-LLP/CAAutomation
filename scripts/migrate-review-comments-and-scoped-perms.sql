-- Migration: add tasks.review_comments column + new scoped permissions
-- Idempotent: safe to run multiple times.

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

-- 2. Insert new scoped permissions (admin/manager grant these; others get filtered views)
INSERT IGNORE INTO permissions (id, code, description, module, created_at, updated_at)
VALUES
  (UUID(), 'task.view_all',     'View all firm tasks (otherwise scoped to own assignments)', 'tasks',     NOW(6), NOW(6)),
  (UUID(), 'calendar.view_all', 'View firm-wide compliance calendar (otherwise own only)',    'dashboard', NOW(6), NOW(6)),
  (UUID(), 'report.view_all',   'View firm-wide analytics & revenue (otherwise own only)',    'reports',   NOW(6), NOW(6));

-- 3. Grant the new permissions to every existing Administrator-style role
--    (any role whose name contains 'admin' or 'manager', case-insensitive).
INSERT IGNORE INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT r.id, p.id, NOW(6), NOW(6)
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('task.view_all', 'calendar.view_all', 'report.view_all')
  AND (r.name LIKE '%dmin%' OR r.name LIKE '%anager%' OR r.is_system_role = 1);

SELECT
  (SELECT COUNT(*) FROM permissions WHERE code IN ('task.view_all','calendar.view_all','report.view_all')) AS new_perms,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'review_comments') AS review_col_exists;
