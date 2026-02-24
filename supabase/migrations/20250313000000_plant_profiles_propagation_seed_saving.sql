-- Add propagation and seed-saving info to plant profiles.
-- Used for perennials (cuttings, division) and seed varieties (how to harvest/save seeds).

ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS propagation_notes text,
  ADD COLUMN IF NOT EXISTS seed_saving_notes text;

COMMENT ON COLUMN plant_profiles.propagation_notes IS 'How to propagate this plant (cuttings, division, layering, etc.). For perennials and plants that can be multiplied.';
COMMENT ON COLUMN plant_profiles.seed_saving_notes IS 'How to harvest and save seeds from this plant. For seed-grown varieties.';
