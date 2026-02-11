-- Store external (vendor/stock) plant image URL from link import; used for profile thumbnail when no hero_image_path.
ALTER TABLE public.plant_profiles
  ADD COLUMN IF NOT EXISTS hero_image_url text;

COMMENT ON COLUMN public.plant_profiles.hero_image_url IS 'Optional URL to a stock/vendor plant image (e.g. from link import). Used for profile thumbnail when hero_image_path is not set.';
