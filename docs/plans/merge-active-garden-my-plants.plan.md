# Plan — Merge Active Garden + My Plants into one Garden page

> **Status:** Planning doc only. No code edits. Captured 2026-05-19.
> **Maps to:** [REDESIGN_2026-05-18 §6 Phase 1 Ship 3](../REDESIGN_2026-05-18_add-entry-organization.md) — *"Merge Active Garden + My Plants into a single Garden page with filters. UI consolidation — schema-edits scoped to enabling the merged view. This is the bridge to Phase 2's Zones."*
> **Related captures:** [BUGS.md U15](../BUGS.md) (Permanent/Seasonal terminology inconsistency with tab labels — likely dissolved by this ship), REDESIGN §3.13 (lifecycle taxonomy — *Ship 5, not this ship*).

---

## 1. Framing

Today `/garden` is two separate pages stitched by a tab toggle ("Active Garden" / "My Plants") with two parallel state trees. Same table, same fetch shape, same UI vocabulary — but every piece of state (search, sort, filter, refine, display style, sessionStorage keys) is duplicated per tab. The merge collapses both into one page with **top-of-page filter pills** as the new single dimension: **All / Permanent / Seasonal** (default All).

This ship is the **Phase 1 bridge** to Phase 2's Zones rewrite (locked 2026-05-18). The merged Garden page becomes the surface Zones replaces later — so investment here is not throwaway. It also dissolves [BUGS U15](../BUGS.md) (terminology mismatch between AddPlantModal's "Permanent/Seasonal" toggle and the tab labels "Active Garden / My Plants") by making one set of labels canonical.

