# Enrichment versioning — `enrichment_version` on plant_profiles + global_plant_library

**Date:** 2026-06-13
**Branch:** `worktree-enrichment-versioning` (isolated worktree off origin/main `a1e2d93`)
**Source:** Dispatch brief (greenlit Syd 2026-06-13) + inline UX-loading-state addendum. Design authority `agent/memory/project_gt_enrichment_versioning.md` is Dispatch-side (not in repo — same situation the Ship 2 plan documented); brief + addendum restated inline = spec.
**Builds on:** Ship 2 (`field_provenance` + `found_level` + When-to-Plant), live on origin/main via `20260611150000`.

---

## Purpose

Add a version stamp (`enrichment_version`) to AI-enriched data so the system can tell "current-gen enrichment" from "legacy / needs re-enrichment," and use it to (a) self-heal the `global_plant_library` cache, (b) make profile **Fill Blanks** version-aware (re-fill legacy AI fields instead of skipping them as non-blank), and (c) eliminate the value-flash UX from Finding #39 by hiding stale legacy values while a fill is in flight. Replaces the deferred backfill pass from `gt-v1-launch-checklist.md` — legacy data self-heals on next touch.

## Scope decisions (locked up front)

- **D-OVERWRITE (the item-4-vs-item-6 fork) → Interpretation (A) provenance-gated.** On a legacy profile (`enrichment_version < CURRENT`), Fill Blanks treats a field as overwrite-eligible iff it is **blank OR carries a `field_provenance` entry** (= written by a prior new-AI run). Non-blank fields with **no** provenance entry (user-typed OR vendor-prefilled OR pre-Ship-2 legacy-AI) are **preserved**. This honors item 6 ("user-typed values never overwritten except explicit Overwrite — verify this rule survives") with **zero data-loss risk**.
  - **Residual (flagged):** profiles AI-enriched *before Ship 2* have no provenance map, so their stale AI fields are preserved (not self-healed) by Fill Blanks — they refresh only via the explicit **AI Overwrite** button. Accepted because (1) item 6 is an invariant, (2) data loss is irreversible, (3) Ship 2 just shipped so that population is small. Alternative (B) full-legacy-overwrite would self-heal them but can clobber hand edits on that same no-provenance population.
- **D-WRITER4 (Settings bulk fill-in-blanks).** `src/app/api/settings/fill-in-blanks/route.ts` writes only the **legacy narrow field set** on its AI branch (known ADJACENT since Ship 1/2, no when-to-plant/no provenance) → it does **NOT** stamp `enrichment_version`. Rationale: `version == CURRENT` must mean "fully enriched by the current pipeline," which the narrow Settings path does not satisfy. Settings-filled profiles stay version 0 and self-heal later via the profile Fill Blanks button. (Its `global_plant_cache` write is vendor data, untouched.)
- **D-CACHE-PREFILL.** `buildUpdatesFromCacheRow` (vendor `global_plant_cache`, blanks-only) is **out of scope** for version-overwrite and version-stamp — that's vendor data, not current-AI enrichment. Version semantics stay honest: stamped only where the current AI pipeline (`enrich-from-name` tiered research) actually produced data.
- **D-PUSH-ORDER.** Code SELECTs reference the new column (some are NOT in try/catch). Pushing code before the migration applies would hard-fail prod profile pages + fill routes. So **migration applies FIRST (Syd greenlight), then code pushes** — both HELD. This overrides the brief's "code auto-push" line, which assumes a no-schema ship; flagged to orchestrator.

## CURRENT_AI_FILL_VERSION = 1

Legacy/pre-this-ship data = 0 (migration default). First versioned generation = 1. Bump convention documented in `src/lib/ai-fill/version.ts`: increment only when a pipeline change makes prior output materially stale enough to warrant re-enrichment-on-touch.

---

## Files (10)

