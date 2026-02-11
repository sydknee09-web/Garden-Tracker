-- True while background find-hero-photo is running for this profile; cleared when job completes or fails.
ALTER TABLE public.plant_profiles
  ADD COLUMN IF NOT EXISTS hero_image_pending boolean DEFAULT false;

COMMENT ON COLUMN public.plant_profiles.hero_image_pending IS 'True while Gemini is fetching a stock photo for this profile. Vault shows shimmer; cleared when hero_image_url is set or job times out.';
