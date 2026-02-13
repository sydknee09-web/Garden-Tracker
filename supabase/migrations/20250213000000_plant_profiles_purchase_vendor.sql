-- Store-bought plants (no packet): record where they bought it (e.g. "Armstrong", "Home Depot").
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS purchase_vendor text;

COMMENT ON COLUMN plant_profiles.purchase_vendor IS
  'Optional: vendor/store where plant was purchased (e.g. store-bought plant without a seed packet).';
