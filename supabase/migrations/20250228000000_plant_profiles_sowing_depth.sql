-- Top-level sowing_depth on plant_profiles for backfill, fill-in-blanks, and vault UI.
-- Previously sowing_depth lived only in botanical_care_notes JSONB; code now expects a column.
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS sowing_depth text;

COMMENT ON COLUMN plant_profiles.sowing_depth IS 'Seed sowing depth (e.g. "1/4 inch"). From vendor scrape, AI research, or cache.';
