# Sprint 6 — AI Fill quality bundle (Findings #15, #18, #22)

**Date:** 2026-06-13
**Worktree/branch:** `worktree-sprint6-ai-fill-quality` (isolated, off origin/main `b6fdf2b` — which has the enrichment_version ship `48e5baf` + `/library` rebrand `d6cf9ad`).
**Source:** Dispatch brief (greenlit Syd 2026-06-13, blanket greenlight on sequenced ship plan). Design memory files (`agent/memory/gt-*.md`) are Dispatch-side, not in repo — brief restated inline = spec.
**Builds on:** enrichment versioning (`48e5baf`, version-aware Fill Blanks, `CURRENT_AI_FILL_VERSION=1`).

---

## Purpose

Finish the encyclopedia-content story before testers: make AI Fill produce (a) a **rich Growing Notes narrative** (#15), (b) a **fully-populated Plant Characteristics** section (#18), and (c) **deeper Propagation + How-to-Save-Seeds** content (#22). All three are primarily **prompt-content + write-path** fixes — the render scaffolding already exists (Sprint 4 Chunk B is live on origin/main).

## In-scope
- `src/lib/researchVariety.ts` — strengthen the shared Gemini field-list prompt (growing_notes, propagation_notes, seed_saving_notes, + a modest intrinsic-characteristics nudge).
- `src/lib/enrichProfileFromName.ts` — bring the **creation-time** writer to field-parity with the fill-blanks route (the real #18 plumbing gap).
- `src/lib/ai-fill/version.ts` — bump `CURRENT_AI_FILL_VERSION` 1 → 2 + bump-rationale comment.
- `src/lib/researchVariety.test.ts` — add prompt-contract assertions for the strengthened fields.
- Docs: ROADMAP §5 + §6 (bump rationale + honesty-adjacent prompt nudge).

## Out-of-scope (counter-creep guard)
- No schema/migration (the `enrichment_version` column already exists on prod). No RLS/auth.
- No render/IA restructure of the Propagation card (the "promote How-to-Save-Seeds to a top-level section" question is an **aesthetic ask** — surfaced to Syd, not decided here).
- `src/app/api/settings/fill-in-blanks/route.ts` narrow path — known ADJACENT (D-WRITER4); not expanded this ship.
- `global_plant_cache` (vendor) coverage — out of scope.

## Success criteria
- New/re-filled profiles produce a multi-paragraph Growing Notes narrative; Sun/Water stay short-form pills (Syd lock 2026-06-11).
- A freshly-created profile (Quick Add / Add Plant / sow-new-variety) shows a populated Plant Characteristics section without a manual second "Fill empty cells".
- Propagation + seed-saving narratives come back with practical depth (not condensed).
- `CURRENT_AI_FILL_VERSION = 2` so v1 profiles/library rows self-heal on next touch.
- `npm run test:run` green (incl. new prompt-contract assertions); `npm run build` clean.

---

## Root-cause analysis (Pass-1 verified)

**#15 — Growing Notes thin.** Render has a "Growing Notes" `SectionCard` ([VaultProfileAboutTab.tsx:411](src/app/library/[id]/VaultProfileAboutTab.tsx)) that **borrows `plant_description`** when `growing_notes` is empty. Cause: the `growing_notes` field instruction is weak — *"optional short … if easily found; otherwise empty string"* ([researchVariety.ts:60](src/lib/researchVariety.ts)). Model rarely fills it → section shows the 2–4-sentence appearance description, not a how-to-grow narrative. **Fix = prompt.**

**#18 — Characteristics not filling. TWO causes:**
1. **Plumbing gap (real bug).** The creation-time writer `enrichProfileFromName.ts` maps only a thin subset of fields and never writes `growth_form, plant_category, growth_habit, soil_preference, disease_susceptibility, pollination_requirements, toxicity, deer_rabbit_resistance, wildlife_value, invasiveness, native_origin, drought_salt_tolerance, synonyms, uses, special_features, family, genus, species, harvest_season, sun_summary/detail, water_summary/detail, propagation_method, planting_depth, season windows`. So a freshly-created profile has an empty Characteristics section until the user manually hits "Fill empty cells" (the fill-blanks route DOES write the full set — [fill-blanks-for-profile/route.ts:344-370](src/app/api/seed/fill-blanks-for-profile/route.ts)). Verified: display SELECT ([page.tsx:215]) carries every column; render reads them ([VaultProfileAboutTab.tsx:435-453]); enrich-from-name response forwards them ([enrich-from-name/route.ts:401-419]). The ONLY break is the creation writer. **Fix = writer parity.**
2. **Content permissiveness.** Each characteristic says *"Use empty string if not found"*, so the model defaults intrinsic encyclopedic facts (family/genus/species/native_origin/toxicity) to empty. **Fix = modest prompt nudge for stable taxonomic fields only** (see Pass 4 — honesty-adjacent).

**#22 — Propagation regression + seed saving.**
1. **Regression.** `propagation_notes` instruction is thin ([researchVariety.ts:69]) → AI returns condensed prose; the version-aware re-fill then replaced a richer prior value with the thin one. **Fix = prompt depth.**
2. **Seed saving.** `seed_saving_notes` already renders — nested in the Propagation card as "How to Save Seeds" / "Starting from Seed & Saving Seeds" ([VaultProfileAboutTab.tsx:619-660]). Field instruction is thin ([researchVariety.ts:71]). **Fix = prompt depth.** The "dedicated top-level section" structural change is an **aesthetic ask** (deferred).

**Version bump.** All three are pipeline changes that make v1 output materially staler → bump to 2 so legacy profiles self-heal (blank + AI-provenanced fields re-fill via `isFieldFillEligible`; user/vendor data preserved) and v1 library rows are treated as cache-miss → re-researched. Matches the documented bump convention ([version.ts]).

---

## Prompt changes (researchVariety.ts FIELD_LIST)

1. **growing_notes** → rich how-to-grow narrative: synthesize light + watering practice in depth, soil prep/amendments, spacing/support, feeding, pest/disease watch, season-specific care; plain practical prose, one+ paragraphs; empty only if no growing guidance found.
2. **propagation_notes** → detailed how-to-propagate: for the applicable method(s) explain WHEN, the step-by-step technique, success tips; preserve depth; empty only if not home-propagable / not found.
3. **seed_saving_notes** → detailed how-to-save-seeds: harvest timing/ripeness cues, wet vs dry cleaning, drying, storage conditions, viability/longevity, isolation note if it cross-pollinates; preserve depth; empty only if not seed-grown / not found.
4. **Characteristics intrinsic nudge** (lead-in line before the Characteristics block): for the well-established taxonomic/intrinsic facts (family, genus, species, native_origin, toxicity, pollination_requirements — plus lifecycle/growth_form/plant_category above), give the best authoritative answer from general botanical knowledge even if the source page doesn't list it (they don't vary by seed brand); empty only when genuinely unknown. **Does NOT touch the found/not-found honesty gate** (see Pass 4).

Sun/Water pill + short-detail fields **unchanged** (Syd lock — Sun/Water stay short-form; the deep explanation lives in growing_notes).

## Writer-parity change (enrichProfileFromName.ts)

Expand the local `EnrichFromNameResponse` type + the `updates` mapping to cover the same field set the fill-blanks route writes (string fields via `!= null`, array fields via `Array.isArray && length>0`), matching the established unconditional-at-creation pattern already used for `sun/water/lifecycle`. Provenance loop already tags every written key (lines 261-264) → new fields get tagged automatically. `growing_notes` keeps its existing `existingGrowingNotes`-empty guard.

## Version bump (version.ts)

`CURRENT_AI_FILL_VERSION = 2`; append a bump-log line documenting "Sprint 6 prompt enrichment (growing-notes/propagation/seed-saving depth + characteristics fill) — v1 output is materially thinner; re-enrich on next touch."

---

# AUDIT LOG

## Pass 1 — Factual (verified by direct read against worktree base `b6fdf2b`)

- `FIELD_LIST` single template string [researchVariety.ts:47-110]; `buildResearchPrompt`/`RESEARCH_PROMPT` derive from it; all three framings + the tiered ladder reuse it → one edit covers every AI-fill path (enrich-from-name, extract, scrape research, fill-blanks via enrich, backfill scripts). ✓
- growing_notes:60, propagation_notes:69, seed_saving_notes:71, characteristics block:88-108 all exist as described. ✓
- `enrichProfileFromName` updates mapping [enrichProfileFromName.ts:195-231] confirms the missing fields; local `EnrichFromNameResponse` type [40-69] is the narrow subset. Provenance loop [261-264] iterates `Object.keys(updates)` skipping meta keys. ✓
- fill-blanks-for-profile writes the full set via `setStr`/`setArr` [route.ts:320-393]; enrich-from-name forwards the full set [route.ts:371-427]; display SELECT [page.tsx:215] + render reads [AboutTab:435-453] all carry the columns. End-to-end wired except the creation writer. ✓
- `CURRENT_AI_FILL_VERSION` consumers: version.ts, fill-blanks-for-profile:13/405, enrich-from-name:14/301/442, enrichProfileFromName:9/197, version.test.ts. All use it as "current generation" → bump consistent everywhere. ✓
- `version.test.ts` is **bump-ready**: lines 38-47 branch on `CURRENT > 1` (exercises v1-as-legacy self-heal) with the `expect(CURRENT).toBe(1)` only in the `else`; LEGACY=0 < CURRENT=2 keeps every other assertion valid → **passes unmodified at v2**. No edit needed. ✓
- No modal/menu lifecycle change → bidirectional state-transition matrix N/A (pure server-lib + prompt; no React state machine). ✓

## Pass 2 — Concerns hunt

Hunt categories: user-data-loss / overwrite, honesty-contract regression, prompt-token bloat, model-confabulation risk, write-path parity correctness, version-bump blast radius, cohesion-by-aggregation, persona walk, test coverage, e2e scope.

- **User-data-loss:** version bump self-heal re-fills only **blank** or **AI-provenanced** fields (`isFieldFillEligible`); user-typed/vendor/no-provenance fields preserved (item-6 invariant, unit-tested). `enrichProfileFromName` runs at **creation on new (blank) profiles** — the new unconditional writes land on empty fields, matching the existing sun/water pattern; growing_notes keeps its empty-guard. **No data-loss.** ✓
- **Honesty-contract regression:** the EXACT-MATCH-ONLY found/not-found gate ([PREAMBLES], unchanged) still decides whether ANY data is returned. The characteristics nudge only loosens the **field-level** empty-default for stable taxonomic facts *within a found:true result*, and provenance still records the match tier. Surfaced to Syd (Pass 4) since it's adjacent to the 2026-06-10 lock. Prompt-contract test still asserts `EXACT MATCH ONLY` + `{"found": false}` survive. ✓
- **Confabulation risk:** nudge scoped to family/genus/species/native_origin/toxicity/pollination — encyclopedic, low-hallucination for real plants. Explicitly NOT applied to variable fields (disease_susceptibility, wildlife_value, companion_plants) which keep "empty if not found". ✓
- **Prompt-token bloat:** three field instructions grow ~2-4 lines each + one lead-in line. Negligible vs the 60-line field list; no maxDuration concern (single Gemini call per tier, unchanged). ✓
- **Write-path parity correctness:** new `enrichProfileFromName` fields mirror fill-blanks types exactly (string vs string[]); array guard `Array.isArray && length>0` matches. Verified column names against the display SELECT to avoid a write-to-nonexistent-column 500. ✓
- **Version-bump blast radius:** every v1 profile/library row re-researches on next touch → AI spend. Intended self-heal; gated by the existing per-user daily ceiling + rate limit. v1 population is ~1 day old (shipped today) → tiny. Pre-authorized by the brief. Flagged in handoff. ✓
- **Cohesion-by-aggregation / micro-aesthetic:** no new UI tokens, colors, thresholds, copy strings, or render changes. Prompt prose follows the existing field-instruction register; bump comment follows the existing version.ts comment register; ROADMAP entry follows §5 format. No un-anchored micro-decision. ✓
- **Persona walk (content-quality change, no UI surface change):** Maya — richer depth on every profile, no hand-holding added ✓. Sydney — Growing Notes reads coherently with the existing card ✓. Walter — plain-language prose, no jargon mandate added beyond practical care ✓. Aria (houseplants) — seed-saving/propagation stay empty-if-not-applicable; characteristics like toxicity/native_origin are exactly what an indoor grower wants ✓. Sam — fuller profile on first add, no new controls to learn ✓. No persona excluded. ✓
- **Test coverage:** add prompt-contract assertions (growing_notes "narrative", propagation/seed_saving depth keywords, characteristics intrinsic lead-in) + assert honesty-contract phrases survive. `isFieldFillEligible` suite already covers the bump. ✓

## Pass 3 — Sibling pattern sweep

- **AI-fill writer siblings (all paths that persist enrichment):**
  - `researchVariety.ts` FIELD_LIST — the single shared prompt; one edit covers enrich-from-name, extract, scrape research, backfill scripts. **BLOCKING-resolved:** edit at the source so every consumer benefits (no per-route prompt drift).
  - `enrich-from-name/route.ts` — forwards full field set ✓ (no change needed; already complete).
  - `fill-blanks-for-profile/route.ts` — writes full set ✓ (the parity TARGET; no change).
  - `enrichProfileFromName.ts` — **the lagging sibling** → brought to parity (file 3).
  - `settings/fill-in-blanks/route.ts` — narrow set (growing_notes/propagation/seed_saving only, no characteristics) → **ADJACENT**, known D-WRITER4 gap; not fixed this ship, logged.
- **Prompt-builder siblings:** grepped for other Gemini prompt strings (`generateContent`, `RESEARCH_PROMPT`, `buildResearchPrompt`, `Extract the following`) — `researchVariety.ts` is the single field-list source; find-hero-photo/extract use their own image/vision prompts (different concern, untouched). ✓
- **Vocabulary breadth** (enrichment/fill/populate/depth): grepped `growing_notes|propagation_notes|seed_saving_notes|enrich|fill-blanks|FIELD_LIST` across `src/` — covered above; no hidden 4th writer of these fields. ✓
- **e2e scope:** this ship changes NO user-facing label strings (prompt prose is server-side; no UI copy/button/header change). Grepped `e2e/` for `Growing Notes|Characteristics|Propagation|Save Seeds|Fill` — specs assert on existing section labels unchanged by this ship; e2e never triggers live Gemini so prompt prose is inert in tests. ✓
- **Persona-mismatch sub-check:** the existing Characteristics/Propagation render serves all 5 personas; no persona-exclusion introduced. ✓

## Pass 4 — Lock hygiene

- **EXACT-MATCH-ONLY honesty lock (ROADMAP §6, Syd 2026-06-10):** the found/not-found gate is **untouched**. The characteristics intrinsic-nudge is field-level (within found:true) and provenance-tagged → consistent with the lock's intent (no variety-fabrication; no species-data masquerading as variety data). **Surfaced to Syd as a noted decision** (Ask 2) given adjacency — not silently overstepped.
- **Enrichment versioning bump convention ([version.ts]):** "bump only when a pipeline change makes prior output materially stale." The prompt enrichment qualifies (v1 output is thinner). Compliant; rationale documented in code + ROADMAP §6.
- **NORTH_STAR §2 (clear empty beats misleading filled):** preserved — variable fields keep "empty if not found"; only stable encyclopedic facts get the fill-nudge.
- **Push tiers (CLAUDE.md, 2026-06-07 relaxed):** prompt + lib + test only; **no schema/migration, no RLS/auth, no data-loss** → **auto-push tier** after clean Phase 4. Re-research-cost blast radius is the intended self-heal (brief-authorized) → not "risky" per the favor-caution clause. Pre-push visual check **skipped** (pure server-lib/non-rendering per the rule's documented skip).
- **Casing / icon / emerald / empty-cell conventions:** N/A — no UI strings, icons, buttons, or cells changed.
- **VISION §10 don't-touch / §11 parked:** none touched (no contexts, nav, Home widget).

**Audit status: clean.** One honesty-adjacent prompt nudge surfaced to Syd (Ask 2); one aesthetic deferral surfaced (Ask 1). Both non-blocking for the content/plumbing fixes.

---

## Verification plan (Phase 4)
- `npm run test:run` — full suite + new prompt-contract assertions; `isFieldFillEligible` suite green at v2.
- `npm run build` — type-check the expanded `EnrichFromNameResponse` + writer mapping.
- No Preview/screenshots (server-lib/non-rendering; brief constraint).
- Auto-push tier; then ROADMAP §5/§6 doc commit.

## Asks (surfaced to Syd / Dispatch)
1. **(Aesthetic) How-to-Save-Seeds placement.** It already renders nested inside the Propagation card and adapts to method. Recommend **keep nested + let the richer prompt fill it** (Recommended — lowest-risk, no new IA primitive). Alternative: promote to a standalone top-level section card (more prominent, but a new section primitive + scroll-anchor). Shipping the content fix now either way.
2. **(Honesty-adjacent) Characteristics intrinsic-fill nudge.** Recommend **yes, scoped to stable taxonomic facts only** (family/genus/species/native_origin/toxicity/pollination) — consistent with the found/not-found lock, fixes the "—everywhere" Characteristics complaint. Alternative: plumbing-only (writer parity) with the prompt left fully permissive (safer re: confabulation, but Characteristics stays sparse for plants whose source page omits these facts).