**What this ship is NOT:**
- Not the Zones rewrite (that's Phase 2, months away)
- Not the lifecycle taxonomy migration (that's [Ship 5](../REDESIGN_2026-05-18_add-entry-organization.md) — `lifecycle_pattern` enum + AddPlantModal toggle removal)
- Not a data-layer refactor — `grow_instances` schema stays untouched, `is_permanent_planting` boolean continues to drive the filter predicate

---

## 2. Current-state inventory

### Files in play

| File | LOC | Role |
|---|---|---|
| [src/app/garden/page.tsx](../../src/app/garden/page.tsx) | 1567 | Page shell — holds both state trees, renders both views conditionally on `viewMode` |
| [src/components/ActiveGardenView.tsx](../../src/components/ActiveGardenView.tsx) | 1276 | Seasonal view — `GrowingBatch` shape, gallery/list, bulk actions, refine filters |
| [src/components/MyPlantsView.tsx](../../src/components/MyPlantsView.tsx) | 959 | Permanent view — `PermanentPlanting` shape, gallery/list, bulk actions |
| [src/hooks/useFilterState.ts](../../src/hooks/useFilterState.ts) | — | Filter state hook (schema="garden") — used twice with different storageKeys |
| [src/lib/filterDefaults.ts:43-44](../../src/lib/filterDefaults.ts) | — | `gardenActive` + `gardenPlants` storage keys |
| [src/lib/navSectionClear.ts:28-33](../../src/lib/navSectionClear.ts) | — | 6 sessionStorage keys cleared on cross-section nav |

### Duplicated state trees (the load-bearing finding)

Every entry below exists twice — once per tab. Line refs in `src/app/garden/page.tsx`:

| Concern | Active branch | Plants branch |
|---|---|---|
| Search query | `activeSearchQuery` (L83) | `plantsSearchQuery` (L84) |
| Search debounce | `activeSearchDebounced` (L293) | `plantsSearchDebounced` (L294) |
| Category chips | `activeCategoryChips` (L85) | `plantsCategoryChips` (L87) |
| Filtered count | `activeFilteredCount` (L86) | `plantsFilteredCount` (L88) |
| Has-items flag | `activeHasItems` (L90) | `plantsHasItems` (L89) |
| Refine chips | `activeRefineChips` (L93) | `plantsRefineChips` (L94) |
| Filter state hook | `activeFilters` (L102, storageKey `gardenActive`) | `plantsFilters` (L107, storageKey `gardenPlants`) |
| Sort by | `activeSortBy` (L113, sessionKey `garden-active-sort`) | `plantsSortBy` (L121, sessionKey `garden-plants-sort`) |
| Sort dir | `activeSortDir` (L117, sessionKey `garden-active-sort-dir`) | `plantsSortDir` (L125, sessionKey `garden-plants-sort-dir`) |
| Display style | `activeDisplayStyle` (L176, sessionKey `garden-active-display-style`) | `plantsDisplayStyle` (L180, sessionKey `garden-plants-display-style`) |
| Sort-loaded ref | `activeSortRef` (L129) | `plantsSortRef` (L130) |
| Sort-restore effect | L131–140 | L141–150 |
| Category chips callback | `handleActiveCategoryChipsLoaded` (L303) | `handlePlantsCategoryChipsLoaded` (L306) |
| Refine chips callback | `handleActiveRefineChipsLoaded` (L309) | `handlePlantsRefineChipsLoaded` (L312) |
| Clear-search-and-filters | `clearActiveSearchAndFilters` (L339) | `clearPlantsSearchAndFilters` (L329) |
| View ref | `activeGardenRef` (L195) | `myPlantsRef` (L196) |
| Bulk-log open flag | `openBulkLogForActive` (L154) | `openBulkLogForPlants` (L155) |
| Open-bulk-journal flag | `openBulkJournalForActive` (L151) | *(plants has its own internal bulk mode)* |

**Net duplication:** ~17 state branches × 2 = ~34 hooks/effects/callbacks the merged page collapses to ~17.

### Data layer (already converges — good news)

Both views query the same table with different predicates:

- [ActiveGardenView.tsx:263-267](../../src/components/ActiveGardenView.tsx) — `from("grow_instances").or("is_permanent_planting.is.null,is_permanent_planting.eq.false")` (seasonal)
- [MyPlantsView.tsx:231-233](../../src/components/MyPlantsView.tsx) — `from("grow_instances").eq("is_permanent_planting", true)` (permanent)

The merge can issue **one query** (no `.or()`/`.eq()` predicate on the boolean) and partition results client-side via the filter pill. Or keep two queries firing in parallel and merge — pick based on count expectations (most users will have < 50 grows; one query simpler).

### Row shapes diverge

`GrowingBatch` (ActiveGarden) carries `expected_harvest_date`, `harvest_count`, `harvest_days`, `sow_method`, `seeds_sown`, `seeds_sprouted`, `plant_count` — fields a seasonal annual cares about.

`PermanentPlanting` (MyPlants) carries `care_count`, `journal_count` — fields a perennial cares about (no harvest_count because perennials have indefinite harvestable phase per [§3.13](../REDESIGN_2026-05-18_add-entry-organization.md)).

**Implication:** the merged page can't trivially render one "row component" for both — each lifecycle has different summary fields. The merge happens at the **page-state and shell level**, not at the row-render level. Each filter-pill segment still has its own row component (`ActiveGardenRow` + `MyPlantsRow`); they just live behind one unified filter/sort/search/refine state tree.

---

## 3. Proposed architecture

### Top-of-page shell

```
[Garden]                                                    [⋯]
[Search________________]  [⛀ Refine]  [↕ Sort]  [▦ Display]

  ( All )  ( Permanent )  ( Seasonal )                                    pills
─────────────────────────────────────────────────
[ refine chips if filters active ]
─────────────────────────────────────────────────
< rendered rows: seasonal cards above permanent if All, else filtered >
```

**Single state tree** holds:
- `filter: "all" | "permanent" | "seasonal"` — new, drives the pill + the query partition
- `searchQuery` (one, not two)
- `sortBy` / `sortDir` (one each — see §4 sort-axes note below)
- `displayStyle: "grid" | "list"` (one)
- `refineChips` (one)
- All the bulk-mode / select-mode state (one)

### URL persistence

Filter is the only new dimension that needs URL persistence. Add `?filter=all|permanent|seasonal`. Default `all`. Sort/search/refine stay in `useFilterState` + sessionStorage as today.

Existing `?tab=active|plants` URLs need a migration: `?tab=active` → `?filter=seasonal`; `?tab=plants` → `?filter=permanent`. Set up a small redirect on the page so any deep-link from prior `?tab=...` URLs still lands users in the right view. This also matters for the `?profile=...` and `?grow=...` cross-link params from plant profile / FAB nav.

### sessionStorage migration

Two paths considered. **Recommended: union-key approach.**

- New keys: `garden-sort`, `garden-sort-dir`, `garden-display-style`, `garden-filter` (mirrors the URL param).
- Old keys (`garden-active-*`, `garden-plants-*`) — one-time read-on-load to seed the new keys (whichever has values wins, prefer the user's most-recent visit). Then orphan the old keys (they remain in storage but the app ignores them; cleanup deferred to a separate housekeeping pass).
- Update [src/lib/navSectionClear.ts:28-33](../../src/lib/navSectionClear.ts) to include the new keys; old keys can stay listed for backwards compatibility on existing devices.

### Sort axes — open trade-off, see §6

Active uses sort keys `name | sown_date | harvest_date`; Plants uses `name | planted_date | care_count`. Merging the keys cleanly is the only sub-call where the user's UX intent needs to lock — see open question Q1 in §6.

### Row rendering

Two presentational components (one per lifecycle) still live, but the page composes them in a single scrollable list partitioned by lifecycle when `filter === "all"`:

```
<GardenFilterPills value={filter} onChange={setFilter} />
{filter !== "permanent" && seasonal.length > 0 && <SeasonalSection rows={seasonal} ... />}
{filter !== "seasonal"  && permanent.length > 0 && <PermanentSection rows={permanent} ... />}
```

Within each section, the existing `ActiveGardenView` / `MyPlantsView` shells stay — but trimmed to take their state via props (no more local sessionStorage / no more local filter state hook). The page is the state owner; the views become controlled presentational components.

### Bulk select / FAB integrations

Both views currently support bulk-select. Bulk select can stay **per-section** — selections inside the Seasonal section don't carry over into Permanent (different lifecycles, different bulk operations like "End batch" vs "Move to Active Garden"). The merged page coordinates via two refs (one per section) — same shape as today's `activeGardenRef` / `myPlantsRef`. This is intentionally NOT collapsed.

---

## 4. Migration risk + mitigations

| Risk | What breaks | Mitigation |
|---|---|---|
| **Existing URLs** (`/garden?tab=active`, `/garden?tab=plants`) — used in FAB nav, plant profile deep-links, sister's bookmarks | Hard 404 or land on wrong view | One-time redirect in page: read `tabParam` if present, translate to `?filter=...`, `router.replace(...)`. Land for ≥1 release before removing the legacy code path. |
| **sessionStorage keys diverged** (`garden-active-sort` vs `garden-plants-sort`) — restored sort can be wrong after merge | Sort jumps to default unexpectedly | Read-old-write-new migration on first load (prefer most-recent tab visited). Document the migration in commit message. |
| **family-mode behavior** — `HouseholdContext.viewMode` flips both sections at once; per-tab filter persistence today is per-user, not per-household-member | Filter pill state might collide with member-switch | Filter pill is local UI state, NOT a per-member preference (matches current today's behavior — tab choice is local). Verify on plan-audit Pass 4 that no household consumer reads `garden-active-*` / `garden-plants-*` keys. |
| **Refine modal** — `refineBySection: "plantType" \| "variety" \| ...` is shared today (good) but applies to the active tab's filter state ([page.tsx:91-94](../../src/app/garden/page.tsx)) | Refine UI might disappear when filter switches | Refine modal stays one — applies to the unified filter state tree. No fork by lifecycle. The refine chips themselves merge — variety/sun/spacing chips from both sections combine on `filter="all"`. |
| **Profile-filter deep-link** (`?profile=...`) — currently routes only into My Plants | Deep-link lands on empty seasonal section | Profile filter logic auto-forces `?filter=permanent` when `?profile=...` is set (simple precedence rule). |
| **Grow-highlight deep-link** (`?grow=...`) — currently routes only into Active Garden, scroll-to-batch | Deep-link lands on empty permanent section | Mirror — `?grow=...` auto-forces `?filter=seasonal`. |
| **Tests** — 3 existing regression tests reference per-tab behavior: `activeGardenBulkEnd.regression.test.ts`, `myPlantsBatchSelect.regression.test.ts`, `myPlantsIconCohesion.regression.test.ts` | Tests assert per-tab DOM that no longer exists | Tests stay valid if presentational components stay intact. Page-level tests need a `?filter=...` query param to scope. Worst case: tests need 1-2 line updates for filter setup. Audit Pass 3 covers this. |
| **AddPlantModal "Permanent/Seasonal" toggle** ([AddPlantModal.tsx:537-561](../../src/components/AddPlantModal.tsx)) — still derives default from current tab via `effectiveViewMode` in [page.tsx:236-240](../../src/app/garden/page.tsx) | Default lifecycle in Add Plant modal becomes ambiguous on `filter="all"` | When `filter="all"`, default = `seasonal` (matches today's `viewMode === "active"` default). Or — preferred — let user pick when on All. Either acceptable; recommend default-seasonal for behavioral continuity. **Note:** AddPlantModal toggle removal is [Ship 5](../REDESIGN_2026-05-18_add-entry-organization.md) territory — not this ship's scope. |
| **Onboarding empty states** — `EmptyStatePerennial` ([MyPlantsView.tsx:16](../../src/components/MyPlantsView.tsx)) currently only shows on the My Plants tab | Empty-state copy might surface wrongly on `filter="all"` for a user with zero plants | Each section renders its own empty state when that section is empty *and the filter includes it*. On `filter="all"` with zero everything, render a single combined empty state (new copy needed — captured as Q3 in §6). |

---

## 5. Files to touch (estimated line-edits)

| File | Edit shape | Est lines |
|---|---|---|
| [src/app/garden/page.tsx](../../src/app/garden/page.tsx) | Remove ~17 duplicate state branches; introduce unified state; add filter-pill component invocation; URL param migration; sessionStorage migration; render both sections in one scroll | -250 / +120 (net −130) |
| [src/components/ActiveGardenView.tsx](../../src/components/ActiveGardenView.tsx) | Strip local filter-state / sessionStorage; accept all filter/sort/display props from page (already mostly does — props already exist on the interface, [L77-124](../../src/components/ActiveGardenView.tsx)) | -50 / +10 |
| [src/components/MyPlantsView.tsx](../../src/components/MyPlantsView.tsx) | Same — strip local filter state, accept from page | -40 / +10 |
| `src/components/GardenFilterPills.tsx` | **New** — 3-pill component, `value` + `onChange` controlled, persists nothing locally | +60 |
| [src/lib/filterDefaults.ts](../../src/lib/filterDefaults.ts) | Add `garden` key (unified); keep `gardenActive` + `gardenPlants` for back-compat read | +1 |
| [src/lib/navSectionClear.ts:28-33](../../src/lib/navSectionClear.ts) | Add new unified keys to clear list; leave old keys listed | +3 |
| [src/app/garden/page.test.tsx](../../src/app/garden/page.test.tsx) *(if exists; else regression tests)* | Filter-pill happy paths + URL-param round-trip + sessionStorage migration | new file or +30-50 lines |
| `src/app/garden/mergedFilterPillBehavior.regression.test.ts` | **New** — pin filter-pill state machine, URL param sync, profile/grow deep-link precedence | +80 |

**Estimated total touched LOC:** ~−350 / +280 = net ~70 LOC reduction. Most of the change is collapse, not new code.

---

## 6. Open questions for Syd (pre-decided defaults proposed)

> Q1 + Q2 are mechanical — Claude has a recommended default and will use it unless you redirect. Q3 is a copy call. Q4 is the timing call.

**Q1. Unified sort axes.**
Today Active sorts by `name | sown_date | harvest_date`; Plants sorts by `name | planted_date | care_count`. On the merged page, sort options need to be one list.

- **Recommended:** `name | added_date | most_active` where `added_date` aliases `sown_date`/`planted_date` (which are the same DB column for both lifecycles) and `most_active` aliases `harvest_date` (seasonal) + `care_count` (permanent) into one "recency" axis. Lifecycle-aware tiebreak.
- Alt: keep 3 sort axes but show different labels per filter (`harvest date` when filter=seasonal, `care count` when filter=permanent, fallback to `added date` on all).

Default if no redirect: **Recommended** above.

**Q2. Filter-pill term anchoring.**
The user's brief locks the pill labels as **All / Permanent / Seasonal**. Worth flagging: [REDESIGN §3.13](../REDESIGN_2026-05-18_add-entry-organization.md) will replace Permanent/Seasonal with the 4-value `lifecycle_pattern` enum in Ship 5. The merged Garden page's pills become outdated terminology the moment Ship 5 lands. Two paths:

- **Recommended:** ship the merge NOW with All/Permanent/Seasonal (matches user brief + [BUGS U15](../BUGS.md) currently lives in this vocab). Re-label in Ship 5 with the same surgery that removes the AddPlant toggle.
- Alt: anticipate Ship 5 — ship pills as `All / Annual / Perennial-single / Perennial-continuous / Biennial`. Rejected — 5 pills is too many; the 4-value taxonomy is Ship 5 territory.

Default if no redirect: **Recommended** above.

**Q3. Empty-state copy on `filter="all"` with zero plants.**
Current: each tab has its own copy (`EmptyStatePerennial` vs Active Garden's empty). Merged All view needs a unified empty state.

- **Recommended:** *"Your garden is empty. Tap + to add your first plant — seasonal annuals or permanent trees and perennials all live here."* (matches the post-9bad88f voice sweep cadence — guiding, action-led, names both lifecycles).
- Alt: render both individual empty states stacked. Rejected — feels broken.

Default if no redirect: **Recommended** above.

**Q4. Ship vs park for Ship 5 dependency.**
Ship 5 ([REDESIGN_2026-05-18 §6](../REDESIGN_2026-05-18_add-entry-organization.md)) eventually replaces the Permanent/Seasonal vocab + removes the AddPlant toggle. Is Ship 3 worth the ~M-sized merge now, or do we wait and bundle Ship 3 + Ship 5 together?

- **Recommended:** ship Ship 3 standalone NOW. Reasons: (a) collapses real duplicate state today (long-standing tech debt); (b) is the explicit bridge in [REDESIGN §6](../REDESIGN_2026-05-18_add-entry-organization.md) — *"This is the bridge to Phase 2's Zones"*; (c) dissolves [U15](../BUGS.md) terminology bug en route; (d) Ship 5 changes are vocab-only on top of the merged state machine.
- Alt: wait for Ship 5 and do both together. Bigger ship, more risk, longer feedback loop.

Default if no redirect: **Recommended** above — ship standalone.

---

## 7. Test strategy

### Existing coverage to preserve

- [src/app/garden/activeGardenBulkEnd.regression.test.ts](../../src/app/garden/activeGardenBulkEnd.regression.test.ts) — 14 it-blocks pinning bulk-end error-discarded fix from U24 Phase A. Stay valid; assert via the merged page with `?filter=seasonal`.
- [src/app/garden/myPlantsBatchSelect.regression.test.ts](../../src/app/garden/myPlantsBatchSelect.regression.test.ts) — Stay valid; assert via `?filter=permanent`.
- [src/app/garden/myPlantsIconCohesion.regression.test.ts](../../src/app/garden/myPlantsIconCohesion.regression.test.ts) — Icon assertion is on `MyPlantsView` source, not on rendered page; passes unchanged.

### New coverage needed

- **`mergedFilterPillBehavior.regression.test.ts`** (new):
  - Default filter is `all` when no URL param
  - `?filter=permanent` renders only the Permanent section
  - `?filter=seasonal` renders only the Seasonal section
  - `?filter=all` renders both sections
  - `?tab=active` legacy URL `router.replace`s to `?filter=seasonal`
  - `?tab=plants` legacy URL `router.replace`s to `?filter=permanent`
  - `?profile=<id>` auto-forces `filter=permanent` precedence
  - `?grow=<id>` auto-forces `filter=seasonal` precedence
  - Search + sort + display state survives filter switch
  - sessionStorage migration: pre-existing `garden-active-sort` value seeds new `garden-sort` key

- **`gardenSessionStorageMigration.test.ts`** (new, small):
  - First-load with old keys present → new keys populated correctly
  - First-load with no old keys → new keys default
  - Subsequent loads with new keys → old keys ignored

### Audit passes required

- **Pass 1 — Factual:** all `useState`/`useEffect`/`useSessionStorage` cited in this plan exist as named; props on Views match new controlled-component shape.
- **Pass 2 — Concerns hunt:** state-machine race (filter switch mid-fetch); URL ↔ sessionStorage drift; family-mode coexistence; refine modal across-lifecycle behavior; empty-state combinatorics; `?profile`/`?grow` precedence with `?filter`.
- **Pass 3 — Sibling sweep:** any other surface that consumed `viewMode === "active" | "plants"` (already grep'd: FAB seeds `setAddPlantDefaultType` at [page.tsx:237-240](../../src/app/garden/page.tsx) — needs to read the filter now, not viewMode); navSectionClear keys; deep-link callers in plant profile / Vault.
- **Pass 4 — Lock hygiene:** VISION §10 (don't-touch), §11 (parked decisions); REDESIGN §3.4 Zones (don't conflict with future Phase 2); REDESIGN §3.13 lifecycle (don't pre-empt Ship 5 schema work in this ship); ROADMAP §6 decision log.

---

## 8. Estimated effort

| Phase | Effort |
|---|---|
| Plan + audit (4 passes, iterative-until-clean) | ~2 hours |
| Page-shell rewrite + Views prop-strip | ~4-6 hours |
| URL param + sessionStorage migration | ~1 hour |
| New tests (2 files, ~12 it-blocks total) | ~1-2 hours |
| Manual phone verify on prod + Preview MCP visual check | ~30 min (Syd) |
| **Total** | **~8-11 hours of build time** (~M-size) |

---

## 9. Suggested commit sequence

**Option A — one bundled commit (Recommended).** The state-tree collapse is internally consistent and atomic — splitting it risks intermediate broken builds. One commit message lists the duplication collapsed + the migration paths + the new tests.

**Option B — 3-commit split.**
1. New `GardenFilterPills.tsx` component + new test scaffolding (mountable but not wired)
2. Wire the pill into `page.tsx`, collapse duplicate state, strip View local state, URL + sessionStorage migration
3. New regression test file + assertions

Option B is more reviewable in a code-review setting but the user is the reviewer here and prefers seeing complete coherent ships. **Recommend Option A.**

---

## 10. Where this plan ends

This is a planning doc, not a kickoff. Before any code lands, Syd reviews + answers Q1–Q4 (or accepts defaults) + greenlights the ship via the standard "yes build" gate. Then the work runs Phase 2 readiness gate (full plan-file at `.claude/plans/<branch>.md`, all 4 audit pass-types iterative-until-clean) before the first code edit.
