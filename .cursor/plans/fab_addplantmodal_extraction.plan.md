# FAB AddPlantModal extraction — deferred C1 follow-up plan

> **Status:** Deferred from `intelligent-pare-f7abd4` chat (2026-05-24) per Syd's F1 greenlight after honest mid-execution scope discovery. Picks up where §13 + §14 of `~/.claude/plans/intelligent-pare-f7abd4.md` left off.
>
> **Why deferred:** Q1 = C1 was greenlit with the original §14 estimate of "~2-3h, parallel cost to one of Commits A-D." On reading AddPlantModal in detail mid-execution, the structural differences from the 4 Path Y form extractions made the estimate wrong. Honest scope rework needed before another commit lands on this surface.

---

## 1. What's already shipped on main (sets the baseline for this follow-up)

- **Path Y A-D + E** (2026-05-19/20): 4 form sub-components extracted (TaskForm / JournalEntryForm / SupplyForm / SeedPacketForm); UniversalAddMenu rewired so all 5 top-level FAB picks slide in-place. AddPlantModal mounts intentionally preserved as standalone for both FAB chooser flow ("Manual entry" closes menu + opens modal) AND non-FAB callers (`openPlant()` via context). Closes BUGS U7. See `~/.claude/plans/intelligent-pare-f7abd4.md` §1-§12.
- **2026-05-20 sub-form transition bundle Fix A + Fix B** (commits `1c2d403` + `ba1da34` + `4e9fb25`): SeedPacketForm + SupplyForm internal step swaps slide via new `stepDirection` state mirroring menu's `screenDirection`/`slideClass` pattern. Bidirectional symmetric — `goBack()` + Back arrows set direction="back" before setStep("choose"). U28 closed: 6 cross-flow callback props threaded through UniversalAddMenu to the form sub-components (4 for Seed, 2 for Supply) restoring the regressed Photo Import / Link Import / Purchase Order buttons in the menu's seed + shed sub-screens.

**Sole remaining asymmetric path in the entire FAB tree after F1:** AddPlantModal Manual entry forward + back. Forward = menu closes (instant) + AddPlantModal slides up. Back = AddPlantModal closes (instant) + menu fade-scales in via `animate-fab-menu-enter`. This is the C1 work.

---

## 2. Original §14 estimate vs reality

The §14 estimate said:

> "Option C1 ~2-3h additional scope, parallel cost to one of Commits A-D."

What the audit didn't surface:

### 2a. AddPlantModal's sticky-flex-col-overflow shell

Unlike the 4 Path Y forms — all of which use a single `overflow-y-auto` panel with inline Save/Cancel at the bottom — AddPlantModal's panel uses a 3-section `flex flex-col overflow-hidden` shell:

```
<div className="bg-white rounded-3xl border ... max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
  <div className="flex-shrink-0 px-6 pt-6 pb-4">{/* header: Back arrow + h2 + Permanent/Seasonal toggle + intro p */}</div>
  <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-2.5 relative">{/* body: mode toggle + form fields + photo flow + notes + error */}</div>
  <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex gap-2.5 justify-end">{/* sticky footer: Cancel + Save */}</div>
</div>
```

The 4 Path Y forms have NO sticky footer — Save lives inline at the bottom of the form content. The sticky-footer pattern in AddPlantModal is a deliberate UX (the footer never scrolls off screen, Save always reachable). Extracting AddPlantModal as a form sub-component for in-menu mount forces a choice:

- **(A) Flatten** — drop the sticky-flex-col-overflow shell, render header + body + footer as one continuous block. **Loses standalone sticky-footer behavior** on every existing AddPlantModal mount site. Requires Syd input on the UX trade.
- **(B) Preserve via dual-render** — extract content into a `panelContent` const, render in either `<div className="flex flex-col overflow-hidden max-h-[85vh]">...</div>` (standalone) OR `<div className="flex flex-col max-h-[60vh] overflow-hidden">...</div>` (embedded, smaller cap because menu's panel already has `max-h-[85svh]`). Keeps sticky footer in both contexts. More LOC; harder to maintain.
- **(C) Embedded prop with conditional wrapper** — add `embedded?: boolean` prop; when true, replace the outer fixed-positioned backdrop with a no-op wrapper and the inner flex-col panel with a no-flex wrapper that lets content flow naturally inside menu's overflow-y-auto panel. Cleaner than (B) but DOES lose sticky-footer when embedded (acceptable since menu's bottom-padding makes sticky-footer awkward anyway).

### 2b. Secondary `enrichmentFailed` nested modal

AddPlantModal renders a SECOND fixed-positioned modal at L972-1005 (`if (enrichmentFailed)`) when plant enrichment fails. Sibling of the main panel inside the same `<>` fragment. Need to keep working in both contexts. Uses `fixed inset-0 z-[60]` so positioning is independent of DOM parent.

