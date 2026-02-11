-- Persistent plant extract cache: stores full extraction results + hero images so re-imports are instant.
-- Tier 1 lookup by source_url (exact URL match skips AI extraction).
-- Tier 2 lookup by identity_key + vendor (hero photo cache for same plant from same vendor).
CREATE TABLE IF NOT EXISTS public.plant_extract_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  identity_key text NOT NULL,
  vendor text,
  extract_data jsonb NOT NULL,
  hero_storage_path text,
  original_hero_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tier 1 lookup: exact URL match (one cached result per URL per user)
CREATE UNIQUE INDEX idx_pec_user_url ON public.plant_extract_cache(user_id, source_url);

-- Tier 2 lookup: same plant from same vendor
CREATE INDEX idx_pec_user_identity_vendor ON public.plant_extract_cache(user_id, identity_key, vendor);

ALTER TABLE public.plant_extract_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plant_extract_cache"
  ON public.plant_extract_cache
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
