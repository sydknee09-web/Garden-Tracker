-- Mature dimensions for plant_profiles (display in How to Grow, edit in profile).
ALTER TABLE public.plant_profiles
  ADD COLUMN IF NOT EXISTS mature_height text,
  ADD COLUMN IF NOT EXISTS mature_width text;

COMMENT ON COLUMN public.plant_profiles.mature_height IS 'Typical mature height (e.g. "3-4 ft"). From Magic Fill or manual edit.';
COMMENT ON COLUMN public.plant_profiles.mature_width IS 'Typical mature spread/width (e.g. "2 ft"). From Magic Fill or manual edit.';
