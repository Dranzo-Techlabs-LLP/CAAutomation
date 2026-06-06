-- Migration: invoice collections follow-up columns
-- Idempotent: safe to run multiple times.

SET @c1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'follow_up_date');
SET @s1 := IF(@c1 = 0,
  'ALTER TABLE invoices ADD COLUMN follow_up_date DATE NULL',
  'SELECT "invoices.follow_up_date present" AS info');
PREPARE st FROM @s1; EXECUTE st; DEALLOCATE PREPARE st;

SET @c2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'follow_up_note');
SET @s2 := IF(@c2 = 0,
  'ALTER TABLE invoices ADD COLUMN follow_up_note VARCHAR(500) NULL',
  'SELECT "invoices.follow_up_note present" AS info');
PREPARE st FROM @s2; EXECUTE st; DEALLOCATE PREPARE st;

SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME IN ('follow_up_date','follow_up_note')) AS followup_cols;