1. `supabase/migrations/20260613130000_enrichment_version.sql` — NEW; `ADD COLUMN IF NOT EXISTS enrichment_version integer NOT NULL DEFAULT 0` on `plant_profiles` + `global_plant_library`. Idempotent. **HELD for greenlight.**
2. `src/lib/ai-fill/version.ts` — NEW; `export const CURRENT_AI_FILL_VERSION = 1` + bump-convention comment. Pure constant, client-safe (no server-only imports).
3. `src/types/garden.ts` — add `enrichment_version?: number | null` to `PlantProfile` (near :307).
4. `src/app/api/seed/enrich-from-name/route.ts` — add `enrichment_version` to `LIBRARY_COLUMNS` (read) + cache-read self-heal gate (skip rows `< CURRENT`) + stamp `enrichment_version: CURRENT` in the library upsert.
5. `src/app/api/seed/fill-blanks-for-profile/route.ts` — add `enrichment_version` to profile SELECT; version-aware eligibility in `setStr/setNum/setArr/setWeeks` (D-OVERWRITE A); stamp `enrichment_version` in `aiUpdates` on `found:true`; exclude it from `countUpdate` + provenance newEntries loop.
6. `src/lib/enrichProfileFromName.ts` — stamp `updates.enrichment_version = CURRENT` in the `enriched` block (writer 3, plant_profiles).
7. `src/app/library/[id]/page.tsx` — add `enrichment_version` to the display SELECT (:214); compute `enrichmentLoading = fillBlanksRunning && (profile.enrichment_version ?? 0) < CURRENT`; pass new props to `VaultProfileAboutTab`.
8. `src/app/library/[id]/VaultProfileAboutTab.tsx` — add `enrichmentLoading?: boolean` + `enrichmentBlankLoading?: boolean` props; render skeleton (anchor: `bg-neutral-200 rounded animate-pulse`) over AI-fillable regions per the UX addendum. **NOT** reusing the existing `isLegacy` prop (different meaning).
9. `src/lib/researchVariety.test.ts` OR a new test file — version branching unit tests (3 cases below).
10. `docs/plans/enrichment_versioning_2026-06-13.md` — this file. Plus ROADMAP §5 entry at close (notes it replaces the deferred backfill pass).

---

## UX loading-state branch (addendum spec)

At display load the profile row carries `enrichment_version`. `fillBlanksRunning` (page.tsx:511, from `useVaultEditHandlers` → `activeJobs[profileId]`) signals an in-flight fill. Branch:

