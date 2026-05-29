-- Phase 2 follow-up: surface zone provenance on the planting_window field.
-- Records which USDA zone the AI used to generate planting_window per profile.
-- Lazy-populated: existing profiles stay NULL until re-enrichment (Fill Blanks).
--
-- Additive + idempotent; safe to re-apply.

ALTER TABLE public.plant_profiles
  ADD COLUMN IF NOT EXISTS planting_window_zone TEXT;

COMMENT ON COLUMN public.plant_profiles.planting_window_zone IS
  'USDA hardiness zone the AI used when generating planting_window. NULL = pre-Phase-2 profile or zone-agnostic enrichment. Surfaced on profile About tab as "Generated for Zone X" label.';
