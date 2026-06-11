# AI Fill architecture overhaul — Ship 2: tag-aware framing + tiered retry + provenance + When-to-Plant structured fields

**Date:** 2026-06-11
**Branch:** worktree-ai-fill-overhaul (isolated worktree off origin/main `1c2a201`)
**Source:** Dispatch brief (Ship 2 of the AI Fill diagnostic, session `local_8338102b…`); builds on Ship 1 `f7100e7`
**NORTH_STAR cites:** §1 "No duplicate paths" (one enrichment pipeline gains tiers instead of a parallel species pipeline; Library filter chips extend the existing Refine modal instead of a second filter surface), §2 "Take mental load OFF the user" (AI fills the When-to-Plant structure; quick-scan pills carry the answer without reading prose; provenance tags carry data-trust info the user would otherwise have to guess), §3 "Information-hub framing" (the profile's How-to-Grow card answers "when do I plant this" in place).

---

## Purpose

Make AI Fill work for ALL plant shapes (seed varieties, perennial cultivars, species-only plants like ferns/cannas) via tag-aware prompt framing + a tiered retry ladder (specific → species → honest not-found), tag every AI-filled field with its provenance level, and ship the When-to-Plant rich narrative + structured tags + Library filter integration — all while preserving the B5 honesty contract (never substitute, never fabricate; species data is explicitly TAGGED as species data).

## Lock supersession (Pass 4 finding, declared up front)

ROADMAP §6 **2026-06-10 "Couldn't-find AI UX — NO species-level fallback"** locked: no species fallback; empty + toast. This brief **consciously supersedes** that lock's fallback half: tiered retry returns species-level data **explicitly tagged as species-level** (provenance pill + Source line), which defeats the lock's stated rationale ("silently filling a variety profile with generic species data is a lie the user can't detect" — provenance makes it detectable and honest). The couldn't-find UX half of the lock SURVIVES: it now fires when **all** tiers fail. The toast copy + Try Again + never-cache-not-found all stay. New §6 entry to be logged at close; supersession is Syd-directed via the Dispatch brief, not Claude drift.

## Acceptance criteria

1. **Tag-aware framing (profile path only):** enrich-from-name accepts optional profile tags; prompt framing branches: Annual+Veg/Herb/Flower → "seed variety" (current); Perennial+Tree/Shrub/Vine → "named cultivar"; anything else/untagged-with-variety → combined-common-name then species; no variety → species lookup. Packet path (extract route `researchVariety`) byte-identical behavior.
2. **Tiered retry:** most-specific first; each not-found falls one tier broader; AI infra-failure (null) aborts the ladder (honest "AI unavailable"); all-tiers-not-found → existing couldn't-find UX (`found:false`, never cached).
3. **Multi-tier cache:** read tries variety key then species key before any AI call; writes land at the key matching the found level, with `found_level` recorded on `global_plant_library`.
4. **Provenance:** every AI-filled profile field tagged `variety | cultivar | species` in `plant_profiles.field_provenance` JSONB; user-edited fields are simply absent from the map (absence = user/legacy). Display extends the existing Source-line pattern (Description card register) per section.
5. **When to Plant:** new fields (narrative + seasons + months + indoor/outdoor frost offsets) asked in the same Gemini call, parsed, cached, written through all profile writers, displayed as quick-scan pills above the narrative in How to Grow.
6. **Library filters:** "Plant Now"/Sowing-Month counts prefer `optimal_planting_months_array` (text-parse fallback); new "Season" + "Method" refine sections in the existing VaultGridRefineModal.
7. Tests + build green. Migration staged; **`supabase db push` AND code push BOTH held for Syd greenlight** (schema ship → no auto-push tier).

## Out of scope (locked by brief)

- Path B packet enrichment (extract route framing unchanged)
- Zone-aware frost-date math on profiles (Phase 2.5/2.6 — structured fields are zone-agnostic biology; zone math at query time elsewhere)
- Library filter category audit (edible/ornamental — queued separately)
- Provenance tagging on the vendor/global_plant_cache scrape path (declared scope boundary: provenance is written by the AI tier system; vendor data keeps its existing "Source: Vendor" line)
- Edit-modal "user" provenance writes (absence-of-entry = user/legacy; avoids touching the edit modal this ship)

## Brief-vs-reality drift notes (verified at Phase 1)

- Brief path `docs/plans/ai_fill_quick_wins.md` → actual `.claude/plans/ai_fill_quick_wins.md` (read).
- Brief's `agent/memory/project_gt_*` files do not exist in this repo — Dispatch-side memory; content restated inline in the brief, used as spec.
- Brief says "Update Zod schema" — the pipeline has no Zod; parsing is the hand-rolled `s(k)` map in `researchVariety.ts`. Parser extended instead.
- Brief path `src/app/api/enrich-from-name/route.ts` → actual `src/app/api/seed/enrich-from-name/route.ts`.
- Test count: brief says 623; repo at `1c2a201` runs the suite green (count verified in Phase 4).

---

## Parity matrix — current state vs new state

| Axis | Current (origin/main `1c2a201`) | New (this ship) |
|---|---|---|
| Prompt framing | One framing: "this specific seed variety" ([researchVariety.ts:18](../../src/lib/researchVariety.ts)) | 3 preambles (variety / cultivar / species) built by `buildResearchPrompt(framing)`; shared field list |
| Retry | Single attempt; `found:false` → empty + toast | Ladder per tags: `[variety|cultivar] → combined-name → species`; not-found falls through; null aborts |
| Cache read | `global_plant_library` by variety identity key only ([route.ts:207-221](../../src/app/api/seed/enrich-from-name/route.ts)) | Variety key, then species key (`identityKeyFromVariety(name, "")`), before AI |
| Cache write | Variety key, full field set, no level recorded | Key matches found level; `found_level` column written |
| Provenance | None (only `description_source` vendor/ai/user) | `field_provenance` JSONB per AI-written field; response carries `provenance` |
| When to Plant | `planting_window` + 4 window strings (text) | + `when_to_plant_description`, `planting_seasons_tags[]`, `optimal_planting_months_array[]`, `indoor_start_weeks_before_frost`, `outdoor_plant_weeks_after_frost` |
| Profile display | Window strings in How-to-Grow grid | + pills row (🏠 / 🌱 / 🌸) + narrative above the grid; Source lines gain tier labels |
| Library "Plant Now" | Regex parse of `planting_window` text ([SeedVaultView.tsx:22](../../src/components/SeedVaultView.tsx)) | Prefers `optimal_planting_months_array`; text parse fallback |
| Library refine | Status / type / sowing-month / vendor / sun / spacing... | + Season section + Method section (structured fields only) |
| Couldn't-find UX | Fires on single-attempt not-found | Fires only when ALL tiers fail (unchanged copy, B5 toast + inline notice + Try Again) |

## Files (17)

1. `supabase/migrations/20260611150000_ai_fill_tiered_provenance_when_to_plant.sql` — NEW; all `ADD COLUMN IF NOT EXISTS`
2. `src/lib/researchVariety.ts` — framing preambles, new prompt fields, `researchPlantTiered()` + `buildTierLadder()`, types
3. `src/lib/researchVariety.test.ts` — ladder + framing + new-field tests
4. `src/app/api/seed/enrich-from-name/route.ts` — tags param, multi-tier cache read, tiered AI, provenance + found_level, new fields end-to-end
5. `src/app/api/seed/enrich-from-name/route.test.ts` — tier/provenance/species-cache tests (mock updated to `@/lib/researchVariety`)
6. `src/lib/fillBlanksCache.ts` — `ProfileForFill` + `buildUpdatesFromCacheRow` + `EnrichDataForCache` + `writeEnrichToGlobalCache` gain when-to-plant fields
7. `src/app/api/seed/fill-blanks-for-profile/route.ts` — SELECT widen (+ provenance), forward tags, map new fields, write merged `field_provenance`
8. `src/app/api/settings/fill-in-blanks/route.ts` — profile SELECT + inline cast sync (Ship-1 Pass-3 BLOCKING shape: fourth consumer of the shared helper)
9. `src/lib/enrichProfileFromName.ts` — new fields, provenance merge write
10. `src/types/garden.ts` — `PlantProfile` new fields
11. `src/app/vault/[id]/page.tsx` — SELECT widen (6 new columns)
12. `src/app/vault/[id]/VaultProfileAboutTab.tsx` — When-to-Plant pills + narrative; Source-line tier extension
13. `src/components/SeedVaultView.tsx` — SELECT widen, structured month check, season/method filters + chips
14. `src/app/vault/components/VaultGridRefineModal.tsx` — Season + Method sections (vendor-section pattern)
15. `src/hooks/useFilterState.ts` — `season` + `method` vault filter keys (vendor pattern)
16. `src/app/vault/VaultPageContent.tsx` — wire season/method chips + filters through
17. `docs/plans/ai_fill_overhaul_2026-06-11.md` — this file

## Design decisions (with anchors)

- **D1 — Tier ladder shape.** With variety: Annual+Veg/Herb/Flower → `[variety, combined, species]`; Perennial+Tree/Shrub/Vine → `[cultivar, combined, species]`; all other/untagged tag states → `[variety, combined, species]` when variety present (preserves today's behavior as tier 1 for the untagged-seed common case — a literal "untagged → species only" read of the brief would DELETE variety lookup for every pre-tag profile, a regression the diagnostic never asked for; flagged in report) — except profiles whose tags say non-seed-non-cultivar (e.g. Perennial+Herbaceous canna, fern): `[combined, species]` since "variety of" framing is the exact breakage the brief diagnosed. No variety → `[species]`.
- **D2 — Combined-name tier level = `species`.** "Australian Tree Fern" matched as a whole common name is species-level data for the user's exact plant; caches under the variety identity key (it's specific to name+variety identity), provenance `species`.
- **D3 — Cache-before-AI order is brief-locked:** species cache hit short-circuits variety AI for an unseen variety. Trade-off (variety-level data never researched while species row exists) accepted by brief; `forceRefresh` (explicit AI buttons) bypasses and researches fresh. Flagged in report.
- **D4 — AI null mid-ladder aborts** (returns "AI unavailable"), not a fake not-found — and avoids retry-storm shape from the 2026-06-10 leak audit.
- **D5 — Usage logging per Gemini call:** `researchPlantTiered` returns `attempts`; route logs one `api_usage` row per attempt so the Leak-3 daily ceiling counts true Gemini spend.
- **D6 — Provenance display:** extend the EXISTING Source line ([VaultProfileAboutTab.tsx:286-290](../../src/app/vault/[id]/VaultProfileAboutTab.tsx)) — "Source: AI research (species-level data)" etc.; How-to-Grow + Characteristics get the same line computed from their fields' provenance entries; sentence case (VISION §8 body copy); info-note-adjacent register stays `text-xs text-neutral-500` (existing anchor).
- **D7 — Pills:** anchor = `PillDetailField` pill token (`text-sm font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-900`). Emoji allowed: seasonal/timing markers are **content** per VISION §8 icon-style split ("seasonal markers" named in the content lane); the emoji set (🏠/🌱/🌸) is brief-specified (Syd lock).
- **D8 — Library Method semantics (structured fields only):** Indoors = `indoor_start_weeks_before_frost != null`; Outdoors = `outdoor_plant_weeks_after_frost != null`. No fuzzy `sowing_method` string matching — honest data only; sections hide until data exists (matches vendor-section gating).
- **D9 — `field_provenance` writers merge, never clobber:** writers read the existing map (SELECT widened) and spread `{...existing, ...newEntries}` in the same UPDATE.
- **D10 — Migration:** single file, additive only: 6 columns on `plant_profiles`, 6 on `global_plant_library` (5 when-to-plant + `found_level`). `IF NOT EXISTS` throughout; safe to rerun. Code push depends on schema → BOTH held for greenlight.

---

## Audit log

### Pass 1 — Factual (clean after 1 revision: settings-route inline-cast line range corrected)

- `RESEARCH_PROMPT` + parser at [researchVariety.ts:18-82, 152-231](../../src/lib/researchVariety.ts) ✓; packet path consumes `researchVariety()` via re-export at [extract/route.ts:173,176,446](../../src/app/api/seed/extract/route.ts) — signature preserved, so Path B untouched ✓
- enrich-from-name single-attempt + cache at [route.ts:203-258](../../src/app/api/seed/enrich-from-name/route.ts); `LIBRARY_COLUMNS` single source of truth at `:90-98` ✓; library upsert `:321-374` ✓
- `identityKeyFromVariety(name, "")` yields the bare type key (verified [identityKey.ts:21-28](../../src/lib/identityKey.ts): empty variety → `typeKey`) — species cache key exists without new helper ✓
- `global_plant_library` created in `20250326000000_global_plant_library.sql`; latest migration timestamp `20260611000000` → new file `20260611150000` collides with nothing ✓
- fill-blanks-for-profile: SELECT `:118-126`, `setStr/setNum/setArr` `:283-292`, enrichData construction `:362-381`, tags available on the selected row (`lifecycle, growth_form, plant_category` in SELECT `:122`) ✓
- fill-in-blanks settings route: fourth consumer; profile SELECT `:39` + inline cast `:118-135` must mirror `ProfileForFill` (Ship 1 lesson) ✓
- enrichProfileFromName: single-UPDATE writer, botanical_care_notes read `:218-231` widenable for `field_provenance` ✓
- Profile page SELECT at [vault/[id]/page.tsx:213](../../src/app/vault/[id]/page.tsx) ✓; AboutTab receives the full `profile` object so new fields ride `PlantProfile` ✓; How-to-Grow card hosts the windows grid ([VaultProfileAboutTab.tsx:339-378](../../src/app/vault/[id]/VaultProfileAboutTab.tsx)) ✓
- Library: `isPlantableInMonthSimple` [SeedVaultView.tsx:22-34](../../src/components/SeedVaultView.tsx), profile SELECT `:667`, seed mapping `:807-808`, `sowingMonthChips` `:528-538`; RefineModal section pattern (vendor) [VaultGridRefineModal.tsx:344-379](../../src/app/vault/components/VaultGridRefineModal.tsx); `useFilterState` vault keys [useFilterState.ts:23-29](../../src/hooks/useFilterState.ts) ✓
- route.test.ts mocks `@/app/api/seed/extract/route` (`:23-25`) — switching the route's import to `researchPlantTiered` from `@/lib/researchVariety` requires the mock to move with it ✓ (planned in file 5)
- No modal/menu lifecycle change → bidirectional state-transition matrix N/A (display-only UI + API logic).

### Pass 2 — Concerns hunt (clean after 2 revisions)

Hunt categories named: tier-loop cost/runaway, async ordering, null/empty/zero states, SELECT↔mapping sync, cache poisoning, overwrite-vs-fill semantics, RLS/auth assumptions, type drift (INT[]/TEXT[] vs string), test-mock drift, mobile/desktop split, cohesion-by-aggregation, persona walk.

- **Tier-loop cost:** worst case 3 Gemini calls per POST (vs 1 today). Bounded: ladder ≤3; null aborts; ceiling checked pre-loop; D5 logs per-attempt so the daily ceiling sees true spend. fill-blanks-for-profile's fetch retry (`AI_RETRY_DELAYS=[1500]`) multiplies only on transport errors, not on not-found (200 response) ✓
- **Zero-value INTs:** `outdoor_plant_weeks_after_frost = 0` is meaningful ("at last frost"). Route fill condition for the two week fields uses `p[col] == null` (NOT the `setNum` `=== 0` branch) → revision 1 folded into plan (dedicated null-only setter). Display renders 0 as "at last frost" ✓
- **Cache poisoning:** species-tier write lands ONLY under the species key; variety key never receives species-tagged data without `found_level` saying so. `found:false` still never cached ✓. Legacy library rows (no `found_level`) = exact-match-era variety data → read defaults `variety` for variety-key rows, `species` for species-key rows ✓
- **SELECT↔mapping sync (Ship-1's hazard):** every writer mapping a new field widens its SELECT in the same commit (files 7, 8, 9, 11, 13); `field_provenance` read before merge-write (D9) ✓
- **skipLibrary zone gate:** non-10b users skip BOTH cache keys (existing semantics preserved — windows/months are zone-biased when AI runs with a zone) ✓
- **profile_type derivation:** untouched (`deriveProfileType` path unchanged; ladder result carries lifecycle same as before) ✓
- **Type drift:** `planting_seasons_tags` TEXT[] / `optimal_planting_months_array` INT[] cross three layers (Gemini string CSV → route arrays → Postgres arrays). Route owns parsing (comma-split + int-parse + 1-12 clamp); writers pass arrays through; `extract_data` JSONB stores arrays natively → revision 2: `buildUpdatesFromCacheRow` must accept both array (new writes) and CSV-string (defensive) shapes for the two array fields ✓
- **Test-mock drift:** route.test.ts asserts `researchVariety` called with positional args — rewritten for `researchPlantTiered`; researchVariety.test.ts prompt-contract assertions (`EXACT MATCH ONLY`, `{"found": false}`) still hold for the variety framing ✓
- **Couldn't-find UX:** all consumers key off `found === false` / `notFound` — response contract unchanged on the failure path; success path gains fields only (additive) → no client breakage ✓
- **Persona walk (user-facing surfaces: pills, Source lines, refine sections):** Maya — variety-level data when it exists, species fallback visible not silent; deeper Library filtering ✓. Sydney — pills reuse the exact pill register; Source line extends the line she already knows ✓. Walter — pills are plain words ("Start indoors 6 wk before last frost"), 44px refine rows ✓. Aria — houseplants typically lack frost data → pills simply don't render; no clutter ✓. Sam — empty profiles unchanged; pills appear only when data exists; "Plant Now" gets MORE accurate ✓. No exclusions.
- **Cohesion-by-aggregation:** new visual primitives anchored — pills (D7 → PillDetailField token), narrative paragraph (`text-sm text-neutral-700 whitespace-pre-wrap`, Description-card body register), Source line (D6 → existing line), refine sections (vendor-section markup). Emoji-in-pill is NEW but brief-specified (Syd lock). Log-string format: route keeps `[enrich-from-name]` prefix console.log shape ✓

### Pass 3 — Sibling sweep (clean after 1 revision)

- **BLOCKING (resolved in plan):** `src/app/api/settings/fill-in-blanks/route.ts` profile SELECT + inline cast — fourth consumer of `buildUpdatesFromCacheRow`; widened in same commit (file 8). Same shape as Ship 1's Pass-3 BLOCKING.
- **ADJACENT (no action, pre-existing):** `src/lib/backfillPlantDescriptionsBatch.ts:58` private duplicate of `buildUpdatesFromCacheRow` — already named in Ship 1; unaffected (no hazard: it maps its own narrower set).
- **ADJACENT (no action, pre-existing):** fill-in-blanks settings route's inline AI-mapping block (`:179-233`) is the legacy narrow field set (already missing lifecycle/windows/etc.) — it will also not map the new when-to-plant fields. Pre-existing coverage drift, consolidated-pipeline backlog item (named in Ship 1).
- **Vocabulary breadth:** swept `provenance|found_level|data_source|source_level|field_source` across src/ + migrations — only `description_source` exists (vendor/ai/user, single-field), no competing provenance mechanism ✓. Swept `tier|ladder|fallback` in enrich pipeline — the removed Chunk-A species fallback (`9e9956c`, reverted by `af67c59`) is git history, not live code ✓. Swept `when_to_plant|planting_seasons|optimal_planting|weeks_before_frost` — net-new, no collisions ✓. Swept `Plant Now|sow=` — Calendar's "Plant This Month" home widget uses `zone10b_schedule`+`plantingWindow.ts` (separate, zone-schedule-driven; NOT this pipeline) — left untouched, named here so the split is conscious (CONCERN: two month-match implementations exist app-wide — `isPlantableInMonthSimple` (Library) vs `plantingWindow.ts` (Home/Schedule); pre-existing split, future cohesion ticket).
- **e2e grep:** `grep -rn "Plant Now|Refine|refine" e2e/` → no hits; no existing label assertions touched. New UI strings are net-new (no old-form breakage). ✓

### Pass 4 — Lock hygiene (clean; 1 supersession declared, 1 lock complied)

- **2026-06-10 "NO species-level fallback" (ROADMAP §6):** SUPERSEDED by this brief — declared at top of plan; new §6 entry at close; couldn't-find copy + never-cache-not-found + Try Again all preserved.
- **B5 honesty lock:** preserved — every tier prompt keeps EXACT-MATCH/return-found-false contract at ITS level; no substitution; provenance makes fallback explicit.
- **Three-tag schema lock (2026-06-10):** complied — tags drive framing; tags only written via existing setStr paths (no new tag semantics).
- **Leak-hardening locks (`b9746ff`, 2026-06-10):** no new retry on 429/503 (tier loop is not a retry-on-error loop; null aborts); hero pipeline untouched.
- **Empty-cell convention:** pills/narrative hidden when empty (no "—" for the optional block — it's a section-level optional, matching the existing zone-note pattern). Window rows keep their existing "—".
- **Casing:** "When to Plant" SubHeader = Title Case (existing SubHeader register is uppercase-tracking); pill copy + Source lines sentence case ✓
- VISION §10 don't-touch: none touched (Plantable widget/banner = Home surface, untouched).
- Push tier: schema migration ⇒ explicit greenlight required for `supabase db push` AND the dependent code push. Both held.

## Both-button coverage — Fill Blanks AND AI Overwrite (Syd scope check, 2026-06-11)

Explicit trace confirming both profile AI buttons ride the Ship 2 pipeline — **one shared path, no
three-writers-style divergence; zero code changes needed**:

| Step | Fill Blanks | AI Overwrite |
|---|---|---|
| UI handler | [useVaultEditHandlers.ts:234-238](../../src/app/vault/[id]/useVaultEditHandlers.ts) `{useGemini:true, forceRefresh:true}` | [useVaultEditHandlers.ts:257-261](../../src/app/vault/[id]/useVaultEditHandlers.ts) `{useGemini:true, overwrite:true, forceRefresh:true}` (behind the "Overwrite with AI?" confirm) |
| Route | `/api/seed/fill-blanks-for-profile` — SAME route for both | same |
| Cache bypass | `forceRefresh:true` → skips global_plant_cache AND (forwarded) the library cache — the 2026-06-10 cache-bypass fix, preserved | same |
| Enrichment | route forwards `{name, variety, forceRefresh, tags}` → enrich-from-name → `researchPlantTiered` (one prompt template, one tier ladder, one cache write layer) | same |
| Write semantics | `setStr/setNum/setArr/setWeeks` fill ONLY blank fields (user data wins) | `overwrite ||` branch replaces all AI-fillable fields (user explicitly asked) |
| Provenance | `field_provenance` merge tags every field written this run with the tier | same — runs on `aiUpdates` regardless of the overwrite flag, so replaced fields are RE-tagged at the new tier |
| When-to-Plant fields | fill-on-blank (months: empty-array check; week offsets: null-only — 0 is meaningful) | replace under `overwrite` |

Background import callers (review-import / import page) hit the same route without `overwrite` and
inherit the tier ladder + provenance automatically (profiles untagged at import → untagged ladder).

**Known non-coverage (flagged, unchanged):** (a) the Settings bulk fill-in-blanks route's legacy
inline AI-mapping block won't write when-to-plant/provenance on its AI branch — the pre-existing
ADJACENT from Ship 1 (fill-pipeline consolidation backlog); its cache path DOES carry the new
fields via the shared helper. (b) `user` provenance: a manual edit after an AI fill doesn't clear
the field's AI tag (edit-modal provenance writes scoped out); absence of an entry = never-AI-filled.

**Syd verification path, both flows (post-greenlight + deploy):**
1. **Fill Blanks:** partially-filled profile (some user-entered fields + blanks) → ✨ Fill Blanks →
   user-entered values UNCHANGED, blanks filled, Source lines show the tier for the filled sections.
2. **Overwrite:** fully-filled profile → AI menu → Overwrite with AI? → confirm → AI-fillable fields
   replaced (fresh research — cache bypassed), Source-line tiers updated to the new found level.

## Amendments (declared during Phase 3)

1. **Settings fill-in-blanks SELECT — pre-existing false-blank hazard widened in scope.** During the file-8 edit, found the route's profile SELECT missing 5 fields `buildUpdatesFromCacheRow` ALREADY maps (`propagation_notes, seed_saving_notes, seed_propagation_context, companion_plants, avoid_plants`) — live user-data-overwrite hazard (same class Ship 1 fixed for mature dims; predates this ship). Re-audit: Pass 1 confirmed mapping-vs-SELECT mismatch; Pass 2 confirmed fix = SELECT + inline-cast widening only, strict-bug class. Folded in alongside the 5 new fields.
2. **Build fix:** the widened settings SELECT was first written as a concatenated string expression, which defeats supabase-js's static type inference (`GenericStringError`) — reverted to a single string literal. (The seed fill-blanks route tolerates concatenation because it casts the row; the settings route filters typed rows directly.)
3. **Pill copy:** `outdoor_plant_weeks_after_frost` can be negative (cold-hardy crops sown before last frost) — pill renders "Plant outside N wk before last frost" for negatives; 0 renders "at last frost".

## Phase 4 results (2026-06-11)

- `npm run test:run` → **636/636 pass** (was 623 on main; +13 new tests: 6 ladder/framing, 4 tiered-retry, 2 route provenance/tags, 1 prompt-fields contract).
- `npm run build` → compiled clean.
- e2e grep → no existing assertions on touched labels; new UI strings net-new.
- Preview screenshot skipped per brief constraint (no screenshots; profile surfaces auth-blocked; core is API logic).
- Acceptance criteria 1–7 individually verified (see commit).
- **Pushes HELD:** migration (`supabase db push`) + code push both await Syd greenlight (schema ship — no auto-push tier). Apply order: migration FIRST, then code push (widened SELECTs reference the new columns).

## Verification plan

- `npm run test:run` + `npm run build` in worktree (Phase 4).
- No screenshots per brief constraint; no preview run (auth-blocked profile surfaces + API-logic core).
- Syd dogfood path (post-greenlight, post-deploy): documented in the close report (canna/fern flow).
