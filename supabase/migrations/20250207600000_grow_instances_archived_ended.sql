-- Active Garden: End Crop moves batch to archived (status + ended_at).
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_status_check;
ALTER TABLE grow_instances ADD CONSTRAINT grow_instances_status_check
  CHECK (status IN ('growing', 'harvested', 'archived'));

COMMENT ON COLUMN grow_instances.ended_at IS 'Set when status is changed to archived (End Crop).';
COMMENT ON COLUMN grow_instances.status IS 'growing = in ground; harvested = legacy; archived = ended crop, shown in Settings > Archived Plantings.';
