-- Native plant / pre-treatment notes (e.g. smoke, stratification, boiling water) from vendors like Theodore Payne, Native West
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS pretreatment_notes text;
