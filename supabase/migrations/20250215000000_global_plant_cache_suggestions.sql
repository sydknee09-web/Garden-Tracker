-- RPCs for plant/variety suggestions from global_plant_cache (excludes bad rows).
-- Indexes for fast aggregation on extract_data type/variety.

-- Index for distinct plant type queries
CREATE INDEX IF NOT EXISTS idx_gpc_extract_type ON public.global_plant_cache ((TRIM(extract_data->>'type')));

-- Index for variety lookup by plant type
CREATE INDEX IF NOT EXISTS idx_gpc_extract_type_variety ON public.global_plant_cache (
  (LOWER(TRIM(extract_data->>'type'))),
  (TRIM(extract_data->>'variety'))
);

-- Distinct plant types for combobox suggestions (excludes bad rows)
CREATE OR REPLACE FUNCTION public.get_global_plant_cache_plant_types()
RETURNS TABLE(plant_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT TRIM(gpc.extract_data->>'type') AS plant_type
  FROM public.global_plant_cache gpc
  WHERE gpc.id NOT IN (SELECT id FROM public.get_global_plant_cache_bad_row_ids())
    AND gpc.extract_data->>'type' IS NOT NULL
    AND TRIM(gpc.extract_data->>'type') != ''
  ORDER BY plant_type;
$$;

COMMENT ON FUNCTION public.get_global_plant_cache_plant_types() IS
  'Distinct plant types from global cache for import combobox suggestions. Excludes bad rows.';

-- Distinct varieties for a given plant type (excludes bad rows)
CREATE OR REPLACE FUNCTION public.get_global_plant_cache_varieties(p_plant_type text)
RETURNS TABLE(variety text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT TRIM(gpc.extract_data->>'variety') AS variety
  FROM public.global_plant_cache gpc
  WHERE COALESCE(TRIM(p_plant_type), '') != ''
    AND gpc.id NOT IN (SELECT id FROM public.get_global_plant_cache_bad_row_ids())
    AND LOWER(TRIM(COALESCE(gpc.extract_data->>'type', ''))) = LOWER(TRIM(p_plant_type))
    AND gpc.extract_data->>'variety' IS NOT NULL
    AND TRIM(gpc.extract_data->>'variety') != ''
  ORDER BY variety;
$$;

COMMENT ON FUNCTION public.get_global_plant_cache_varieties(text) IS
  'Distinct varieties for a plant type from global cache. Excludes bad rows. Used when plant is selected in import combobox.';
