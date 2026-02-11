-- Structured fields for scraped growing info (shown in Growing requirements table)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS days_to_germination text,
  ADD COLUMN IF NOT EXISTS plant_spacing text;
