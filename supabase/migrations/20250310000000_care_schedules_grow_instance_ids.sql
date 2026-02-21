-- Add grow_instance_ids to care_schedules for permanent plant multi-assignment
-- Null = all plants; [id1, id2] = specific plants. Overrides grow_instance_id when set.

ALTER TABLE care_schedules
  ADD COLUMN IF NOT EXISTS grow_instance_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN care_schedules.grow_instance_ids IS
  'For permanent plants: apply to these instances. Null = all. Overrides grow_instance_id when set.';
