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
 * Pure constant — safe to import from both server routes and client components.
 */
export const CURRENT_AI_FILL_VERSION = 1;

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
