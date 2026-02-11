-- Hero image: plant/actual photo for profile and vault thumbnails (replaces packet as primary).
-- Path is stored relative to journal-photos bucket (e.g. user_id/hero-{profile_id}.jpg).
ALTER TABLE public.plant_profiles
  ADD COLUMN IF NOT EXISTS hero_image_path text;

COMMENT ON COLUMN public.plant_profiles.hero_image_path IS 'Optional profile hero (plant) photo path in journal-photos bucket. When set, used for profile and vault list thumbnails instead of seed packet image.';
