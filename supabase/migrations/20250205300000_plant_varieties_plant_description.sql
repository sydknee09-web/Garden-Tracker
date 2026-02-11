-- Marketing/variety summary from product page (scraped; shown as "Plant Description")
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS plant_description text;
