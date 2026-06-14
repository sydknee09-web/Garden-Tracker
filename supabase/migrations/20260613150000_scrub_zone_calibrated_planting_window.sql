-- Zone-agnostic encyclopedia DATA CLEANUP (Syd 2026-06-13).
--
-- DESTRUCTIVE / non-idempotent in spirit — explicit UPDATEs on production rows. Per CLAUDE.md SQL
-- sub-tiers this is the ALWAYS-ASK tier (greenlit 2026-06-13 under the relaxed sequenced-ship gate),
-- applied separately from the additive schema migration (20260613140000).
--
-- Removes the only TOXIC zone-calibrated artifacts the old per-user zone clause wrote: the literal
-- "Not viable in Zone N — indoor / greenhouse only" strings in planting_window, and the retired
-- planting_window_zone provenance column's values. Plain month windows are left as-is (already
-- zone-agnostic-enough + still month-parseable for the plantability surfaces).
--
-- Zone-biased optimal_planting_months_array is intentionally NOT scrubbed here: it is undetectable
-- (a zone-biased month array looks like any other) and harmless, and the CURRENT_AI_FILL_VERSION
-- bump marks every pre-bump row legacy, so it self-heals to zone-agnostic on the next AI-fill touch.
--
-- Each UPDATE reports its affected row count via RAISE NOTICE so the apply log shows the exact scope.

DO $$
DECLARE
  n_profiles_window  integer;
  n_profiles_zone    integer;
  n_library_window   integer;
  n_cache_window     integer;
BEGIN
  -- Per-user profiles: drop the "Not viable in Zone…" planting_window text.
  UPDATE public.plant_profiles
     SET planting_window = NULL
   WHERE planting_window LIKE 'Not viable in Zone%';
  GET DIAGNOSTICS n_profiles_window = ROW_COUNT;

  -- Retire the planting_window_zone provenance column's values (no longer displayed).
  UPDATE public.plant_profiles
     SET planting_window_zone = NULL
   WHERE planting_window_zone IS NOT NULL;
  GET DIAGNOSTICS n_profiles_zone = ROW_COUNT;

  -- Shared botany-brain cache (columns).
  UPDATE public.global_plant_library
     SET planting_window = NULL
   WHERE planting_window LIKE 'Not viable in Zone%';
  GET DIAGNOSTICS n_library_window = ROW_COUNT;

  -- Shared scrape/enrich cache (JSONB extract_data) — drop the contaminated key only.
  UPDATE public.global_plant_cache
     SET extract_data = extract_data - 'planting_window'
   WHERE extract_data->>'planting_window' LIKE 'Not viable in Zone%';
  GET DIAGNOSTICS n_cache_window = ROW_COUNT;

  RAISE NOTICE 'zone-scrub: plant_profiles.planting_window NULLed = %', n_profiles_window;
  RAISE NOTICE 'zone-scrub: plant_profiles.planting_window_zone NULLed = %', n_profiles_zone;
  RAISE NOTICE 'zone-scrub: global_plant_library.planting_window NULLed = %', n_library_window;
  RAISE NOTICE 'zone-scrub: global_plant_cache extract_data key dropped = %', n_cache_window;
END $$;
