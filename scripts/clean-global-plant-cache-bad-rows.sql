-- Identify and optionally remove bad rows from global_plant_cache so link import
-- and cache stay aligned.
--
-- EASIEST: Use the script (after applying migration 20250214000000_global_plant_cache_bad_rows_rpc.sql):
--   npm run clean-bad-cache              (dry run: list + save to data/bad-cache-rows-to-delete.json)
--   npm run clean-bad-cache -- --confirm  (delete from Supabase + update progress so bulk-scrape re-scrapes)
--
-- Or run the SQL below manually in Supabase SQL Editor.
--
-- Bad row criteria (vendor parsing issues we fixed in scrape-url + bulk-scrape):
--   1. Type is a product code: "Prod600097", "2326ng" (Burpee, Johnny's)
--   2. Variety collapsed to "Hot" or "Sweet" (Eden Brothers peppers)
--   3. Type = "General" with empty variety (unusable identity)
--
-- After deleting, run bulk-scrape to re-fill (script updates progress automatically):
--   npm run bulk-scrape

-- Step 1: Count bad rows (run this first to see impact)
SELECT
  'product_code_type' AS reason,
  COUNT(*) AS cnt
FROM public.global_plant_cache
WHERE (extract_data->>'type') ~ '^prod\d+$'  -- Burpee
   OR (extract_data->>'type') ~ '^\d+[a-z]*$' -- Johnny's
UNION ALL
SELECT
  'variety_hot_sweet_pepper',
  COUNT(*)
FROM public.global_plant_cache
WHERE LOWER(TRIM(extract_data->>'variety')) IN ('hot', 'sweet')
  AND (vendor ILIKE '%edenbrothers%' OR identity_key = 'pepper_hot')
UNION ALL
SELECT
  'general_empty_variety',
  COUNT(*)
FROM public.global_plant_cache
WHERE LOWER(TRIM(COALESCE(extract_data->>'type', ''))) = 'general'
  AND TRIM(COALESCE(extract_data->>'variety', '')) = '';

-- Step 2: List source_url of bad rows (optional; use to re-scrape later)
-- SELECT source_url, vendor, extract_data->>'type' AS type, extract_data->>'variety' AS variety
-- FROM public.global_plant_cache
-- WHERE (extract_data->>'type') ~ '^prod\d+$'
--    OR (extract_data->>'type') ~ '^\d+[a-z]*$'
--    OR (LOWER(TRIM(extract_data->>'variety')) IN ('hot', 'sweet') AND (vendor ILIKE '%edenbrothers%' OR identity_key = 'pepper_hot'))
--    OR (LOWER(TRIM(COALESCE(extract_data->>'type', ''))) = 'general' AND TRIM(COALESCE(extract_data->>'variety', '')) = '');

-- Step 3: Delete bad rows (uncomment and run after reviewing counts)
-- DELETE FROM public.global_plant_cache
-- WHERE (extract_data->>'type') ~ '^prod\d+$'
--    OR (extract_data->>'type') ~ '^\d+[a-z]*$'
--    OR (LOWER(TRIM(extract_data->>'variety')) IN ('hot', 'sweet') AND (vendor ILIKE '%edenbrothers%' OR identity_key = 'pepper_hot'))
--    OR (LOWER(TRIM(COALESCE(extract_data->>'type', ''))) = 'general' AND TRIM(COALESCE(extract_data->>'variety', '')) = '');
