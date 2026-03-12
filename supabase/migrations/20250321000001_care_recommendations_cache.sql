-- care_recommendations_cache: shared cache for AI care suggestions by plant identity.
-- Reduces Gemini API calls when multiple users request suggestions for the same plant.
-- Writes via service role only; authenticated users can read.

CREATE TABLE IF NOT EXISTS public.care_recommendations_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identity_key text NOT NULL,
  profile_type text NOT NULL DEFAULT 'seed'
    CHECK (profile_type IN ('seed', 'permanent')),
  tasks jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identity_key, profile_type)
);

CREATE INDEX IF NOT EXISTS idx_crc_identity_profile ON public.care_recommendations_cache(identity_key, profile_type);

ALTER TABLE public.care_recommendations_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read care_recommendations_cache"
  ON public.care_recommendations_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.care_recommendations_cache IS
  'Shared cache for AI care suggestions. Keyed by identity_key + profile_type. TTL 180 days. Writes via service role.';