### 2c. 1008 LOC + multi-mode complexity

AddPlantModal: 1008 LOC. State for 3 modes (`existing` vs `new` vs `addToExistingProfile`) × 2 types (`permanent` vs `seasonal`) × packet selection (`packetsForProfile`, `selectedPacketId`, `showAddPacketInline`, `addPacketVendor`) × photo flow (camera + gallery + crop) × enrichment failure handling. Many surface for failure modes during extraction. The 4 Path Y forms ranged 450-700 LOC with simpler state machines.

---

## 3. Realistic estimate by approach

- **Approach (A) Flatten / drop sticky footer in standalone too:** ~3-4h. Cleanest pattern (matches other Path Y forms). UX trade: standalone AddPlantModal mount sites (5 pages + non-FAB callers via `openPlant()`) lose sticky footer. **Needs Syd input on the UX trade** — sticky footer was deliberate in the standalone.
- **Approach (B) Dual-render preserving sticky footer:** ~5-6h. Highest quality. More LOC of conditional wrappers; harder to test all permutations.
- **Approach (C) `embedded` prop minimal shim:** ~2-2.5h. Reuses existing modal; adds ~30-50 LOC of conditional rendering. Loses sticky-footer ONLY for embedded mount (standalone unchanged). Most pragmatic. Quality slightly lower than (A) or (B) but the difference is small in practice.

**Recommended approach: (C) embedded prop minimal shim.** Reasoning:
- Standalone AddPlantModal mounts (garden My Plants empty-state CTA, vault Plant Again flows, etc.) keep their existing sticky-footer UX exactly as today
- Embedded-in-menu mount loses sticky footer — but the menu's own footer-spacing pattern (Cancel button at form bottom) is already what users see for the other 4 in-menu Path Y forms; cohesion via consistency
- Smallest surface change = lowest risk of regression in AddPlantModal's complex multi-mode logic
- If approach (A) or (B) is preferred later, the `embedded` prop can be removed and replaced cleanly

---

## 4. Concrete implementation plan (Approach C — recommended)

### Files touched

| File | Edit shape | LOC delta |
|---|---|---|
| `src/components/AddPlantModal.tsx` | Add `embedded?: boolean` prop (default `false`); make `useFocusTrap` + `useEscapeKey` + `useBodyScrollLock` conditional on `!embedded`; extract panel content (header + body + footer JSX from L537-968) into a `panelContent` JSX variable; conditional outer wrapper at L533-970 — when embedded, render just `{panelContent}` + `enrichmentFailed` modal; when not embedded, render existing `<div className="fixed inset-0...">` + inner panel + `panelContent` + `enrichmentFailed`. | ~30-50 net (mostly conditional rendering scaffolding; panel content is a const move) |
| `src/components/UniversalAddMenu.tsx` | Add `"add-plant-manual"` to `UniversalAddMenuScreen` union; add new `<div key="add-plant-manual" className={slideClass}>` branch rendering `<AddPlantModal open embedded onClose={onClose} onBackToMenu={() => { setScreenDirection("back"); setScreen("add-plant"); }} defaultPlantType={addPlantDefaultType} stayInGarden={pathname.startsWith("/garden")} hidePlantTypeToggle={pathname.startsWith("/garden")} />`. Modify the add-plant chooser's "Manual entry" button (`handleAddPlantManual`) — change from `onClose() + onAddPlantManual()` to `setScreenDirection("forward"); setScreen("add-plant-manual")`. Drop the now-unused `onAddPlantManual` prop from interface. | ~25 LOC added, ~5 removed |
| 5 add-button-mounting pages (home / garden / calendar / journal / vault page) | Drop `onAddPlantManual={openPlant}` prop wiring on `<UniversalAddMenu>`. `openPlant` stays in context destructure (still used by non-FAB callers like garden My Plants empty-state CTA `onAddClick={() => openPlant("permanent")}`). | ~1 LOC removed per page, 5 pages |

### Per-page derivation of `stayInGarden` + `hidePlantTypeToggle`

The standalone AddPlantModal mount has different prop values per page:
- garden/page.tsx: `stayInGarden hidePlantTypeToggle` (both true)
- Other 4 pages: both default false

For the embedded mount inside UniversalAddMenu, derive from `pathname`:
```ts
const stayInGarden = pathname.startsWith("/garden");
const hidePlantTypeToggle = pathname.startsWith("/garden");
```

Mirrors the per-page standalone behavior without adding new props to UniversalAddMenuProps.

### Audit gates required

