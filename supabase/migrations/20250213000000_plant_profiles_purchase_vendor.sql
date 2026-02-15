-- Store-bought: vendor/seller name (e.g. seed company or nursery).
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS purchase_vendor text;

COMMENT ON COLUMN plant_profiles.purchase_vendor IS
  'Optional: vendor or seller where plant/seeds were purchased (store-bought flow).';
