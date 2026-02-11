-- Store original seed vendor link for reference
ALTER TABLE plant_varieties ADD COLUMN IF NOT EXISTS source_url text;
