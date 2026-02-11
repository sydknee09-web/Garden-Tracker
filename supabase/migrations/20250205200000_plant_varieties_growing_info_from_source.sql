-- Scraped growing info from "Add from link" — shown in grey Growing requirements box (read-only).
-- User-editable notes stay in growing_notes only.
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS growing_info_from_source text;
