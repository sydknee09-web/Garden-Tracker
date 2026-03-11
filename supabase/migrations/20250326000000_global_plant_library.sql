-- Botanical brain: shared library keyed by identity for pre-fill before AI and Magic Fill upsert.
-- No user_id; read by authenticated, write via service role / API only.
CREATE TABLE IF NOT EXISTS public.global_plant_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_key text NOT NULL UNIQUE,
  mature_height text,
  mature_width text,
  sun text,
  water text,
  spacing text,
  germination_days text,
  harvest_days integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_plant_library_identity_key
  ON public.global_plant_library (identity_key);

ALTER TABLE public.global_plant_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read global plant library"
  ON public.global_plant_library
  FOR SELECT
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.global_plant_library IS 'Shared botanical data keyed by identity_key (from identityKeyFromVariety). Queried before AI in enrich-from-name; upserted after successful Magic Fill.';
