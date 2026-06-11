-- AI Fill overhaul Ship 2 (2026-06-11): provenance tagging + When-to-Plant structured fields.
-- Additive + idempotent throughout; safe to rerun.
--
-- plant_profiles:
--   field_provenance               JSONB map { column_name: 'variety'|'cultivar'|'species' } for
--                                  AI-written fields. Absence of an entry = user-entered / legacy.
--   when_to_plant_description      Rich plain-language narrative ("Cannas are a spring/summer plant…").
--   planting_seasons_tags          TEXT[] from {Spring, Summer, Fall, Winter}.
--   optimal_planting_months_array  INT[] of months 1-12 (zone-biased when the AI ran with a zone).
--   indoor_start_weeks_before_frost  Weeks before last frost to start indoors (NULL = not applicable).
--   outdoor_plant_weeks_after_frost  Weeks after last frost to plant outside (0 = at last frost).
--
-- global_plant_library: same when-to-plant fields for caching, plus
--   found_level  'variety'|'cultivar'|'species' — the tier the row's data was found at, so cache
--                hits carry honest provenance. Legacy rows (NULL) date from the exact-match-only era:
--                variety-keyed rows read as 'variety', species-keyed rows as 'species'.

ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS field_provenance JSONB;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS when_to_plant_description TEXT;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS planting_seasons_tags TEXT[];
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS optimal_planting_months_array INT[];
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS indoor_start_weeks_before_frost INT;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS outdoor_plant_weeks_after_frost INT;

ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS when_to_plant_description TEXT;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS planting_seasons_tags TEXT[];
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS optimal_planting_months_array INT[];
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS indoor_start_weeks_before_frost INT;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS outdoor_plant_weeks_after_frost INT;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS found_level TEXT;
