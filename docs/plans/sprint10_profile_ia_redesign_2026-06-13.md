# Sprint 10 — Plant Profile Information Architecture Redesign

> Plan-doc + 4-pass audit. Worktree `sprint10-profile-ia` based off `origin/main` @ `af05aac`.
> Greenlit by Syd 2026-06-13 ("take the wheel" on profile IA). Replaces original Sprint 10 (filter cleanup → Sprint 11).

---

## Purpose (one sentence)

Re-architect the Library plant-profile About tab into the locked card order (At a Glance → When to Plant → How to Grow → Seed Starting → Pest+Disease → Harvest → Companion → Characteristics Deep-Dive → Propagation → Growing Notes), declutter How to Grow to pills-only, split Seed Starting out of Propagation, section Growing Notes with bolded subheads, enforce pill-consistency, and update the AI Fill prompt (`researchVariety.ts`) + bump `CURRENT_AI_FILL_VERSION` 2→3 so the new structure self-heals on next AI touch.

## In-scope / Out-of-scope / Success criteria

- **In-scope:** `src/app/library/[id]/VaultProfileAboutTab.tsx` (display rewrite), `src/app/library/[id]/page.tsx` (collapse default + At-a-Glance data + Mature-Size helper), `src/lib/researchVariety.ts` (prompt), `src/lib/ai-fill/version.ts` (bump 2→3).
- **Out-of-scope:** Sprint 11 filter cleanup; Finding #50 hardiness-zone schema + viability banner (coordinate only); any new DB column; edit-form changes.
- **Success criteria:** profile renders the 10-card order; Characteristics collapsed by default; Growing Notes sectioned (parser handles v3 + legacy fallback); Seed Starting card split from Propagation; pills consistent; v3 prompt emits sectioned Growing Notes + all propagation methods; tests + build green; auto-push (no schema/RLS/auth).

## Brief-vs-canon corrections found during recon (per feedback_verify_brief_vs_locked_canon)

