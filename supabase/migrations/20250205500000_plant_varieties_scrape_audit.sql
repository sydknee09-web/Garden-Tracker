-- Scraper audit: status and error log for "Load Seed Details" (Success / Partial / Failed)
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS scrape_status text,
  ADD COLUMN IF NOT EXISTS scrape_error_log text;