- **`version == CURRENT` + active job** → show current values immediately (they won't change — only blanks fill); subtle skeleton only on currently-blank AI fields. Prop: `enrichmentBlankLoading`.
- **`version < CURRENT` + active job** → HIDE the AI-fillable values (Description, How-to-Grow scalar rows, Sun/Water/Soil pills, When-to-Plant pills+narrative), show skeleton; reveal real values when the job completes (page already refetches on `lastCompleted`, useVaultEditHandlers:253). Prop: `enrichmentLoading`.
- **No active job** → normal render (today's behavior).

Skeleton primitive anchored to `PageSkeleton.tsx:12` (`h-4 bg-neutral-200 rounded animate-pulse`) + existing spinner token; no new visual vocabulary. Naming: `enrichmentLoading` / `enrichmentBlankLoading` chosen to avoid collision with the AboutTab's existing `isLegacy` prop (pre-structured-data legacy notes).

---

## Version-branch logic (fill-blanks-for-profile, the core change)

```
const CURRENT = CURRENT_AI_FILL_VERSION;
const profileVersion = typeof p.enrichment_version === "number" ? p.enrichment_version : 0;
const isLegacyFill = !overwrite && profileVersion < CURRENT;   // a Fill-Blanks on legacy data
const prov = (p.field_provenance && typeof p.field_provenance === "object" && !Array.isArray(p.field_provenance))
  ? (p.field_provenance as Record<string, unknown>) : {};
const aiOwned = (col: string) => Object.prototype.hasOwnProperty.call(prov, col);
// eligible to write a non-empty value into col, whose current state is `blank`:
const eligible = (col: string, blank: boolean) => overwrite || blank || (isLegacyFill && aiOwned(col));
```
`setStr(col,val): if (val && eligible(col, !String(p[col]??"").trim()))` ·
`setNum(col,val): if (val!=null && eligible(col, p[col]==null || p[col]===0))` ·
`setArr(col,val): if (val.length>0 && eligible(col, existing.length===0))` ·
`setWeeks(col,v): if (int && eligible(col, p[col]==null))` (0 stays meaningful → blank only when null) ·
months inline block uses the same `eligible`.

Provenance keys == profile column names (Ship 2 writes `newEntries[key]=level` for each `aiUpdates` key), so `aiOwned(col)` is exact. Version stamp: `if (data.found === true) aiUpdates.enrichment_version = CURRENT;` before the write block; add `enrichment_version` to the `countUpdate` skip set and the provenance-newEntries skip set.

---

# AUDIT LOG

## Pass 1 — Factual (verified against origin/main `a1e2d93`)

- `LIBRARY_COLUMNS` single-source select string at [enrich-from-name/route.ts:136-145]; cache read at :295-321 (try/catch, falls through on error); upsert at :433-491 (`onConflict: "identity_key"`, try/catch). ✓ Adding `enrichment_version` to the select + a `>= CURRENT` gate + the upsert object all land in existing structures.
- `identityKeyFromVariety(name,"")` → bare species key; speciesKey path at :306-317. ✓
- fill-blanks-for-profile profile SELECT at :118-124 already includes `field_provenance` + when-to-plant; `setStr/setNum/setArr` at :294-303, `setWeeks` at :373-375, months inline at :369-372; provenance newEntries loop at :395-400 (skips `description_source`,`profile_type`); `countUpdate` skip set at :170. ✓ Version column adds to SELECT; eligibility wraps existing setters; stamp + skip-set edits are localized.
- `enrichProfileFromName.ts` writes `plant_profiles` via single UPDATE at :269-280; `enriched` guard at :182; provenance merge at :252-263. ✓ `updates.enrichment_version = CURRENT` slots into the updates object (no extra read needed — constant write).
- settings/fill-in-blanks SELECT at :41 (ProfileForFill mirror), AI narrow mapping at :233-247, write at :248. ✓ D-WRITER4 = no change here (no version stamp) — confirmed it neither reads nor writes provenance, so leaving it version-0 is consistent.
- `PlantProfile` interface at [garden.ts:213], `field_provenance` at :307. ✓
- Display SELECT at [library/[id]/page.tsx:214]; `fillBlanksRunning` in scope at :511 (from `useVaultEditHandlers` :78,:82); `howToGrowList` at :701; `VaultProfileAboutTab` rendered at :1340-1362 (already passes `retryRunning={fillBlanksRunning}`). ✓
- `VaultProfileAboutTab` props interface at :15-43 (has existing `isLegacy`); AI-fillable render regions: Description :339-348, When-to-Plant :413-448, How-to-Grow :449-477. ✓ New props are additive; skeleton wraps existing JSX.
- `useVaultEditHandlers` refetches profile on `lastCompleted` (:248-254) → reveal-on-complete is automatic. ✓
- Skeleton anchor `PageSkeleton.tsx:12` exists. ✓
- `CURRENT_AI_FILL_VERSION` will be a new pure constant → importable in both server routes and the client `page.tsx`/`VaultProfileAboutTab` (client components) with no server-only dep. ✓
- Migration: latest existing timestamp `20260613100000`; new `20260613130000` > it, no collision. Both tables exist (`plant_profiles`; `global_plant_library` created `20250326000000`). ✓
- **No modal/menu lifecycle change** → bidirectional state-transition matrix N/A. The UX branch is conditional render of existing content, not a state machine (open/close/forward/back). Single axis: profile data + active-job boolean → render. Reveal is driven by the existing refetch-on-completion, already in place.

## Pass 2 — Concerns hunt

Hunt categories: overwrite-vs-fill semantics / user-data-loss, version null/zero states, provenance-key alignment, cache self-heal correctness (vendor vs library cache), SELECT↔branch sync (false-blank hazard), push-ordering / missing-column runtime error, repeat-AI-runs, client-import safety, cohesion-by-aggregation, persona walk, test coverage.

- **User-data-loss (the headline risk):** D-OVERWRITE (A) overwrites only blank-or-provenanced fields on legacy Fill Blanks. User edits + vendor prefills + pre-Ship-2 AI = no provenance + non-blank → preserved. Item 6 survives. **Zero data-loss.** ✓ (Residual self-heal gap flagged, accepted.)
- **Version null/zero:** column is `NOT NULL DEFAULT 0`; reads coerce `typeof === "number" ? v : 0`. A missing/odd value → 0 = legacy (safe default — never falsely marks data "current"). ✓
- **Provenance-key alignment:** verified provenance keys = profile column names; `aiOwned(col)` exact for every setter column incl. `sun_summary`/`water_detail`/etc. ✓
- **Cache self-heal correctness:** version gate added ONLY to the `global_plant_library` read (botany brain), NOT the vendor `global_plant_cache` (`fillBlanksCache.getBestCacheRow`). The library read is bypassed on `forceRefresh`/`skipLibrary`, so self-heal only fires on the non-forceRefresh review-import fire-and-forget path — correct (that's the path that surfaces stale cached AI). Durable worker (`ai-fill/enqueue` :64) sends `forceRefresh:true` → always fresh anyway. ✓
- **SELECT↔branch false-blank hazard (Ship-1 class):** the version branch reads `p.enrichment_version` + `p.field_provenance` — both must be in the fill-blanks SELECT. `field_provenance` already is (:123); adding `enrichment_version`. If `enrichment_version` were omitted from SELECT it'd read undefined→0→every profile treated legacy→legacy overwrite of provenanced fields on EVERY fill (still data-safe under A, but wrong behavior). Mitigation: add to SELECT in the same commit; test asserts CURRENT-version profile = blanks-only. ✓
- **Push-ordering / missing-column runtime error:** display SELECT (:214), fill-blanks SELECT (:118), settings SELECT (:41) are NOT in try/catch — querying `enrichment_version` pre-migration = hard 500. → D-PUSH-ORDER: migration first, then code; both HELD. enrich-from-name read/upsert ARE in try/catch (:318,:493) so they degrade gracefully, but the un-guarded SELECTs force the ordering. ✓ Flagged.
- **Repeat-AI-runs:** stamping `enrichment_version=CURRENT` on `found:true` even when no field changed prevents a legacy profile from re-running AI on every Fill Blanks. ✓
- **Client-import safety:** `version.ts` is a bare `export const` — safe to import in client components (`page.tsx`/`VaultProfileAboutTab` are client). No `process.env`, no server SDK. ✓
- **Cohesion-by-aggregation:** skeleton = existing `bg-neutral-200 rounded animate-pulse` token (anchor PageSkeleton:12); no new color/animation/threshold introduced. Prop names avoid the `isLegacy` collision. Migration column type/default matches the `found_level`-era additive pattern. No new log-string format (enrich route keeps `[enrich-from-name]` prefix). ✓ — no un-anchored micro-decision.
- **Persona walk (UX loading-state surface):** Maya — sees skeleton instead of stale flash on a power-edited legacy profile; values appear correct-first, no whiplash ✓. Sydney — same skeleton vocabulary she sees on every page load (route loading.tsx) ✓. Walter — no new gesture/target; just a brief placeholder ✓. Aria — houseplants lacking frost/when-to-plant fields: those pills already don't render; skeleton only covers fields that WILL be filled ✓ (verify: skeleton must not show for sections that stay empty — see Pass-2 follow-up). Sam — new empty profile gets values appearing cleanly rather than flash-then-change ✓. No persona excluded.
  - **Pass-2 follow-up (resolved in plan):** skeleton in the `version<CURRENT` branch must cover the AI-fillable *regions that have or will have data*, not force-render empty sections. Implementation: gate the skeleton on the same "section would render" conditions already in the JSX (e.g. When-to-Plant only skeletons if the job is expected to produce it). Simplest safe rule: during `enrichmentLoading`, replace the *value* of each already-rendered AI field with a skeleton line, and for whole optional sections (When-to-Plant) skeleton only the Description + How-to-Grow core (always-present) — leave optional sections to populate on reveal. Keeps Aria/houseplant clean.
- **Test coverage:** 3 cases (legacy→overwrite provenanced, current→blanks-only, user-edit-never-clobbered) — see Verification. ✓

## Pass 3 — Sibling sweep

- **Vocabulary breadth** (version/stamp/generation/migration-flag/freshness shape): grepped `enrichment_version|_version|schema_version|data_version|generation|gen_level|stale|freshness|needs_reenrich|reenrich|backfill` across `src/` + `supabase/`. Hits: `found_level` (Ship 2 tier marker — different axis, complementary), `planting_window_zone` (zone tag), migration timestamps. **No competing version/freshness mechanism exists.** ✓ `found_level` and `enrichment_version` are orthogonal (tier-of-data vs generation-of-pipeline) — documented so they're not conflated.
- **AI-fill writer siblings (must all be version-aware per item 7):** four writers to `plant_profiles`/`global_plant_library` —
  - `fill-blanks-for-profile` (profile + triggers library write via enrich call) → **version branch + stamp** (file 5).
  - `enrich-from-name` (library cache) → **self-heal read + stamp** (file 4).
  - `enrichProfileFromName` (profile, creation helper) → **stamp** (file 6). BLOCKING-resolved: it overwrites unconditionally today (creation-time, no blank-check except growing_notes) so it has no version *branch* need — just stamp on success.
  - `settings/fill-in-blanks` (profile, narrow set) → **no stamp** by D-WRITER4 (ADJACENT, known-incomplete path). Logged.
- **Profile DISPLAY readers (version-aware? per item 7 "read to decide AI behavior NEEDS check; read for display = none"):** `library/[id]/page.tsx` is the only display reader that needs the UX branch. Other readers (SeedVaultView grid, MyPlants, etc.) render whatever's on the row — **no version check needed** (item 7 explicitly: display-only reads don't branch). Confirmed scope: only the profile detail page gets the loading branch. ✓
- **e2e scope:** this ship adds NO user-facing label strings (skeleton is visual; no copy change). Grepped `e2e/` for `enrichment|Fill Blanks|Overwrite` — fill-flow specs exist but assert on existing labels/behavior unaffected by an additive column + conditional skeleton. No e2e assertion touches a flipped string. ✓ (Will re-confirm at Phase 4 that no e2e asserts on the now-skeletoned region during an active job — e2e doesn't trigger live AI jobs, so the skeleton branch is inert in tests.)
- **CONCERN (pre-existing, no action):** two AI-fill pipelines persist (durable `ai-fill/enqueue` worker vs review-import fire-and-forget vs settings bulk) — the long-standing consolidation backlog item. This ship doesn't worsen it; D-WRITER4 documents the version-coverage gap on the Settings path.

## Pass 4 — Lock hygiene

- **Push tiers (CLAUDE.md):** schema migration present → explicit greenlight for `supabase db push`; brief reinforces destructive-tier hold. Code push: ship has schema deps → NOT auto-push tier; HELD + ordered after migration (D-PUSH-ORDER). ✓
- **Migration-collision rule:** unique 14-digit timestamp `20260613130000`, no prefix collision. ✓
- **B5 honesty / couldn't-find lock (ROADMAP §6 2026-06-10):** untouched — `found:false` still never cached, never stamped (version stamp gated on `found:true`). ✓
- **Three-tag schema lock + Leak-hardening locks (2026-06-10):** untouched — no new retry, no tag-write changes; tier ladder unchanged. ✓
- **Empty-cell "—" convention:** the loading branch shows a skeleton (loading state, explicitly NOT an empty-cell per the convention's "NOT for: loading states" clause), and on reveal the existing "—"/hidden-section logic applies. ✓
- **Icon-style / casing / emerald conventions:** no icons, no new buttons, no copy. N/A. ✓
- **VISION §10 don't-touch:** none (no Home Plantable widget, no nav, no contexts mutated — `AiFillJobsContext` is read-only via existing hook). ✓
- **Deferred backfill pass (`gt-v1-launch-checklist.md`):** this ship REPLACES it (self-heal-on-touch). ROADMAP §5 entry to note the supersession at close. ✓

**Audit status: clean** (Pass 1 factual verified by direct read; Pass 2 follow-up folded into plan; Pass 3 writer/reader coverage complete + vocabulary breadth swept; Pass 4 locks complied, no supersession needed beyond replacing the backfill pass).

---

## Verification plan (Phase 4)

- `npm run test:run` — full suite green + new version-branch tests:
  1. profile `enrichment_version=0` + provenanced field non-blank + Fill Blanks (no overwrite) → field **overwritten**.
  2. profile `enrichment_version=CURRENT` + non-blank field + Fill Blanks → field **preserved** (blanks-only).
  3. non-blank field with **no** provenance entry, legacy profile, Fill Blanks → **preserved** (user-edit-wins / item 6 regression guard).
  4. (bonus) cache row `enrichment_version < CURRENT` in enrich-from-name read → treated as miss (AI runs).
- `npm run build` — type-check the new column threading + client import of the constant.
- No Preview/screenshots per brief constraint (auth-blocked profile surface; core is API logic + conditional render). UX skeleton verified by build + the conditional-render trace above.
- **HELD:** `supabase db push` (migration, Syd greenlight) → then code push. Apply order documented.

## Amendments (Phase 3)

1. **Pass-1 fix (within file 6).** `enrichProfileFromName.ts` builds a provenance `newEntries` map by looping over every `updates` key. Since the version stamp now lives in `updates`, `enrichment_version` had to be added to that loop's skip-set (alongside `botanical_care_notes`, `profile_type`) or it would be mis-tagged with a provenance tier. Re-audit: Pass 1 — version is a meta field, not data, so excluding it is correct and matches the same skip pattern in the main route. No behavior change beyond the intended one.
2. **Refactor (files 2 + 5 + 9): extracted eligibility to a pure function.** The version-aware write gate is now `isFieldFillEligible({overwrite, blank, profileVersion, fieldHasProvenance})` exported from `src/lib/ai-fill/version.ts` and called by the route's `eligible(col, blank)` closure — instead of an inline `isLegacyFill` expression. Re-audit: Pass 1 — pure function, no I/O; Pass 2 — identical truth table to the inline version (overwrite||blank || (legacy && hasProvenance)); the gain is a directly unit-testable single-source-of-truth for the data-safety semantics (6 cases in `version.test.ts`, all green). No behavior change. Improves on the plan's inline approach (testability) — flagged as a deliberate improvement, not scope drift.
3. **UX granularity decision (file 8, micro-aesthetic — flag for Syd).** The addendum's "subtle skeleton only on the blank fields being filled" (current-version case) is implemented at **section-group granularity**, not true per-field: legacy in-flight fill → `AiFillSkeletonGroup` replaces the contiguous AI block (Description→Companion) so stale values are hidden; current in-flight fill → existing values stay (shown immediately, per the addendum) plus a subtle `AiFillBlankHint` ("Filling in remaining details…", spinner). Rationale: per-grid-cell skeletons across the large interleaved AboutTab would be high-regression-risk for marginal polish; the hint communicates "blanks filling" with the canonical skeleton/spinner tokens (anchored, no new vocabulary). **Uncovered tail:** the Propagation section sits below the non-AI Tags section, so it's outside the contiguous skeleton block — a legacy Propagation value could still briefly flash. Minor (far down page, rarely dramatic). Both flagged for Syd to refine if she wants finer granularity / Propagation coverage.

## Phase 4 results (2026-06-13)

- `npm run test:run` → **707/707 pass** (+6 new `version.test.ts` cases covering blank-always-fills, overwrite-always, legacy-self-heal, current-blanks-only, item-6 user-edit-never-clobbered, version-comparison guard).
- `npm run build` → _(pending — see chat)_
- Acceptance criteria 1–9: migration (1) ✓ staged HELD; version constant (2) ✓; worker version-writes (3) ✓ enrich-from-name upsert + fill-blanks aiUpdates + enrichProfileFromName; Fill-Blanks branching (4) ✓ interpretation A; Overwrite unchanged (5) ✓ (overwrite path untouched — `overwrite` still forces all); user-edit-wins (6) ✓ proven by test; Pass-2 reader/writer sweep (7) ✓ (4 writers classified, display readers scoped); tests (8) ✓; doc capture (9) → ROADMAP §5 at close.
- No Preview/screenshots per brief constraint (auth-blocked profile surface; core is API logic + conditional render). UX skeleton verified via build + conditional-render trace.
- **Pushes HELD:** migration `supabase db push` (Syd greenlight) → then code push. Apply order: migration FIRST (code SELECTs reference the new column; un-guarded SELECTs would 500 pre-migration).
