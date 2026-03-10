-- Add size and size_uom to supply_profiles for product sizing (e.g. "1 gal", "gal").
ALTER TABLE supply_profiles ADD COLUMN IF NOT EXISTS size text;
ALTER TABLE supply_profiles ADD COLUMN IF NOT EXISTS size_uom text;
