-- Add is_permanent_planting to grow_instances so "Add permanent plant" flow
-- puts plants in My Plants regardless of profile_type. Profile can have seed packets;
-- we don't touch them. The planting lives in My Plants.
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS is_permanent_planting boolean DEFAULT false;

COMMENT ON COLUMN grow_instances.is_permanent_planting IS
  'True = show in My Plants tab. False/null = show in Active Garden. Set when adding from Add permanent plant flow.';

-- Backfill: existing grow_instances linked to permanent profiles
UPDATE grow_instances gi
SET is_permanent_planting = true
FROM plant_profiles pp
WHERE gi.plant_profile_id = pp.id
  AND pp.profile_type = 'permanent'
  AND pp.deleted_at IS NULL
  AND gi.deleted_at IS NULL;
