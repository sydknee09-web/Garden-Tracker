-- Global plant extract cache: shared, pre-populated database of plant extraction results.
-- Populated by bulk vendor scraping scripts; read-only for authenticated users.
-- Lookup chain: Tier 0 (global_plant_cache by source_url) -> Tier 1 (user cache) -> Tier 2 (user identity+vendor) -> live scrape.
CREATE TABLE IF NOT EXISTS public.global_plant_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL UNIQUE,
  identity_key text NOT NULL,
  vendor text,
  extract_data jsonb NOT NULL,
  hero_storage_path text,
  original_hero_url text,
  scraped_fields text[],
  scrape_quality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tier 0 lookup: exact URL match (one cached result per URL globally)
CREATE INDEX idx_gpc_source_url ON public.global_plant_cache(source_url);

-- Tier 2-style lookup: same plant from same vendor
CREATE INDEX idx_gpc_identity_vendor ON public.global_plant_cache(identity_key, vendor);

-- Vendor-level queries (stats, cleanup)
CREATE INDEX idx_gpc_vendor ON public.global_plant_cache(vendor);

-- Quality-based queries (cleanup script targets partial rows)
CREATE INDEX idx_gpc_quality ON public.global_plant_cache(scrape_quality);

ALTER TABLE public.global_plant_cache ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read; only service role can write (bypasses RLS)
CREATE POLICY "Authenticated users can read global cache"
  ON public.global_plant_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');
