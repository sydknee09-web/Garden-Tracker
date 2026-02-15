-- Plant profile description and growing notes for informative grow view.
-- Vendor or AI-sourced; never overwrite existing good data (fill blanks only).
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS plant_description text,
  ADD COLUMN IF NOT EXISTS growing_notes text;

COMMENT ON COLUMN plant_profiles.plant_description IS 'Short description of the plant/variety (from vendor scrape or AI). Used in About tab.';
COMMENT ON COLUMN plant_profiles.growing_notes IS 'Detailed growing/seed-starting notes (scraped or AI). Shown with description for full grow context.';

-- Optional: track source so UI can show "From vendor" vs "From AI research"
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS description_source text;

COMMENT ON COLUMN plant_profiles.description_source IS 'Source of plant_description/growing_notes: vendor, ai, or user. Enables "From vendor" vs "From AI" in UI.';
