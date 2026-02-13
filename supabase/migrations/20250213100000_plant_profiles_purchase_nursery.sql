-- Store-bought: nursery/store name (e.g. "Armstrong Garden Center").
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS purchase_nursery text;

COMMENT ON COLUMN plant_profiles.purchase_nursery IS
  'Optional: nursery or store where plant was purchased (store-bought flow).';