1. **Path:** brief said `src/app/library/[id]/VaultProfileAboutTab.tsx` — correct for `origin/main` (vault→library rename already landed). My base checkout was stale (`vault/[id]`); the worktree off origin/main has the right paths.
2. **Version constant:** brief said bump in `researchVariety.ts` — wrong; `CURRENT_AI_FILL_VERSION` lives in `src/lib/ai-fill/version.ts`. Bumping the correct file.
3. **fill-blanks-for-profile/route.ts:** brief listed it as a prompt-edit target — it is NOT; it only maps returned JSON→DB columns. The Gemini prompt lives solely in `researchVariety.ts` (`FIELD_LIST`). No fill-blanks change needed unless a new column is added (render-split avoids that).
4. **Sun/Water narrative removal (#51):** ALREADY DONE on main (`af05aac` dropped `sun_detail`/`water_detail` from display + props). Display side complete. Prompt still asks for them (see Layer B decision).
5. **Germination conflict:** Sprint 8 Findings #43–46 deliberately *removed* `days_to_germination` from the profile ("seed-lot-specific → Seed Packet detail", page.tsx:700-701). The brief's Seed Starting card re-adds it. Following the newer explicit IA redesign; **flagging to Syd**.
6. **Hardiness Zones pill:** columns `hardiness_zone_min/max` do not exist yet (Finding #50 in flight, not on main). Deferring that one At-a-Glance pill; wiring left as a #50 coordination seam.

---

## Layer A — Display (`VaultProfileAboutTab.tsx` + `page.tsx`)

### Locked card order (rewrite the return body)

| # | Card | Default | Conditional | Content |
|---|------|---------|-------------|---------|
| 1 | **At a Glance** (NEW) | open | `!isLegacy` | `plant_description` + quick-stats pill row: Lifecycle · Growth Form · Plant Category · Mature Size (`mature_height`×`mature_width` combined). Hardiness Zones pill deferred (#50). |
| 2 | **When to Plant** | open | has timing data | Lift the existing When-to-Plant IIFE (pills + narrative) out of How to Grow verbatim into its own card. Viability banner ("Not viable in Zone…") + "Generated for Zone…" lines move here. |
| 3 | **How to Grow** (decluttered) | open | always | Pills ONLY: Spacing, Sun, Water, Soil, Days to Maturity (edible). Narratives → Growing Notes. Removed: sowing fields, planting window, disease, harvest, uses, special-features, when-to-plant block. |
| 4 | **Seed Starting** (NEW) | open | `!hideSowingFields` (seed-propagatable) | Pills: Sowing Method, Sowing Depth, Planting Depth, Days to Germination + short templated how-to line. |
| 5 | **Pest + Disease** | open | `!isLegacy` | `disease_susceptibility` pills. |
| 6 | **Harvest** | open | `isEdible` | `harvest_season` pills. |
| 7 | **Companion Planting** | open | always | unchanged (plant-with / don't-plant-with). |
| 8 | **Characteristics Deep-Dive** | **COLLAPSED** | `!isLegacy` | Growth Habit, Family, Genus, Species, Native Origin, Invasiveness, Toxicity, Wildlife Value, Pollination, Deer/Rabbit, Drought/Salt, Synonyms, Uses, Special Features. |
| 9 | **Propagation** (advanced) | open | `!isLegacy` | Method pills + non-seed method notes (`propagation_notes`) + `seed_saving_notes`. Seed-starting content removed (now card #4). |
| 10 | **Growing Notes** (BOTTOM) | open | has notes/desc | Sectioned render: parse known labels (Soil / Watering / Feeding / Pruning & Training / Pests & Disease) into bold-prefixed paragraphs; fallback to single whitespace-pre-wrap block for legacy (v2) data. |

Followed by existing trailing blocks (Source URL, Growth Gallery, legacy). Description card (current #1) is folded into At a Glance — no separate Description card.

### Pill consistency rule (applied across all cards)

- Pill = short categorical value (1–3 words): bold inside `bg-neutral-100 rounded-full` (existing `PillDetailField pill` primitive).
- Plain text = narratives / sentences / lists.
- Toxicity + Wildlife Value render as **plain text** (not pills) — already correct in current code (lines 463-464, no `pill`). Keep.

### page.tsx changes

- **Collapse default (line 165):** `useState<Record<string, boolean>>({ characteristics: true })` — Characteristics Deep-Dive collapsed by default. (Shared with Care tab but keys are disjoint.)
- **At-a-Glance Mature Size helper:** compose `mature_height`/`mature_width` → "{h} tall × {w} wide" / single / "—". Pass to About tab (new prop `matureSize` OR compute in-component from `profile`). Decision: compute in-component (profile already passed) — no new prop.
- No prop-signature churn beyond what At a Glance needs (compute from `profile` in-component).

### Growing Notes parser (new, in `VaultProfileAboutTab.tsx`)

```
SECTION_LABELS = ["Soil", "Watering", "Feeding", "Pruning & Training", "Pests & Disease"]
parseGrowingNotes(text): split on /^(Label):/m boundaries → [{label, body}] | null (no labels found)
render: if parsed → each as <p><span font-semibold>{label}:</span> {body}</p>; else → current single block.
```
Dep-free. Graceful for legacy v2 single-narrative data (renders as-is until self-heal).

---

## Layer B — AI Fill prompt (`researchVariety.ts` `FIELD_LIST`) + version bump

1. **growing_notes:** rewrite the field instruction to require the 5 labeled sections with these exact labels, each label followed by a colon, sections separated by blank lines: `Soil:`, `Watering:`, `Feeding:`, `Pruning & Training:`, `Pests & Disease:`. Keep depth (3-4 sentences each). This is the parser's contract.
2. **propagation_method:** strengthen to require ALL viable methods, not just the primary (e.g. Tomato → "Seed, Cutting"). Already multi-value-capable; add explicit "list every method a home gardener could realistically use."
3. **propagation_notes:** keep 2-3 sentences per NON-SEED method (not a tutorial). Reword to "brief 2-3 sentence note per method" — seed-starting how-to no longer belongs here (now its own card sourced from structured fields).
4. **Seed Starting:** no new prompt field (render-split). Structured fields (`sowing_method`/`sowing_depth`/`planting_depth`/`days_to_germination`) already in prompt — unchanged.
5. **sun_detail / water_detail:** leave in the prompt + result type (harmless; not rendered). NOT removing — removing touches `ResearchVarietyResult` + mapping + `researchVariety.test.ts` contract for zero display benefit. Growing Notes "Watering:" section now carries the depth that #51 removed from the Sun/Water pills. (Tactical call — minimal surface.)
6. **`CURRENT_AI_FILL_VERSION` 2 → 3** in `src/lib/ai-fill/version.ts` + add a v3 BUMP LOG entry (sectioned Growing Notes + all-methods Propagation → v2 output materially restructured → v2 profiles self-heal on next AI touch). Update `version.test.ts` if it asserts the literal `2`.

---

## Seed Starting: render-split vs dedicated column (decision)

**Decision: render-split, NO new column → ship stays auto-pushable.**
- Seed Starting card = existing structured fields (sowing method/depth/planting depth/germination) + a short templated how-to line.
- Rationale: brief prefers no-schema ("if rendering split works, skip schema migration"); a dedicated `seed_starting_notes` column is a schema migration = HOLD-for-greenlight = blocks the whole auto-push bundle.
- **Follow-up (Rule A ask to Syd):** a dedicated `seed_starting_notes` column + prompt field would give richer AI seed-starting prose (germination temp, hardening-off) that structured fields can't express. Recommended as a fast-follow once Syd sees the card structure on her phone.

---

## 4-PASS AUDIT

### Pass 1 — Factual (verified via Read/Grep in worktree)

- `VaultProfileAboutTab.tsx` exists at `src/app/library/[id]/` on main ✓. `PillDetailField`, `SectionCard`, `SubHeader`, `joinWithOr`, `METHOD_PHRASES`, `sectionProvenanceLevels`, `ProvenanceSourceLine` all defined in-file ✓.
- `isEdiblePlant` imported from `@/constants/seedTypes` (line 9) ✓; `isHouseplant`/`isEdible` computed (lines 328-329) ✓.
- `propagationMethods`, `nonSeedMethods`, `hasSeedMethod` computed in-component (322-324) ✓.
- page.tsx: `aboutCollapsed` state (165), `isAboutOpen`/`toggleAboutSection` (166-167), `howToGrowList` (712-721), `sunPill`/`waterPill` (724-725), `growingNotes` (727), `hideSowingFields` (711), `isPerennialWoody` (705) ✓.
- `mature_height`/`mature_width`/`lifecycle`/`growth_form`/`plant_category`/`plant_description` all on `PlantProfile` (src/types/garden.ts) ✓ (Explore map confirmed).
- `CURRENT_AI_FILL_VERSION = 2` at `src/lib/ai-fill/version.ts` ✓; consumed by enrich-from-name + fill-blanks + page.tsx + version.test.ts ✓.
- `days_to_germination` column exists + AI-filled; NOT currently displayed (Sprint 8 removal) ✓.
- `hardiness_zone_min/max` + `seed_starting_notes` columns: confirmed ABSENT ✓ → no schema reference will compile-error (I will NOT reference them).
- The Gemini prompt is only in `researchVariety.ts` `FIELD_LIST`; fill-blanks delegates to enrich-from-name → researchVariety ✓.

**Bidirectional state-transition trace (Pass 1 subcategory):** Collapse state machine. The only state change is `aboutCollapsed[characteristics]` default true → toggle. Trace: initial render (characteristics collapsed, others open) → tap header → `toggleAboutSection("characteristics")` flips to open → tap again → collapsed. No lazy-mount / Suspense / forward-back screens involved (single-component, synchronous `useState`). Care tab shares `aboutCollapsed` but uses disjoint keys (schedule keys), so seeding `{characteristics:true}` cannot collapse a Care section. Matrix cells (open/close × reconcile) both traced clean. ✓ No async/Suspense axis present.

### Pass 2 — Concerns / gaps / inconsistencies hunt

Hunt categories (code batch): null/empty/many states · conditional-render correctness · provenance Source-line re-bucketing · anchor-pill coherence · cohesion-by-aggregation (micro-aesthetic) · persona walk · legacy-profile path · enrichment-loading skeleton interaction · parser robustness.

- **Empty/many states:** Each new card guards on its data — At a Glance shows "—" via `PillDetailField` for empty stats; Pest+Disease / Harvest render "—" when empty (PillDetailField). Harvest gated on `isEdible`, Pest+Disease on `!isLegacy`. Seed Starting gated on `!hideSowingFields`. When-to-Plant returns null when no timing data (existing IIFE behavior preserved). ✓
- **Compound conditional (per feedback_compound_conditional_pass2):** Seed Starting visibility `!hideSowingFields` where `hideSowingFields = (propMethods.length>0 && !hasSeedMethod) || (isPerennialWoody && !hasSeedMethod)`. Traced: seed annual (propMethods=["Seed"]) → hideSowingFields=false → card shows ✓. Woody perennial grafted (propMethods=[], isPerennialWoody) → hide ✓. Hosta (propMethods=["Division"], no Seed) → hide ✓. `hideSowingFields` is computed in page.tsx; Seed Starting card lives in About tab → must pass `hideSowingFields` (or `hasSeedMethod`+`isPerennialWoody`) as a prop. **Action: add `showSeedStarting` boolean prop** computed in page.tsx (single source of truth, mirrors howToGrowList gating). Avoids recomputing the compound conditional in two places (which would risk drift).
- **Provenance Source lines:** `HOW_TO_GROW_PROVENANCE_FIELDS` currently bundles sun/water/soil/disease/harvest/etc. After the split these fields scatter across How to Grow / Pest+Disease / Harvest / Seed Starting. Re-bucket into per-card field lists so each card's Source line is accurate. Keep CHARACTERISTICS list (minus mature_height/width which move to At a Glance). At a Glance gets its own small provenance list (lifecycle/growth_form/plant_category/mature_*). Low-risk, mechanical.
- **Anchor pills (cohesion-by-aggregation):** Current sticky anchors = Characteristics/How to Grow/Companion/Propagation. Anchoring to now-collapsed Characteristics is odd. **Decision:** repoint anchors to follow new card order, 4 pills max (matches existing count): At a Glance · How to Grow · Companion · Growing Notes. `about-section-*` ids move to those cards. Anchor mechanism + scroll-spy unchanged. **Anchor cite:** existing 4-pill GroupTabs register (lines 406-436). Flagged for Syd dogfood (anchor set is a visible choice).
- **Bolded-subhead micro-aesthetic:** render `<span className="font-semibold text-neutral-700">{label}:</span> body`. **Anchor:** matches existing in-card bold register (SectionCard `<h3>` is `font-semibold text-neutral-700`; SubHeader is uppercase-tracking). Using inline `font-semibold` per the brief's `**Soil:**` sketch. Documented; not a new token.
- **Mature Size format string:** "{h} tall × {w} wide". `×` is U+00D7 multiplication sign (not letter x). New micro-string — **anchor:** no exact peer; flag for Syd (low-risk copy). Em dash "—" when both empty per locked empty-cell convention.
- **Enrichment-loading skeleton:** current `enrichmentLoading` wraps Description+How-to-Grow in a skeleton group + `enrichmentBlankLoading` hint. The reorg changes which cards exist. Keep the skeleton group (Description→At a Glance title; How to Grow stays). The else-branch wraps the contiguous AI block; Propagation stays outside it (documented tail, unchanged). Verify the `enrichmentLoading ? <skeleton> : <>…</>` wrapper still brackets the new card set correctly. ✓ (rewrite preserves the wrapper).
- **Parser robustness:** legacy v2 growing_notes (single narrative, no labels) → parser returns null → fallback single block (no crash, no empty render). v3 sectioned → parsed. Partial/malformed (some labels) → renders found sections + any leading unlabeled text as an intro paragraph. Handle gracefully (no throw). ✓
- **Persona walk:** Maya (power) — Characteristics collapsed by default = fewer taps to the care info she wants; deep-dive one tap away ✓. Sydney (hobbyist) — coherent card order, scannable pills ✓. Walter (retiree, iPad) — bigger scannable sections, plain language, 44px headers preserved ✓. Aria (houseplant) — Seed Starting hidden for non-seed houseplants (`hideSowingFields`), Harvest hidden (not edible), Pest+Disease still shows ✓; At a Glance Mature Size relevant ✓. Sam (beginner) — At a Glance gives the one-glance summary first; depth disclosed below ✓. All 5 served.

### Pass 3 — Sibling pattern sweep

- **PillDetailField reuse (per feedback_reuse_existing_components):** all new pill rows use the existing `PillDetailField` primitive — no new pill shape. BLOCKING-clean (reusing canonical primitive).
- **SectionCard reuse:** all new cards use `SectionCard` — same rounded-xl/border/44px-header shape. ✓
- **Sibling renderers of the moved fields:** Explore map confirms `propagation_notes`/`seed_saving_notes`/`growing_notes` render ONLY in `VaultProfileAboutTab.tsx` within the profile surface (other sites are AI-write / import-preview / edit-form / cache — none render the profile About tab). Import-preview (`vault/import/page.tsx`) + review-import + AddPlantModal show growing_notes in a textarea/preview, NOT the sectioned profile render → unaffected by the parser (they show raw text, which is fine). **ADJACENT (no action):** once v3 sectioned growing_notes lands, the import-preview textarea will show the raw `Soil: …` labels — acceptable (it's an editable raw field). Logged, not fixed this ship.
- **Growing Notes edit form:** `useVaultEditHandlers.ts` edits `growingNotes` as raw text — user editing a v3 sectioned note edits raw labeled text. Acceptable (power-user edit). ADJACENT, logged.
- **E2E sweep (per Pass 3 e2e-scope sub-rule):** this ship flips card *titles*/adds cards. Grep `e2e/` for assertions on About-tab card titles ("How to Grow", "Propagation", "Plant Characteristics", "Growing Notes", "Description") — see Pass-2 grep findings section below; fix any broken assertions in the same ship.

### Pass 4 — Lock hygiene

- **VISION §10 don't-touch / §11 parked:** profile IA redesign is the explicit greenlit purpose; no don't-touch surface entered. Collapse state is local `useState`, not a tracked context (`UniversalAddContext`/Auth/Sync/Household/Onboarding untouched). No App-Router navigation change.
- **ROADMAP §6 locks:** Sprint 8 germination-removal (Findings #43–46) is overridden by this newer IA redesign — surfaced to Syd (item 5 above). Casing convention: new card titles use Title Case (At a Glance, When to Plant, How to Grow, Seed Starting, Pest + Disease, Harvest, Companion Planting, Characteristics Deep-Dive, Propagation, Growing Notes) ✓. Empty-cell "—" preserved via PillDetailField ✓. Icon/chrome conventions untouched ✓.
- **enrichment-versioning lock (gt-enrichment-versioning):** v3 bump is exactly the documented mechanism (substantive prompt change → bump → self-heal). BUMP LOG entry added. ✓
- **No schema/RLS/auth** → auto-push tier per push-tier relaxation. ✓

---

## File-change summary

1. `src/app/library/[id]/VaultProfileAboutTab.tsx` — rewrite return body to 10-card order; add `parseGrowingNotes` + Mature-Size helper; new `showSeedStarting` prop; re-bucket provenance field lists; repoint anchors.
2. `src/app/library/[id]/page.tsx` — collapse default `{characteristics:true}`; compute + pass `showSeedStarting` (`!hideSowingFields`); declutter `howToGrowList` (remove sowing/germination rows that move to Seed Starting — OR keep howToGrowList for How-to-Grow's Spacing/Days and let About tab pull sowing fields from `profile` directly). Decision: pass sowing/germination via `profile` (already passed) — keep `howToGrowList` as Spacing/Planting-Window/Days; About tab reads sowing_method/sowing_depth/planting_depth/days_to_germination from `profile` for Seed Starting + When-to-Plant for window.
3. `src/lib/researchVariety.ts` — growing_notes sectioned format; propagation_method all-methods; propagation_notes brief-per-method wording.
4. `src/lib/ai-fill/version.ts` — `CURRENT_AI_FILL_VERSION = 3` + v3 BUMP LOG.
5. `src/lib/ai-fill/version.test.ts` — update literal assertion if present.
6. `src/lib/researchVariety.test.ts` — update if it asserts growing_notes wording/contract.
7. `e2e/*` — fix any About-tab card-title assertions broken by renames/adds.

## Verification plan

`npm run test:run` (387+ baseline) + `npm run build`. Per feedback-no-screenshots — tests + build + git diff sufficient; Syd dogfoods the structure on her phone. Auto-push after Phase 4 clean (no schema/RLS/auth).
