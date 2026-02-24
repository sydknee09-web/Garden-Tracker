-- Migrate permanent plant profiles with no grow_instances into plantings
-- Each profile gets one grow_instance so they appear in My Plants after the refactor.
-- sown_date uses purchase_date or created_at as best guess.

INSERT INTO grow_instances (plant_profile_id, user_id, sown_date, status)
SELECT
  pp.id,
  pp.user_id,
  COALESCE(pp.purchase_date, pp.created_at::date) AS sown_date,
  'growing' AS status
FROM plant_profiles pp
WHERE pp.profile_type = 'permanent'
  AND pp.deleted_at IS NULL
  AND pp.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM grow_instances gi
    WHERE gi.plant_profile_id = pp.id AND gi.deleted_at IS NULL
  );
