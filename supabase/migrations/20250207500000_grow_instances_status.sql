-- Active Garden: batch lifecycle (growing → harvested).
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'growing';

ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_status_check;
ALTER TABLE grow_instances ADD CONSTRAINT grow_instances_status_check
  CHECK (status IN ('growing', 'harvested'));

COMMENT ON COLUMN grow_instances.status IS 'growing = in ground; harvested = harvest logged for this batch.';
