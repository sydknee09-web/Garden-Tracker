-- Verification: Ensure permanent plants are linked to plant profiles
-- Run in Supabase Dashboard → SQL Editor

-- 1. Permanent plant profiles (these ARE the plant profiles)
SELECT
  'Permanent plant profiles' AS check_type,
  count(*) AS count
FROM plant_profiles
WHERE profile_type = 'permanent'
  AND deleted_at IS NULL;

-- 2. Grow instances linked to permanent profiles (plantings of permanent plants)
SELECT
  'Grow instances linked to permanent profiles' AS check_type,
  count(*) AS count
FROM grow_instances gi
JOIN plant_profiles pp ON pp.id = gi.plant_profile_id AND pp.deleted_at IS NULL
WHERE pp.profile_type = 'permanent'
  AND gi.deleted_at IS NULL;

-- 3. Orphaned grow_instances (no plant_profile_id - would be a problem)
SELECT
  'Orphaned grow_instances (null plant_profile_id)' AS check_type,
  count(*) AS count
FROM grow_instances
WHERE plant_profile_id IS NULL
  AND deleted_at IS NULL;

-- 4. Grow instances pointing to non-existent profiles (should be 0 due to FK)
SELECT
  'Broken links (grow → missing profile)' AS check_type,
  count(*) AS count
FROM grow_instances gi
LEFT JOIN plant_profiles pp ON pp.id = gi.plant_profile_id
WHERE gi.plant_profile_id IS NOT NULL
  AND gi.deleted_at IS NULL
  AND pp.id IS NULL;

-- 5. Summary: permanent profiles with their grow instance counts
SELECT
  pp.id,
  pp.name,
  pp.variety_name,
  pp.user_id,
  (SELECT count(*) FROM grow_instances WHERE plant_profile_id = pp.id AND deleted_at IS NULL) AS planting_count
FROM plant_profiles pp
WHERE pp.profile_type = 'permanent'
  AND pp.deleted_at IS NULL
ORDER BY pp.name;
