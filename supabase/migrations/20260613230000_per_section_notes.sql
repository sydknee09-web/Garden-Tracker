-- Sprint 10 — per-section "Notes ▾" expanders (Syd 2026-06-13, Option A).
--
-- Dedicated topic-specific note columns per profile section, distinct from the cross-cutting
-- `growing_notes` narrative. Sun + Water reuse the existing `sun_detail` / `water_detail` columns
-- (no new column needed for those); these five cover the sections that lacked a narrative field.
--
-- Additive + idempotent + non-destructive: new nullable text columns, NO defaults, NO backfill.
-- Existing rows stay NULL (= no content yet); they self-heal on their next AI Fill once
-- CURRENT_AI_FILL_VERSION is bumped to 4 (legacy rows re-enrich and populate these).
--
-- Mirrors the sun_detail/water_detail storage pattern: columns live on BOTH plant_profiles (the
-- per-user profile) and global_plant_library (the AI "botany brain" cache), so a cache hit is as
-- rich as a fresh AI fill (NORTH_STAR §1). global_plant_cache (vendor-scrape JSONB) is untouched.

ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS soil_notes text;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS seed_starting_notes text;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS pest_disease_notes text;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS harvest_notes text;
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS companion_notes text;

ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS soil_notes text;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS seed_starting_notes text;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS pest_disease_notes text;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS harvest_notes text;
ALTER TABLE global_plant_library ADD COLUMN IF NOT EXISTS companion_notes text;
