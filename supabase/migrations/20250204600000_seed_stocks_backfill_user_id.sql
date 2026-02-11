-- Backfill seed_stocks.user_id from linked plant_varieties (fixes NULL user_id on existing rows)
-- Run this in Supabase SQL Editor if you have existing seed_stocks rows with user_id NULL.

UPDATE seed_stocks s
SET user_id = p.user_id
FROM plant_varieties p
WHERE s.plant_variety_id = p.id
  AND s.user_id IS NULL;
