-- Hero Vault: store resolved hero image URL when a pass succeeds so Phase 0 can return it by identity_key.
ALTER TABLE public.seed_import_logs
  ADD COLUMN IF NOT EXISTS hero_image_url text;

COMMENT ON COLUMN public.seed_import_logs.hero_image_url IS 'Resolved hero image URL when status_code=200 (find-hero-photo success). Used for Phase 0 cache lookup by identity_key.';
