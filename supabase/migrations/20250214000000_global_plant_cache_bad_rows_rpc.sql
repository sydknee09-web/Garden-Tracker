-- RPC for clean-bad-cache script: return (id, source_url) for rows that match
-- the same "bad row" criteria (product code type, pepper hot/sweet, general+empty variety).
CREATE OR REPLACE FUNCTION public.get_global_plant_cache_bad_row_ids()
RETURNS TABLE(id uuid, source_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gpc.id, gpc.source_url
  FROM public.global_plant_cache gpc
  WHERE (gpc.extract_data->>'type') ~ '^prod\d+$'
     OR (gpc.extract_data->>'type') ~ '^\d+[a-z]*$'
     OR (
       LOWER(TRIM(gpc.extract_data->>'variety')) IN ('hot', 'sweet')
       AND (gpc.vendor ILIKE '%edenbrothers%' OR gpc.identity_key = 'pepper_hot')
     )
     OR (
       LOWER(TRIM(COALESCE(gpc.extract_data->>'type', ''))) = 'general'
       AND TRIM(COALESCE(gpc.extract_data->>'variety', '')) = ''
     )
     OR (
       LOWER(TRIM(COALESCE(gpc.extract_data->>'type', ''))) = 'general'
       AND gpc.vendor ILIKE '%swallowtail%'
     )
     OR gpc.identity_key ILIKE '%pelleted%'
     OR gpc.identity_key ILIKE '%floret_%'
     OR gpc.identity_key ILIKE '%general_%'
     OR gpc.identity_key ILIKE 'flower_%'
     OR gpc.identity_key ILIKE '%days_%'
     OR gpc.identity_key ILIKE '%from_%'
     OR gpc.identity_key ILIKE '%mix_%';
$$;

COMMENT ON FUNCTION public.get_global_plant_cache_bad_row_ids() IS
  'Used by scripts/clean-bad-cache.ts to find cache rows to delete and re-scrape (product codes, pepper hot/sweet, general+empty, bad identity_key: pelleted, floret_, general_, flower_, days_, from_, mix_).';
