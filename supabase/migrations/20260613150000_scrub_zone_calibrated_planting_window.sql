-- Zone-agnostic encyclopedia DATA CLEANUP (Syd 2026-06-13).
--
-- DESTRUCTIVE / non-idempotent in spirit — explicit UPDATEs on production rows. Per CLAUDE.md SQL
-- sub-tiers this is the ALWAYS-ASK tier: HELD for Syd's explicit per-push greenlight, separate from
-- the additive schema migration (20260613140000).
--
-- Removes the only TOXIC zone-calibrated artifacts the old per-user zone clause wrote: the literal
-- "Not viable in Zone N — indoor / greenhouse only" strings in planting_window, and the retired
-- planting_window_zone provenance column's values. Plain month windows are left as-is (already
-- zone-agnostic-enough + still month-parseable for the plantability surfaces).
--
-- Zone-biased optimal_planting_months_array is intentionally NOT scrubbed here: it is undetectable
-- (a zone-biased month array looks like any other) and harmless, and the CURRENT_AI_FILL_VERSION
-- v2->v3 bump marks every pre-bump row legacy, so it self-heals to zone-agnostic on the next AI-fill
-- touch (global_plant_library: treated as a cache miss; plant_profiles: version-aware Fill Blanks
-- re-fills the provenance-tagged AI field).

-- Per-user profiles: drop the "Not viable in Zone…" planting_window text + retire the zone column.
UPDATE public.plant_profiles
   SET planting_window = NULL
 WHERE planting_window LIKE 'Not viable in Zone%';

UPDATE public.plant_profiles
   SET planting_window_zone = NULL
 WHERE planting_window_zone IS NOT NULL;

-- Shared botany-brain cache (columns).
UPDATE public.global_plant_library
   SET planting_window = NULL
 WHERE planting_window LIKE 'Not viable in Zone%';

-- Shared scrape/enrich cache (JSONB extract_data) — drop the contaminated key only.
UPDATE public.global_plant_cache
   SET extract_data = extract_data - 'planting_window'
 WHERE extract_data->>'planting_window' LIKE 'Not viable in Zone%';
