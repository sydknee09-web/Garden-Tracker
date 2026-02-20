-- ============================================================================
-- care_schedules: add end_date (for recurring task expiry) and deleted_at
-- (soft delete, consistent with other tables)
-- ============================================================================

ALTER TABLE care_schedules
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN care_schedules.end_date IS
  'Optional end date for recurring schedules. After this date no new tasks are generated.';

COMMENT ON COLUMN care_schedules.deleted_at IS
  'Soft delete timestamp. NULL = active record.';

CREATE INDEX IF NOT EXISTS idx_care_schedules_active
  ON care_schedules (user_id, is_active, next_due_date)
  WHERE deleted_at IS NULL;
