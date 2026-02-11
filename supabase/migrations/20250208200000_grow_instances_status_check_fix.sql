-- Fix: ensure status check allows lowercase (app sends growing, not Growing).
-- Normalize existing rows then recreate constraint.
UPDATE grow_instances
SET status = lower(status)
WHERE status IS NOT NULL AND status != lower(status);

UPDATE grow_instances
SET status = 'growing'
WHERE status IS NULL OR status NOT IN ('pending', 'growing', 'harvested', 'archived');

ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_status_check;
ALTER TABLE grow_instances ADD CONSTRAINT grow_instances_status_check
  CHECK (status IN ('pending', 'growing', 'harvested', 'archived'));

COMMENT ON COLUMN grow_instances.status IS 'pending = scheduled; growing = in ground; harvested = harvest logged; archived = ended crop.';
