-- Zone-agnostic encyclopedia (Syd 2026-06-13): enrichment stores a zone-AGNOSTIC structured
-- hardiness range instead of zone-calibrated planting windows. The user's own zone decides
-- viability at RENDER time (the About-tab viability banner) — nothing zone-specific is persisted.
--
-- Additive + idempotent → code-tier per CLAUDE.md SQL sub-tiers, but a schema change, so applied
-- via explicit greenlight (supabase db push) at the SQL push gate.
--
-- smallint range 1-13 (USDA zones); NULL = not yet enriched. Existing rows backfill organically as
-- profiles/library rows re-enrich at CURRENT_AI_FILL_VERSION (the v2→v3 bump marks them legacy).

ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS hardiness_zone_min smallint;
ALTER TABLE public.plant_profiles ADD COLUMN IF NOT EXISTS hardiness_zone_max smallint;
COMMENT ON COLUMN public.plant_profiles.hardiness_zone_min IS
  'Coldest USDA hardiness zone (1-13) this plant survives outdoors year-round. Zone-AGNOSTIC fact; drives the render-time viability banner. AI-filled.';
COMMENT ON COLUMN public.plant_profiles.hardiness_zone_max IS
  'Warmest USDA hardiness zone (1-13) this plant grows well in. Zone-AGNOSTIC fact. AI-filled.';

ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS hardiness_zone_min smallint;
ALTER TABLE public.global_plant_library ADD COLUMN IF NOT EXISTS hardiness_zone_max smallint;
COMMENT ON COLUMN public.global_plant_library.hardiness_zone_min IS
  'Coldest USDA hardiness zone (1-13). Cached zone-agnostic so the row is valid for all users regardless of zone (NORTH_STAR §1).';
COMMENT ON COLUMN public.global_plant_library.hardiness_zone_max IS
  'Warmest USDA hardiness zone (1-13). Cached zone-agnostic.';
