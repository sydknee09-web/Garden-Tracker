# Zone-Agnostic Encyclopedia Architecture Fix (origin/main base)

**Worktree:** `.claude/worktrees/zone-agnostic-encyclopedia`, branch `worktree-zone-agnostic-encyclopedia`, base `fc7d90b` (= origin/main HEAD).
**Date:** 2026-06-13
**Greenlit:** Syd 2026-06-13 — encyclopedia data zone-agnostic; viability = render-time banner. Path A + (per orchestrator 2026-06-13) **bump version, don't drop it**.

## RE-BASELINE NOTE (critical)
First recon ran against stale branch `feat/instance-detail-page` (97ee7c3) and was **discarded**. origin/main contains, unbeknownst to the stale base:
- **Version system** — `src/lib/ai-fill/version.ts` `CURRENT_AI_FILL_VERSION = 2`, `isFieldFillEligible`, migration `20260613130000` (`enrichment_version` on plant_profiles + global_plant_library). Orchestrator's records were correct; my "never shipped" read was a stale-base artifact. → **bump 2→3** (this ship is a material prompt change).
- **When-to-Plant redesign** (migration `20260611150000`) — `when_to_plant_description`, `planting_seasons_tags`, `optimal_planting_months_array` (INT[]), `indoor_start_weeks_before_frost`, `outdoor_plant_weeks_after_frost`, `field_provenance`; library adds `found_level`.
- **Tiered research** — `researchPlantTiered` (variety/cultivar/species framings) alongside `researchVariety`.
- Profile page moved `vault/[id]` → `library/[id]`.

## Contamination surface (origin/main)
Zone bias enters via:
1. `buildZoneClause` ([researchVariety.ts:304](src/lib/researchVariety.ts:304)) — injects zone-calibrated `planting_window` + literal `"Not viable in Zone {N} — indoor / greenhouse only"`. Applied in BOTH `researchVariety` (:320) and `researchPlantTiered` (:425).
2. `optimal_planting_months` field prompt ([researchVariety.ts:93](src/lib/researchVariety.ts:93)) — "calibrated to the user's zone if one is given" → the structured month array is itself zone-biased.
3. `enrich-from-name` reads `user_settings.planting_zone`, passes `userZone` to research, and `skipLibrary` bypasses the shared cache for non-10b zones ([route.ts:268-286](src/app/api/seed/enrich-from-name/route.ts:268)) — but still writes the zone-biased window into the shared identity-keyed `global_plant_library` (:462) → cross-user leak.

Stored in 3 places: `plant_profiles`, `global_plant_library` (columns), `global_plant_cache` (JSONB `extract_data`).

Display still leaks: [VaultProfileAboutTab.tsx:482](src/app/library/[id]/VaultProfileAboutTab.tsx:482) "Not viable" prefix-match + [:543](src/app/library/[id]/VaultProfileAboutTab.tsx:543) "Generated for Zone X".

## Plantability dependency (Path A still required)
`planting_window` **text** is still month-parsed for "plantable now" on Calendar ([page.tsx:261](src/app/calendar/page.tsx:261)), Vault ([VaultPageContent.tsx:1408](src/app/vault/VaultPageContent.tsx:1408)), Library profile ([page.tsx:410](src/app/library/[id]/page.tsx:410)), Packets ([PacketVaultView.tsx:379](src/components/PacketVaultView.tsx:379)). `SeedVaultView` prefers the structured `optimal_planting_months_array`, falls back to text. So BOTH the text window and the months array must stay populated + month-based — just **zone-agnostic** (generic temperate baseline), not zone-calibrated. Frost-relative narrative lives in the already-zone-agnostic `when_to_plant_description` + weeks-before/after-frost fields. Zone truth → render-time banner from `hardiness_zone_min/max`.

## Layers

### Layer A — Schema (additive; code-tier; HOLD push)
`supabase/migrations/<ts>_plant_profiles_hardiness_zone_range.sql`:
- `plant_profiles`: `hardiness_zone_min smallint`, `hardiness_zone_max smallint` (IF NOT EXISTS, NULL).
- `global_plant_library`: same two columns.
- `global_plant_cache`: none (JSONB).
- `PlantProfile` type ([garden.ts](src/types/garden.ts)) + `hardiness_zone_min/max`.