Per CLAUDE.md plan-audit standard:
- **Pass 1 (Factual):** every line cite verified — `enrichmentFailed` modal positioning, `useFocusTrap` ref attachment, sticky-footer JSX boundary, `pathname.startsWith("/garden")` derivation
- **Pass 2 (Concerns hunt):** state-machine collisions (`screen` outer vs AddPlantModal's `mode`/`plantType`); focus-trap interaction (menu's aria-modal vs modal's `tabIndex={-1}`); body scroll lock single-source-of-truth (menu calls, modal skips when embedded); `enrichmentFailed` z-index ordering inside menu's panel; persona walk (Maya / Sydney / Walter / Aria / Sam); cohesion-by-aggregation (whatever new patterns the embedded conditional introduces)
- **Pass 3 (Sibling sweep):** any other modals in the codebase with similar sticky-flex-col-overflow shell that might want the same `embedded` prop pattern later? (HarvestModal, GrowInstanceModal, possibly others.) Capture as ADJACENT for future cohesion pass.
- **Pass 4 (Lock hygiene):** VISION §10 don't-touch — AddPlantModal not on the list; flatten doesn't violate. VISION §11 parked decisions — none touched. ROADMAP §6 FAB transition standard (amended 2026-05-20) — this ship closes the last asymmetric path, fully realizing the "all FAB picks = submenus" lock.

---

## 5. UX trade-off that needs Syd's input BEFORE Approach (C) ships

**Decision needed:** the embedded-mode AddPlantModal loses its sticky footer (Save button at bottom of scroll instead of always-visible footer). Other Path Y in-menu forms work this way and feel fine. AddPlantModal has more fields (intro + plant-type toggle + mode toggle + plant selector + packet selector + photo flow + planted date + quantity + location + notes — substantially longer scroll than the other forms). Save button being below-the-fold on first render is a UX downgrade vs today's standalone sticky-footer.

**Two ways to handle:**
- **(C-default)** Accept the scroll-to-save UX. Cohesion with other in-menu Path Y forms wins.
- **(C-alt)** Render embedded AddPlantModal with its OWN inner sticky-flex-col-overflow shell at a smaller max-h (e.g. `max-h-[60vh]`). Preserves sticky footer but means the embedded panel has its own inner scroll inside menu's outer scroll — nested-scroll UX (uncommon, can feel weird on mobile).

**Recommend (C-default).** Cohesion across all 5 in-menu forms outweighs the per-form sticky-footer benefit; mobile users are used to scrolling to Save. **Surface this to Syd before code lands.**

---

## 6. Dependencies / blockers

- **Phone-verify F1 first.** The current 3-commit ship (Fix A + Fix B + U28) needs Syd's phone-dogfood feedback before we know if the AddPlantModal Manual entry asymmetry actually grates in practice. If she says "it's fine, doesn't bother me" → C1 stays parked indefinitely. If she says "the symmetric in/out across the rest of the tree makes the AddPlantModal one stand out" → run this plan.

- **No code dependencies.** All Path Y A-D infrastructure already shipped + working. This is a pure extension of the same pattern to the 5th modal.

---

## 7. Commit shape for the follow-up ship

If approach (C) chosen, single commit:
- `refactor(add-menu): C1 — AddPlantModal embedded prop + in-menu add-plant-manual sub-screen — closes FAB tree symmetric unification`

If approach (A) chosen (flatten standalone too), split possible:
- Commit 1: `refactor(add-plant): drop sticky-footer pattern; flatten to inline Save/Cancel`
- Commit 2: `refactor(add-menu): C1 — extract AddPlantForm + add menu add-plant-manual sub-screen`

---

## 8. Close-out doc updates needed when this ships

- BUGS — no new bug (continuation of Path Y series).
- ROADMAP §1 lead-line — new paragraph for the C1 close ship.
- ROADMAP §5 Recently shipped — new entry.
- ROADMAP §6 Decision log — new 2026-05-XX entry capturing: (a) reason this was deferred from 2026-05-24; (b) approach chosen (A vs B vs C); (c) UX trade Syd approved (sticky-footer behavior).
- ROADMAP §6 FAB transition standard — amend the 2026-05-20 entry to drop the "Manual entry path still asymmetric" footnote.

---

## 9. Where this plan ends

Park indefinitely. Re-open only when Syd signals the AddPlantModal Manual entry asymmetry is actually bothering her in dogfood. At that point: this plan file is the picking-up point; no need to re-audit § 1-§3 (the scope discovery is durable).

Decision required before code lands: approach (A) vs (B) vs (C) — UX trade-off on sticky-footer in standalone mount.

Recommendation if no further direction: (C) embedded shim + accept scroll-to-save in embedded mount. Standalone AddPlantModal unchanged.
