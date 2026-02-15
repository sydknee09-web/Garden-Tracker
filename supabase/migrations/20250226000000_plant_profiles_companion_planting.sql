-- Companion planting: optional "plant with" and "do not plant with" per profile.
-- Stored at plant level (species); nullable so existing and new profiles can leave blank.
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS companion_plants text[],
  ADD COLUMN IF NOT EXISTS avoid_plants text[];

COMMENT ON COLUMN plant_profiles.companion_plants IS 'Companion plants (plant with); common names.';
COMMENT ON COLUMN plant_profiles.avoid_plants IS 'Plants to avoid planting nearby.';
