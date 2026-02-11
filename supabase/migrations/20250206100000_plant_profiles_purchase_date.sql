-- Profile-level purchase date (when user acquired this plant); fallback to created_at for display.
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS purchase_date date;
