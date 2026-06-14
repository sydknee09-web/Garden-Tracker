/**
 * Current AI-fill enrichment version.
 *
 * Stamped onto `plant_profiles.enrichment_version` and `global_plant_library.enrichment_version`
 * whenever the current AI pipeline successfully enriches a row. Rows at a lower version are
 * "legacy / needs re-enrichment" and self-heal on the next AI-fill touch:
 *   - global_plant_library cache rows below CURRENT are treated as a cache miss → re-researched.
 *   - plant_profiles below CURRENT get version-aware Fill Blanks (AI-owned fields are re-filled,
 *     user/vendor data is preserved — see fill-blanks-for-profile route).
 *
 * This replaces the one-time deferred backfill pass (gt-v1-launch-checklist.md).
 *
 * BUMP CONVENTION: increment ONLY when a pipeline change makes prior output materially stale
 * enough that existing rows should be re-enriched the next time they're touched. A bump means
 * "every pre-bump profile becomes legacy" — so bump deliberately, not for cosmetic prompt tweaks.
 *
 * BUMP LOG:
 *  - v1 (2026-06-13): first versioned generation (enrichment_version ship).
 *  - v2 (2026-06-13, Sprint 6): AI-fill quality bundle — the Gemini prompt now produces a rich
 *    Growing Notes narrative, deeper Propagation + seed-saving guidance, and fuller Plant
 *    Characteristics (Findings #15/#18/#22), and the creation-time writer now persists the full
 *    characteristics field set. v1 output is materially thinner, so v1 profiles and library rows
 *    self-heal (re-enrich) on their next AI-fill touch.
 *  - v3 (2026-06-13, Sprint 10): profile IA redesign — the Gemini prompt now structures
 *    growing_notes into five labeled sections (Soil / Watering / Feeding / Pruning & Training /
 *    Pests & Disease) for the sectioned Growing Notes render, and asks propagation_method for
 *    EVERY viable method (not just the primary) with propagation_notes as a brief 2-3 sentence
 *    note per non-seed method. v2's single-narrative Growing Notes + single-method Propagation are
 *    materially restructured, so v2 profiles and library rows self-heal on their next AI-fill touch.
 *  - v4 (2026-06-13, zone-agnostic encyclopedia): enrichment is now fully ZONE-AGNOSTIC. The
 *    per-user zone clause is removed — planting_window + optimal_planting_months_array are
 *    generic temperate-climate baselines (no zone calibration, no "Not viable in Zone N" strings),
 *    and a structured hardiness_zone_min/max range is captured instead. Zone-specific viability is
 *    computed at render time. v3 (and earlier) rows carry zone-biased windows/months, so they
 *    self-heal (re-enrich zone-agnostic) on their next AI-fill touch.
 *  - v5 (2026-06-13, Sprint 10 addendum): per-section "Notes" — the Gemini prompt now also produces
 *    tight topic-specific notes per section (soil_notes / seed_starting_notes / pest_disease_notes /
 *    harvest_notes / companion_notes; Sun/Water reuse the existing sun_detail/water_detail), DISTINCT
 *    from the cross-cutting growing_notes. v4 (and earlier) rows lack these fields, so they
 *    self-heal (re-enrich) on their next AI-fill touch and populate the new section notes.
 *
 * Pure constant — safe to import from both server routes and client components.
 */
export const CURRENT_AI_FILL_VERSION = 5;

/**
 * Whether an AI Fill run may write an AI-derived value into a profile field.
 * Pure decision — the single source of truth for version-aware Fill Blanks semantics.
 *
 *  - `overwrite` (explicit "Overwrite with AI?" button) → always writes.
 *  - `blank` field → always fills (the original Fill-Blanks behavior).
 *  - legacy profile (`profileVersion < CURRENT`) on a Fill Blanks → ALSO re-fills a non-blank field
 *    IFF it carries an AI provenance entry (`fieldHasProvenance`) — i.e. it was written by a prior
 *    AI run, so refreshing it is safe. User-typed / vendor / pre-Ship-2 fields have no provenance
 *    entry and are therefore PRESERVED (the item-6 invariant: AI never clobbers user data on a
 *    Fill Blanks).
 *  - current profile (`profileVersion >= CURRENT`) on a Fill Blanks → blanks-only (unchanged).
 */
export function isFieldFillEligible(args: {
  overwrite: boolean;
  blank: boolean;
  profileVersion: number;
  fieldHasProvenance: boolean;
}): boolean {
  const { overwrite, blank, profileVersion, fieldHasProvenance } = args;
  if (overwrite || blank) return true;
  const isLegacy = profileVersion < CURRENT_AI_FILL_VERSION;
  return isLegacy && fieldHasProvenance;
}