### Layer B — Prompt + plumbing (zone-agnostic) — [src/lib/researchVariety.ts] + 3 routes + caches + version
- **researchVariety.ts**: delete `buildZoneClause`; drop `userZone` param from `researchVariety` + `researchPlantTiered`; drop `zoneClause` args from `runResearchQuery`. Edit `optimal_planting_months` field text → always "typical temperate-climate guidance" (no zone conditional). Add to FIELD_LIST: `hardiness_zone_min` / `hardiness_zone_max` (USDA integer 1–13). Add to `ResearchVarietyResult` + parse in `runResearchQuery` (via `sFlex`→int).
- **version.ts**: `CURRENT_AI_FILL_VERSION = 3` + v3 bump-log entry.
- **enrich-from-name/route.ts**: remove `userZone` read + `zoneNormalized` + `skipLibrary` (cache now valid for all zones, NORTH_STAR §1); drop `zoneUsed`. Add `hardiness_zone_min/max` to response + `parseHardiness`, `responseFromLibraryRow`, library upsert, `LIBRARY_COLUMNS`. Keep version stamping (already at CURRENT).
- **fill-blanks-for-profile/route.ts**: map `hardiness_zone_min/max` into `aiUpdates` (numeric setter) + cache write; no zone changes needed (it already doesn't pass zone). Stamp continues via CURRENT.
- **enrichProfileFromName.ts**: remove `userZone` option + `planting_window_zone` write; add `hardiness_zone_min/max` write. Version stamp already present.
- **fillBlanksCache.ts**: add `hardiness_zone_min/max` to `EnrichDataForCache`, `buildUpdatesFromCacheRow`, `writeEnrichToGlobalCache`, `ProfileForFill`.

### Layer C — Display (render-time banner) — [src/app/library/[id]/VaultProfileAboutTab.tsx]
- Remove "Not viable" prefix-match block (:482) + "Generated for Zone X" (:543-545).
- Add "Hardiness Zones X–Y" field in When-to-Plant section (em-dash "—" when null).
- Add render-time viability banner: read user zone (numeric); if outside `[min,max]` → warning icon + "Not viable in Zone {z} — indoor / greenhouse only" (fallback "in your climate" if zone unknown; render nothing if min/max null). Confirm user-zone source on the page at execute. Anchor banner styling to existing italic-note pattern.

### Layer D — Data cleanup (destructive; ALWAYS-ASK; HOLD push)
`supabase/migrations/<ts>_scrub_zone_calibrated_planting_window.sql`:
- `plant_profiles`: `SET planting_window = NULL WHERE planting_window LIKE 'Not viable in Zone%'`; `SET planting_window_zone = NULL`.
- `global_plant_library`: same `Not viable` scrub.
- `global_plant_cache`: `SET extract_data = extract_data - 'planting_window' WHERE extract_data->>'planting_window' LIKE 'Not viable in Zone%'`.
- Zone-biased `optimal_planting_months_array` is NOT scrubbed (undetectable + harmless) — **the version bump 2→3 marks every row legacy → re-heals to zone-agnostic on next AI-fill touch** (`isFieldFillEligible` re-fills provenance-tagged AI fields).

## Pass-2 / Pass-3 grep findings
- Readers of `planting_window` text: Calendar/Vault/Profile/Packets (text) + SeedVaultView (array-first) — Path A keeps all working (CONCERN resolved).
- Writers zone-stripped: `researchVariety`/`researchPlantTiered`, enrich route, fill-blanks, enrichProfileFromName, fillBlanksCache. Edit modal = user text, untouched.
- Caches: library (cols), global_plant_cache (JSONB), plant_extract_cache (hero/scrape extract — verify no zone-calibrated planting_window; scrape text isn't zone-calibrated → no scrub).
- Tests: `researchVariety.test.ts` (prompt-contract — `optimal_planting_months` assert), `enrich-from-name/route.test.ts` (months parse), `version.test.ts` (CURRENT const), e2e/ "Not viable" grep. Update at execute.

## Verification: `npm run test:run` + `npm run build` green; git diff per layer; no screenshots. Migrations HELD; push order schema(A) → code → cleanup(D).

## Audit
- P1 factual: all paths/lines verified on origin/main worktree. ✓
- P2 concerns: plantability regression resolved (Path A keeps month-form); version bump does the self-heal for zone-biased arrays; cross-user leak root-caused to library upsert.
- P3 siblings: 3 caches + 5 plantability readers + tiered+non-tiered research both swept; e2e/test sweep at execute.
- P4 locks: exact-match contract preserved; version-bump convention honored (material prompt change); NORTH_STAR §1 improved (cache valid all zones). No VISION §10/§11 breach.
