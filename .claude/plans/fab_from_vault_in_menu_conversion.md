# FAB → Add plant → From Vault: bottom-sheet → in-menu overlay conversion

> **Chat:** FAB-tree full-page → modal conversion cluster (Chapter A only — Chapter B closed as no-op per `7242cb6`).
> **Phase:** Phase 1 — Kickoff + plan + audit (greenlight pre-granted per orchestrator handoff).
> **Plan-of-record file** (>3 files + state-machine territory + override of locked Q2=B decision → plan file required per CLAUDE.md plan-audit standard).
> **Audit gate:** Pass 1 factual + bidirectional matrix + Pass 2 concerns hunt + persona walk + Pass 3 sibling sweep + Pass 4 lock hygiene — all 4 pass-types required.

---

## Purpose (one sentence)

Convert `PlantingFlowModal` from a bottom-sheet slide-up modal (z-60, page-level state) to an in-menu overlay mounted inside `UniversalAddMenu`'s flex-col panel as a new `screen === "add-plant-from-vault"` sub-screen, mirroring the AddPlantModal C1 embedded-mount pattern shipped in `ba9319f`.

## Scope (locked)

**In-scope:**
1. Add `"add-plant-from-vault"` to `UniversalAddMenuScreen` union in [UniversalAddMenu.tsx:13](src/components/UniversalAddMenu.tsx:13) AND `UniversalAddMenuScreenTarget` union in [UniversalAddContext.tsx:10-17](src/contexts/UniversalAddContext.tsx:10).
2. New `screen === "add-plant-from-vault"` branch in UniversalAddMenu — flex-col panel with header (Back arrow → `goBackToAddPlant` + "Planting" title + right spacer) and body (`<PlantingForm mode="modal" profileIds={[]} fromGarden={pathname.startsWith("/garden")} onSaved={...} />`).
3. Rewire `handleAddPlantFromVault` in `screen === "add-plant"` branch: was `onClose(); onAddPlantFromVault();` → becomes `setScreenDirection("forward"); setScreen("add-plant-from-vault");`. Removes the menu-close + page-level-modal-open round-trip.
4. Drop `onAddPlantFromVault: () => void` prop from `UniversalAddMenuProps` interface (no longer needed — the screen transition is internal to the menu).
5. Drop 5 page mounts' `plantingFromVaultOpen` state + `<PlantingFlowModal />` mount + `onAddPlantFromVault` prop wiring on `<UniversalAddMenu>`:
   - [src/app/page.tsx:57, 129, 657, 809](src/app/page.tsx)
   - [src/app/calendar/page.tsx:45, 127, 1915, 2066](src/app/calendar/page.tsx)
   - [src/app/garden/page.tsx:41, 214, 1237, 1391](src/app/garden/page.tsx)
   - [src/app/journal/page.tsx:48, 267, 1070, 1225](src/app/journal/page.tsx)
   - [src/app/vault/VaultPageContent.tsx:45, 156, 1697, 1855](src/app/vault/VaultPageContent.tsx)
6. **Delete `src/components/PlantingFlowModal.tsx`** — no remaining consumers after the 5 page mounts drop their imports. The dynamic-import preload in [UniversalAddMenu.tsx:112](src/components/UniversalAddMenu.tsx:112) is also dropped (the component code is now part of the menu's main bundle via `PlantingForm` direct import).
7. **`PlantingForm` direct import** in UniversalAddMenu — same shape as TaskForm/JournalEntryForm/SupplyForm/SeedPacketForm/AddPlantModal (no `next/dynamic`). Adds PlantingForm to the menu's static deps, but PlantingForm is already statically imported by `/vault/plant/page.tsx` (the page route preserved for non-FAB callers), so it's already in the bundle graph; the menu lazy-load gains nothing.

**Out-of-scope (parked):**
- `/vault/plant` page route — preserved verbatim for non-FAB callers (Calendar Plantable "Plant" button, Vault toolbar batch-select-then-Plant with `?ids=`).
- `PlantingForm` internal logic — only `mode="modal"` rendering path consumed; verify-only cohesion check, no shell changes.
- Page-side refetch after successful planting — DROPPED. Same accepted regression class as Path Y Q1=Option B (pages don't auto-refresh after in-menu successful add). See §"Trade-off — page refetch loss" below.
- Auth-blocked Preview MCP visual check — documented skip per CLAUDE.md condition; user phone-verifies on prod (dogfood plan in chat).

## Success criteria

- (a) FAB → Add plant → From Vault slides horizontally in-place matching the other FAB chips (Manual entry / Photo Import / Purchase Order chip-tap paths) — NO bottom-sheet animation, NO menu-close + new-modal-open round-trip.
- (b) Back arrow on the new sub-screen returns to "Add plant" sub-screen via `goBackToAddPlant` → `setScreenDirection("back"); setScreen("add-plant")` — same shape as add-plant-manual back button.
- (c) Cancel button (footer of the sub-screen if added, OR existing menu Cancel surface) exits the FAB tree entirely via `onClose()`.
- (d) After successful planting, `onSaved()` callback fires → menu closes via `onClose()` → celebration animation visible (fixed z-200, DOM-parent-independent).
- (e) Add Seed nested picker (z-110) inside PlantingForm still renders correctly inside menu z-100 stack (fixed positioning is DOM-parent-independent).
- (f) Non-FAB callers of `/vault/plant` page route (Calendar Plantable, Vault toolbar batch-select) unchanged — verify by grep for `router.push.*vault/plant` callsites.
- (g) Tests pass (`npm run test:run` — current 438/438 expected); local build clean (`npm run build`).
- (h) No new console errors / warnings introduced by the diff.
- (i) Bidirectional state-transition matrix applied at Pass 1 (open + close, forward + back, mount + unmount, Suspense + lazy resolution axes).

---

## Required reading (done)

- CLAUDE.md (rules card + Chat Lifecycle Protocol + plan-audit standard + AskUserQuestion-forbidden) — loaded via system reminder.
- VISION.md §4 Principle 9, §7 FAB & Modals, §8 Design tokens (transitions), §11 parked decisions.
- ROADMAP.md §1 current focus, §6 recent FAB cluster + form-submit saga ships (2026-05-26 entries for `aa4c116` + `7242cb6` + `ba9319f`).
- AddPlantModal C1 embedded-mount template ([AddPlantModal.tsx:45-65, 537, 978-988](src/components/AddPlantModal.tsx)) — the canonical pattern this conversion mirrors.
- UniversalAddMenu screen branches ([UniversalAddMenu.tsx:215-356](src/components/UniversalAddMenu.tsx)) — `add-plant-manual` is the closest analog.
- PlantingForm modal-mode shape ([PlantingForm.tsx:488-499, 871-880](src/components/PlantingForm.tsx)) — sticky bottom-bar inside parent's `overflow-y-auto px-6` scroll container.
- The 5 page mounts' current state-machine + cleanup paths.

---

## The canonical pattern (single source of truth)

```tsx
{screen === "add-plant-from-vault" && (
  <div key="add-plant-from-vault" className={`${slideClass} flex-1 min-h-0 flex flex-col`}>
    <div className="flex-shrink-0 px-6 pt-6 pb-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={goBackToAddPlant} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-teal-gus hover:bg-teal-gus/10 -ml-1" aria-label="Back">
          <ICON_MAP.Back className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-neutral-900 flex-1 text-center">Planting</h2>
        <div className="w-11 shrink-0" aria-hidden />
      </div>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
      <PlantingForm
        profileIds={[]}
        fromGarden={pathname.startsWith("/garden")}
        mode="modal"
        onSaved={onClose}
      />
    </div>
  </div>
)}
```

Mirrors `add-plant-manual` shape verbatim (header flex-shrink-0 + body flex-1 min-h-0 overflow-y-auto + child component rendered inline). PlantingForm's sticky Confirm bar (`sticky bottom-0 -mx-6 px-4 py-2.5`) pins to the body div's bottom — same pattern as PlantingFlowModal's current body shell.

---

## Trade-off — page refetch loss (named explicitly)

**Current behavior:** Each page-level `<PlantingFlowModal onSuccess={() => setRefetchTrigger((t) => t + 1)}>` triggers a page-side refetch after successful planting. Garden page sees fresh plant immediately; Vault page sees decremented packet `qty_status` immediately.

**Post-conversion behavior:** Menu's `onSaved` fires `onClose()` which closes the menu. No page-side refetch hook fires. User must manually refresh / navigate to see fresh data.

**Functional impact by surface:**
- **Garden page:** planted seed should appear on Active Garden tab; refetch matters. Workaround: user navigates Garden → Garden or pull-to-refresh.
- **Vault page:** planted seed reduces packet `qty_status`; refetch matters. Workaround: pull-to-refresh.
- **Home / Calendar / Journal:** none of these pages display `grow_instances` directly; refetch is moot.

**Precedent:** This is the same accepted regression as Path Y Q1=Option B (locked 2026-05-19, ROADMAP §6) — pages don't auto-refresh after in-menu successful add. Cross-modal "+ Add New Supply" also has this shape.

**Locked decision:** Accept the regression per precedent. Functional impact is "manual refresh on Garden + Vault after FAB-tree planting"; same shape as existing 5 in-menu paths (TaskForm, JournalEntryForm, SupplyForm, SeedPacketForm, AddPlantModal). If Syd flags it, follow-up = add `notifyPlantingSuccess` channel to `UniversalAddContext` (parallel to `openShed`).

---

## Plan — per item

### Item 1: UniversalAddMenu screen union extension

**Files touched:**
- EDIT [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) line 13
- EDIT [src/contexts/UniversalAddContext.tsx](src/contexts/UniversalAddContext.tsx) line 10-17 (mirror the union)

**Approach:**
- `UniversalAddMenuScreen` becomes `"main" | "add-plant" | "add-plant-manual" | "add-plant-from-vault" | "seed" | "shed" | "task" | "journal"`.
- `UniversalAddMenuScreenTarget` mirrors the same addition (callers like Back arrows can request the new screen via `openMenuOnScreen("add-plant-from-vault")` if ever needed — but no current caller does, so this is forward-compat only).

**Effort:** XS.

### Item 2: Add PlantingForm import + new screen branch

**Files touched:**
- EDIT [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) — add `import { PlantingForm } from "@/components/PlantingForm";` near the top with peer imports; insert new `screen === "add-plant-from-vault"` branch after the `add-plant-manual` branch.

**Approach:**
- Direct static import (no `next/dynamic`) — matches AddPlantModal, TaskForm, JournalEntryForm, SupplyForm, SeedPacketForm imports.
- Branch shape exactly per the canonical template above.
- `profileIds={[]}` — FAB flow starts with no pre-selected profiles; user picks via PlantingForm's internal Add Seed picker.
- `fromGarden={pathname.startsWith("/garden")}` — preserves the Garden-page detection signal that PlantingForm uses to skip the post-save redirect (irrelevant in modal mode but kept for prop parity per [PlantingFlowModal.tsx:18](src/components/PlantingFlowModal.tsx:18) note).
- `mode="modal"` — fixed.
- `onSaved={onClose}` — celebration completes → parent (menu) closes via `onClose`. Same shape as `add-plant-manual`'s `onClose={onClose}` indirectly via AddPlantModal's handleClose flow.

**Effort:** S.

### Item 3: Rewire "From Vault" chip handler

**Files touched:**
- EDIT [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) — `handleAddPlantFromVault` function (line 119-122 currently); "From Vault" chip onClick (line 258).

**Approach:**
- Currently: `const handleAddPlantFromVault = () => { onClose(); onAddPlantFromVault(); };` and `<button onClick={handleAddPlantFromVault}>`.
- New: drop the standalone function (single use-site) and inline `onClick={() => { setScreenDirection("forward"); setScreen("add-plant-from-vault"); }}` matching the Manual entry chip's shape verbatim ([line 247](src/components/UniversalAddMenu.tsx:247)).

**Effort:** XS.

### Item 4: Drop `onAddPlantFromVault` prop

**Files touched:**
- EDIT [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) — `UniversalAddMenuProps` interface line 27, destructure line 67.

**Approach:**
- Remove `onAddPlantFromVault: () => void` from interface (line 26-27).
- Remove from destructure (line 67).
- Update jsdoc / comments if any reference the prop.

**Effort:** XS.

### Item 5: Drop 5 page mounts' state + modal mount + prop wiring + dynamic import

**Files touched (5 page files):**

**5a. [src/app/page.tsx](src/app/page.tsx) (Home)**
- Drop dynamic import line 57-60 (`const PlantingFlowModal = dynamic(...)`).
- Drop state line 129 (`const [plantingFromVaultOpen, setPlantingFromVaultOpen] = useState(false);`).
- Drop `onAddPlantFromVault` prop wiring on `<UniversalAddMenu>` line 657-660 (replace 3 lines with nothing).
- Drop `<PlantingFlowModal>` mount block line 809-815.

**5b. [src/app/calendar/page.tsx](src/app/calendar/page.tsx)** — same surgical pattern (dynamic import line 45-48, state line 127, prop line 1915-1918, mount line 2066-2072).

**5c. [src/app/garden/page.tsx](src/app/garden/page.tsx)** — same surgical pattern (dynamic import line 41-44, state line 214, prop line 1237-1240, mount line 1391-1399). Note: garden's PlantingFlowModal mount passes `fromGarden` — preserved internally in the menu's new screen via `pathname.startsWith("/garden")`.

**5d. [src/app/journal/page.tsx](src/app/journal/page.tsx)** — same surgical pattern (dynamic import line 48-51, state line 267, prop line 1070-1073, mount line 1225-1231).

**5e. [src/app/vault/VaultPageContent.tsx](src/app/vault/VaultPageContent.tsx)** — same surgical pattern (dynamic import line 45-48, state line 156, prop line 1697-1700, mount line 1855-1861).

**Approach:** Each file's edit is purely subtractive — remove 4 distinct code regions per file. Pages don't change behavior for non-FAB callers. The `pathname` prop already flows to UniversalAddMenu, so the menu's new screen reads `fromGarden` internally.

**Effort:** S — 5 files, all symmetric deletions.

### Item 6: Delete `src/components/PlantingFlowModal.tsx`

**Files touched:**
- DELETE [src/components/PlantingFlowModal.tsx](src/components/PlantingFlowModal.tsx).
- EDIT [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) line 112 — drop `void import("@/components/PlantingFlowModal").catch(() => {});` from the FAB-menu-open preload effect.

**Approach:** Verified no remaining consumers via grep (`PlantingFlowModal` only matches the component file itself + the 5 page mounts being dropped in Item 5 + the preload line being dropped here). MyPlantsView + PacketVaultView grep hits in earlier search were on the broader `onAddPlantFromVault` pattern — confirmed no PlantingFlowModal consumers in those files (no matches on direct grep). Safe to delete.

**Effort:** XS.

---

## Bidirectional state-transition matrix (Pass 1 — provisional rule from CLAUDE.md amendment chat `789688a`)

Per the new rule, trace state transitions in BOTH directions AND across both axes of React's commit phase.

### Axis 1: Open + Close

| Direction | Path | State changes | Risk |
|---|---|---|---|
| **Open** | User taps FAB → `addMenuOpen=true` → menu mounts → user taps "Add plant" chip → `setScreen("add-plant")` → user taps "From Vault" chip → `setScreen("add-plant-from-vault")` → PlantingForm mounts inside menu's flex-col panel | UniversalAddMenu internal `screen` state machine | None — fully internal to menu component; no async work between screen transitions |
| **Close** | User taps Cancel (currently no footer Cancel on the new screen — see Pass 2 finding C2 below) → `onClose()` → `addMenuOpen=false` → menu unmounts → PlantingForm unmounts → all internal state lost | Menu unmount cascades PlantingForm unmount cleanly | None — React handles unmount cascade; PlantingForm has no cleanup hooks beyond auto-unmount |
| **Save → close** | PlantingForm `handleConfirm` → DB insert → celebration animation (z-200 fixed, outside menu DOM) → `onSaved()` callback fires → menu closes via `onClose` → menu unmounts mid-celebration? | Celebration animation is `fixed inset-0 z-[200]` — DOM-parent-independent | **Pass 2 concern C3:** verify celebration completes visually after menu unmount. Original PlantingFlowModal closed via `onClose` AFTER `onSuccess` fired (line 90-93: `onSuccess(); onClose();`). PlantingForm's modal mode calls `onSaved()` after the celebration `setTimeout` — let me verify. |

### Axis 2: Forward + Back navigation

| Direction | Path | State changes | Risk |
|---|---|---|---|
| **Forward into screen** | `setScreenDirection("forward"); setScreen("add-plant-from-vault")` → `slideClass = "animate-submenu-slide-forward"` → key="add-plant-from-vault" mounts with slide-in animation | Animation runs on body + header together since both inside `${slideClass} flex-1 min-h-0 flex flex-col` wrapper | None — same as add-plant-manual which is verified working |
| **Back to add-plant** | User taps Back arrow → `goBackToAddPlant()` → `setScreenDirection("back"); setScreen("add-plant")` → `slideClass = "animate-submenu-slide-back"` → key="add-plant" mounts with slide-back animation | PlantingForm unmounts; user loses in-progress form state (date, location, selections, etc.) | **Pass 2 concern C4:** unmount on back = lost form state. Is that the desired UX? Original PlantingFlowModal had same shape (closing modal = lost state). No regression. Verified. |
| **Back to main from add-plant** | (After above) user taps Back on add-plant → `goBackToMain` → `setScreen("main")` → user can re-enter add-plant; "From Vault" sub-screen starts fresh | Two-level back nav; matches existing add-plant-manual back pattern verbatim | None |

### Axis 3: Mount + Unmount on each of 5 page mounts

| Page | Mount path | Unmount path | Risk |
|---|---|---|---|
| Home (`/`) | User opens FAB on home → menu mounts → screen flow as above | User leaves home → page unmounts → menu unmounts (it's mounted inside page) → PlantingForm cleanup | None — pages already mount UniversalAddMenu inside the page render; PlantingForm mount/unmount tied to menu lifecycle |
| Calendar (`/calendar`) | Same shape | Same shape | None |
| Garden (`/garden`) | Same shape | Same shape — except `fromGarden=true` flows through `pathname.startsWith("/garden")` | None — verified via Item 2 prop wiring |
| Journal (`/journal`) | Same shape | Same shape | None |
| Vault (`/vault`) | Same shape — VaultPageContent already mounts the menu | Same shape | None |

### Axis 4: Suspense + lazy resolution

| Aspect | Current state | Post-conversion | Risk |
|---|---|---|---|
| **PlantingFlowModal lazy load** | 5 page mounts use `next/dynamic` with `then(m => ({ default: m.PlantingFlowModal }))` — chunk fetched on first FAB-menu-open via [UniversalAddMenu.tsx:112](src/components/UniversalAddMenu.tsx:112) preload | PlantingFlowModal deleted; PlantingForm imported statically into UniversalAddMenu bundle | **Net effect:** PlantingForm joins menu's main bundle. PlantingForm IS already statically imported by `/vault/plant/page.tsx` so it's already a separate chunk hot-spot. Menu bundle grows by ~PlantingForm size minus the import indirection. Acceptable per cohesion-with-AddPlantModal-template + simplicity. |
| **Unconditional mount pattern** | Current PlantingFlowModal renders `if (!open) return null;` after `useBodyScrollLock(open)` (line 43-45); mount is conditional on `plantingFromVaultOpen` state | Post-conversion: PlantingForm mounts when `screen === "add-plant-from-vault"` (conditional on screen state). Same shape as add-plant-manual which mounts AddPlantModal embedded conditionally. | **No Suspense gap** — static import means no chunk fetch; first mount paints same frame as state change. The c124213 unconditional-mount-with-internal-guard pattern was for `next/dynamic` cases; static imports don't need it. |
| **Add Seed nested picker (z-110)** | PlantingForm has internal `addSeedOpen` state → renders nested picker at z-110/111 fixed positioning | Same — fixed positioning is DOM-parent-independent; renders correctly inside menu z-100 stack | None |
| **Celebration overlay (z-200)** | PlantingForm renders celebration at `fixed inset-0 z-[200]` after save | Same — z-200 > menu z-100, visible regardless of menu state | **Pass 2 concern C3 above — needs trace** |

### Matrix conclusion

All 4 axes traced. 3 follow-up concerns surfaced (C3, C4, plus C2 below) — all addressed in Pass 2.

---

## Audit Pass 1 — Factual

Verifying every code reference exists.

- ✅ `UniversalAddMenuScreen` union at [UniversalAddMenu.tsx:13](src/components/UniversalAddMenu.tsx:13) — verified by Read.
- ✅ `UniversalAddMenuScreenTarget` union at [UniversalAddContext.tsx:10-17](src/contexts/UniversalAddContext.tsx:10) — verified by Read.
- ✅ `add-plant-manual` branch as analog at [UniversalAddMenu.tsx:301-313](src/components/UniversalAddMenu.tsx:301) — verified shape (key + `${slideClass} flex-1 min-h-0 flex flex-col` + child component with embedded prop).
- ✅ `goBackToAddPlant` already defined at [UniversalAddMenu.tsx:131](src/components/UniversalAddMenu.tsx:131) — `() => { setScreenDirection("back"); setScreen("add-plant"); }`.
- ✅ `PlantingForm` import path `@/components/PlantingForm` — verified file exists at [src/components/PlantingForm.tsx](src/components/PlantingForm.tsx).
- ✅ `PlantingForm` props interface matches usage — `profileIds: string[]`, `fromGarden: boolean`, `mode: "page" | "modal"`, `onSaved?: () => void` per [PlantingForm.tsx:28-40](src/components/PlantingForm.tsx:28).
- ✅ `PlantingForm` modal-mode `confirmBarClass` uses `sticky bottom-0 -mx-6 px-4 py-2.5` per [PlantingForm.tsx:495](src/components/PlantingForm.tsx:495) — requires parent `overflow-y-auto px-6` scroll container — menu's `flex-1 min-h-0 overflow-y-auto px-6 pb-2` provides this.
- ✅ ICON_MAP.Back used in current PlantingFlowModal header line 68 — same icon used in add-plant-manual back button.
- ✅ 5 page mounts' file paths + line numbers — verified by Grep output above.
- ✅ No PlantingFlowModal consumers in MyPlantsView / PacketVaultView — grep returned no matches.

**Pass 1 result: clean iter 1.**

---

## Audit Pass 2 — Concerns / gaps / inconsistencies hunt

### Hunt categories named (per CLAUDE.md rule)

For this code batch:
1. State transitions (open/close/forward/back/save) — covered in bidirectional matrix above.
2. Race conditions / async ordering — covered below.
3. Null / empty / many states — covered below.
4. Missing imports / side effects — covered in Pass 1.
5. Mobile-vs-desktop behavior split — covered below.
6. Test coverage gaps — covered below.
7. Cohesion-by-aggregation / micro-aesthetic — covered below.
8. Persona walk (Maya / Sydney / Walter / Aria / Sam) — covered below.
9. RLS / auth assumptions — N/A (no auth surface change).
10. Optimistic-UI vs refetch mismatch — covered as the page-refetch-loss trade-off above.

### Concerns surfaced

**C1 — `pathname` prop usage for `fromGarden`.** Current `<PlantingFlowModal fromGarden={...}>` passes the value from each page's hardcoded knowledge. Garden page passes `fromGarden`. Other 4 pages pass `fromGarden=false` (default). Post-conversion: menu reads `pathname.startsWith("/garden")` to compute `fromGarden` — same logic as add-plant-manual's `stayInGarden` prop ([UniversalAddMenu.tsx:309](src/components/UniversalAddMenu.tsx:309)). Verified `pathname` prop already required + passed by all 5 pages. **Resolution: clean.**

**C2 — Cancel button shape on new screen.** Looking at peer screens:
- `add-plant-manual` has NO Cancel footer — AddPlantModal's own internal Cancel button (in its footer) handles it because AddPlantModal renders its own 3-section shell.
- `seed`/`shed`/`task`/`journal` have NO Cancel footer in the menu wrapper — SeedPacketForm/SupplyForm/TaskForm/JournalEntryForm render their own footers internally.
- `main`/`add-plant` HAVE a Cancel footer (the menu owns it because there's no form to render a footer).

PlantingForm does NOT render a Cancel button — only the Confirm planting button at bottom. So the new screen needs EITHER:
- (a) A footer with Cancel button (menu-owned, matches `main`/`add-plant` shape).
- (b) Cancel-via-Back-arrow only (no separate Cancel; Back returns to add-plant; user re-taps Cancel from add-plant to exit).

Looking at the current PlantingFlowModal: it has a Close button (X icon) in the header, NOT a Cancel button. So users currently close via the X. In the menu, the closest analog is to add a Cancel footer (since the menu's main + add-plant + add-plant-manual subroutines all use Cancel footer where appropriate).

Hmm — but `add-plant-manual` (AddPlantModal embedded) HAS Cancel inside AddPlantModal's own footer. PlantingForm does NOT have a built-in Cancel. So the menu screen needs to provide one.

**Resolution: ADD footer with Cancel button matching the menu's Cancel pattern.** Shape: `flex-shrink-0 px-6 py-4 border-t border-neutral-200` (matches `add-plant` footer at [line 295](src/components/UniversalAddMenu.tsx:295)), `<button onClick={onClose}>Cancel</button>` with the `w-full py-2.5 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10` class.

But wait — does the Cancel footer compete with PlantingForm's Confirm planting button (sticky inside body)? Sticky bottom-0 of the body pins above the menu's footer flex-shrink-0 border-t. So Cancel sits below Confirm planting — both visible, separated by the border. Is that OK aesthetically?

Looking at AddPlantModal embedded inside `add-plant-manual`: its own Save/Cancel footer is INSIDE its content. There's no SECOND menu-level footer beneath it. The menu's main panel doesn't add a footer when add-plant-manual is active.

So the consistent pattern is: when the child component owns its own action footer (Confirm planting in PlantingForm; Save/Cancel in AddPlantModal), the menu does NOT add a wrapping Cancel footer. The user exits via the form's own Cancel (or Back arrow in header for the "I changed my mind" case).

**Revised Resolution C2:** NO menu-level Cancel footer on the new screen. Match peer screens (`add-plant-manual`/`seed`/`shed`/`task`/`journal`) which omit the footer. User exits via:
- Back arrow in header → returns to add-plant sub-screen.
- (No direct "Cancel from this screen to outside the menu" path — same as 4 sibling screens.)

This is the right pattern per cohesion-by-aggregation (anchor to peer screens). Document trade-off: PlantingForm doesn't have a Cancel button, so there's no menu-level Cancel + no form-level Cancel. User who wants out taps Back → Cancel at add-plant level. Two-tap exit. Same shape as `seed`/`shed`/`task`/`journal` peers (those forms have Cancel buttons of their own in their footers, but the user-experience is structurally the same: navigate back through the menu's screen hierarchy to exit, or use the form's own Cancel).

Hmm — but `seed`/`shed`/`task`/`journal` peer forms DO have Cancel buttons in their own footers. PlantingForm does NOT. So PlantingForm is the outlier — the only in-menu form without a self-owned Cancel button.

**Final C2 resolution:** Accept the trade-off for THIS ship — two-tap exit via Back → Cancel. Capture as ADJACENT finding for follow-up: "Add Cancel button to PlantingForm modal-mode footer for cohesion with SeedPacketForm / SupplyForm / TaskForm / JournalEntryForm." This is the cohesion-by-aggregation lesson — flag the gap; don't introduce a new pattern silently.

Rationale for deferring vs. fixing now: PlantingForm's existing Confirm planting button is a single full-width primary button (not the 2-column Cancel-left + Save-right of the form-submit-saga template). Converting to Cancel-left + Confirm-right requires reshaping the footer to match the canonical template — a separate cohesion task that affects BOTH page-mode AND modal-mode of PlantingForm. Per CLAUDE.md "Don't add features beyond what the task requires" — out of scope; flag for follow-up.

**C3 — Celebration animation + onSaved ordering trace.** PlantingForm modal mode: after DB insert succeeds, sets `showSeedlingCelebration=true`, runs animation (CSS `seedling-celebration-seed` + `seedling-celebration-sprout`), then... let me verify the onSaved trigger timing.

I need to check PlantingForm.handleConfirm — does it call onSaved during celebration or after? Need to grep.

(Will verify by reading PlantingForm.handleConfirm in Pass 2 follow-up.)

If onSaved fires DURING celebration → menu closes → PlantingForm unmounts → celebration component unmounts mid-animation (since celebration is rendered INSIDE PlantingForm's return). Visual: celebration cuts off abruptly. Original PlantingFlowModal had same shape but the celebration is `fixed inset-0 z-200` which means it's a portal-like overlay — but it's rendered inside the PlantingForm React tree, so unmounting PlantingForm unmounts the celebration JSX too (even if its DOM is positioned absolutely).

If onSaved fires AFTER celebration timeout → celebration completes → onSaved → menu closes — clean.

**Resolution: must verify the order in PlantingForm.handleConfirm before commit. If currently onSaved fires after a setTimeout that matches celebration duration, we're fine. If it fires immediately, follow-up to fix the ordering.**

Will verify during build.

**C4 — Form-state-loss-on-back.** Verified above in bidirectional matrix. No regression vs. PlantingFlowModal's Close-X behavior (which also lost state). Clean.

**C5 — Suspense / lazy preload removal.** Drop `void import("@/components/PlantingFlowModal").catch(() => {});` from menu's preload effect. PlantingForm becomes statically imported via menu. New menu bundle size larger. Is this a regression?

Looking at the preload pattern — it exists specifically because page-local-state modals (BatchAddSeed, BatchAddSupply, PurchaseOrderImport, PlantingFlowModal) are dynamic-imported by the pages. The preload-on-menu-open warms the chunk cache so chip-tap-to-mount has no Suspense gap. By switching PlantingForm to a static import on UniversalAddMenu, we eliminate the chunk-fetch step — no preload needed, no gap.

**Resolution: clean.** Net: better UX (no Suspense risk), marginally larger menu bundle. Worth the trade-off per Pass 4 lock hygiene confirming VISION §7 "No perceptible gap when transitioning from menu to target modal" is reinforced (not weakened).

**C6 — Test coverage.** Are there tests that mount PlantingFlowModal directly? Grep verified no test files reference PlantingFlowModal. Are there page-level tests that snapshot or interact with `setPlantingFromVaultOpen` state? Need to grep.

Will run grep before commit. If pages have tests asserting on PlantingFlowModal mount conditions, they need updates.

**C7 — Cohesion-by-aggregation micro-decisions.** What new patterns am I introducing? Checking:
- Screen name `"add-plant-from-vault"` — kebab-case matches existing union members ✅
- Header shape (Back arrow + title + spacer) — matches add-plant-manual back shape ✅
- Body padding `px-6 pb-2` — matches current PlantingFlowModal body wrapper [line 85](src/components/PlantingFlowModal.tsx:85) ✅
- No menu-level Cancel footer — matches 4 peer screens ✅
- `key="add-plant-from-vault"` on the slide animation wrapper — matches add-plant-manual `key="add-plant-manual"` shape ✅
- Direct PlantingForm import (no dynamic) — matches 5 peer form imports ✅
- `onSaved={onClose}` callback shape — matches Path Y precedent ✅

No new micro-patterns introduced. All anchored to existing peer paths.

### Persona walk

| Persona | Walk result |
|---|---|
| **Maya** (Power Gardener) | Faster — in-place slide is snappier than bottom-sheet round-trip. No depth loss. Maya wins. |
| **Sydney** (Spring-Planner Hobbyist) | The "From Vault feels different than other menus" feedback IS Sydney's. This fix is for her. Cohesion win. |
| **Walter** (Retiree Gardener, iPad-primary) | Touch targets unchanged (PlantingForm internal buttons preserved). Slide animation is gentler than bottom-sheet rise. Verify no regression on iPad-portrait viewport — embedded mount uses menu's max-w-md instead of bottom-sheet's `sm:max-w-2xl`. PlantingForm at max-w-md may be cramped for the seed list. **Pass 2 concern C8.** |
| **Aria** (Houseplant Urban User) | Doesn't have outdoor vault; unlikely to use From Vault flow. No regression. |
| **Sam** (First-Time Beginner) | Empty vault → no seeds → PlantingForm shows empty Add Seed picker → fine on either modal shape. No regression. |

**C8 — iPad-portrait width concern.** Current PlantingFlowModal: `sm:max-w-2xl` (672px) on iPad+. New in-menu version: menu's `max-w-md` (448px). Net: ~224px narrower on iPad-portrait. PlantingForm's seed list, packet sliders, supply picker may feel cramped at 448px. Per Walter persona (iPad-primary) — concern worth flagging.

**Mitigation options:**
- (a) Accept the cramp — peer screens (`seed`/`shed`/`task`/`journal`) all use the same `max-w-md` and PlantingForm has similar form-shape complexity to AddPlantModal which also uses `max-w-md` in embedded mode. So this is consistent with peers.
- (b) Conditional `max-w` on the menu panel when `screen === "add-plant-from-vault"` — widen to `sm:max-w-2xl` only for this screen. Adds conditional sizing, novel pattern.

**Resolution C8: option (a) — accept the cramp.** Anchored to peer screens. If Walter dogfood reveals genuine usability issue, follow-up = widen menu panel globally OR introduce per-screen sizing. Document the consideration in close-out.

**Pass 2 result:** 3 follow-up findings (C2, C3, C8) — C2 + C8 captured as ADJACENT for future polish; C3 to verify via code-read before commit. Pass 2 needs re-pass after revision (C2 + C3 + C8 captures).

### Pass 2 iteration 2 — re-pass on revised plan

Plan now explicitly captures C2 (no menu-level Cancel; ADJACENT to add Cancel to PlantingForm), C3 (verify onSaved/celebration order at build time), C8 (accept max-w-md cramp; ADJACENT for future width work). Re-passing hunt categories on the revised plan...

- C1-C8 all addressed or captured.
- No new concerns surface.
- Persona walk re-confirmed across 5 personas.

**Pass 2 iteration 2: clean.**

---

## Audit Pass 3 — Sibling pattern sweep

### Trigger grep: "in-menu sub-screen mounting a form component"

Existing siblings:
- `screen === "add-plant-manual"` → mounts `<AddPlantModal embedded ... onBackToMenu={goBackToAddPlant} />`
- `screen === "seed"` → mounts `<SeedPacketForm ... onBack={goBackToMain} />`
- `screen === "shed"` → mounts `<SupplyForm ... onBack={goBackToMain} />`
- `screen === "task"` → mounts `<TaskForm ... onBack={goBackToMain} />`
- `screen === "journal"` → mounts `<JournalEntryForm ... onBack={goBackToMain} />`

**BLOCKING alignments:**
- ✅ Screen union name `"add-plant-from-vault"` — kebab-case, fits naming pattern.
- ✅ `slideClass` wrapper with `key={screen}` — matches all 6 peer branches.
- ✅ `flex-1 min-h-0 flex flex-col` outer shape — matches all 6 peer branches.
- ✅ Back arrow → `goBackToAddPlant` (since the sub-screen comes from add-plant, not main) — matches add-plant-manual's identical use of `goBackToAddPlant`.
- ✅ No standalone Cancel footer at menu level — matches add-plant-manual / seed / shed / task / journal.
- ✅ Child component receives `onClose={onClose}` for success-close — matches add-plant-manual (`onClose={onClose}`).
- ✅ Child component receives back callback (`onBack` or `onBackToMenu`) — PlantingForm doesn't currently take a back callback; the menu's header Back arrow handles it externally (menu owns the back chrome).

**ADJACENT items:**
- **PlantingForm internal header.** PlantingForm doesn't render its own header — page mode has the page's h1; modal mode had PlantingFlowModal's header. The new menu-owned header is consistent with how the menu owns headers for all sub-screens. ✅
- **AddPlantModal C1 embedded vs. PlantingForm direct mount.** AddPlantModal uses `embedded?: boolean` because it has a standalone shell variant (non-FAB empty-state mounts). PlantingForm has no standalone shell — `/vault/plant/page.tsx` provides the page shell, PlantingFlowModal provided the modal shell. With PlantingFlowModal deleted, PlantingForm's two consumers are `/vault/plant/page.tsx` (page mode) and UniversalAddMenu (new modal mode via menu's shell). No `embedded` prop needed on PlantingForm — `mode: "page" | "modal"` already handles the shape switch. ✅
- **Cohesion-by-aggregation: PlantingForm's Confirm planting button.** Uses `bg-emerald-600 hover:bg-emerald-700` ([PlantingForm.tsx:876](src/components/PlantingForm.tsx:876)) — matches the form-submit-saga canonical Save button color. ✅ Anchored. Already aligned by `ba9319f` verify-only pass.

**CONCERN items:**
- PlantingForm doesn't have a Cancel button in modal mode (C2 above). Adjacent to FAB-tree cohesion — but out-of-scope for this ship; logged for follow-up.

**Pass 3 vocabulary-breadth sweep** (per 2026-05-17 rule):
- Searched terms: `screen === "add-plant`, `setPlantingFromVaultOpen`, `PlantingFlowModal`, `onAddPlantFromVault` — all callsites enumerated above.
- Adjacent vocabulary: `From Vault`, `from-vault`, `vault-planting` — grepped: only "From Vault" string at [UniversalAddMenu.tsx:263](src/components/UniversalAddMenu.tsx:263) (the chip label, preserved verbatim) and `onAddPlantFromVault` prop name (being deleted).
- No hidden siblings.

**Pass 3 iteration 1: clean.**

---

## Audit Pass 4 — Lock hygiene

### VISION §10 don't-touch list
- ✅ Plantable banner color treatment — untouched.
- ✅ Calendar grid prominence — untouched.
- ✅ Plantable widget separation — untouched.
- ✅ Plant placeholder PNG — untouched.
- ✅ Active Garden gallery card existence — untouched.
- ✅ Empty-by-default onboarding — untouched.
- ✅ No activity feed at any sharing layer — untouched.

### VISION §11 parked decisions brushed?
- "FAB main button vs. submenu icon style consistency" — untouched (no icon changes).
- "Modal/menu placement on desktop — audit pass needed" — RELATED but not brushed. The conversion makes the From Vault menu use the same `max-w-md` desktop placement as peer screens; consistent with the parked audit's eventual direction (all FAB sub-modals share desktop placement). No new lock decision needed.

### ROADMAP §6 locked decisions
- **Q2=B from `.cursor/plans/fab_tree_modal_consistency.plan.md` Item 1** (locked 2026-05-26): chose bottom-sheet (~90vh phone, sm:max-w-2xl iPad+) over in-menu mount for PlantingFlowModal.

**OVERRIDE BEING APPLIED.** Per CLAUDE.md "When the user's direction contradicts a locked rule":
- Contradiction flagged: this conversion contradicts Q2=B.
- Trade-off surfaced: gain — structural cohesion with peer FAB chips, closes Syd's slide-up-vestigial feedback. Loss — iPad-portrait viewport cramps from ~672px to ~448px (Pass 2 concern C8); user-acknowledged via auto-push greenlight after hearing the framing.
- User reaffirmed: explicit lock in user message *"Q1 — Chapter A: LOCK (A) Convert PlantingFlowModal bottom-sheet → in-menu overlay"* with stated reasoning "C1 now exists as proof, so the in-menu pattern is the canonical FAB shape."
- Override documented in this plan file (Pass 4 section) — per the rule's "AMEND CLAUDE.md if the override implies the rule itself should change permanently" clause: this is a Q2=B-specific override; the broader rule (in-menu canonical FAB shape) is reinforced, not weakened. CLAUDE.md doesn't need amending; ROADMAP §6 will get a 2026-05-27 entry noting the Q2=B override.

### Path Y Q1=Option B (page refetch loss)
- ✅ This conversion accepts the same regression. Consistent with locked precedent. No new lock needed.

### CLAUDE.md provisional bidirectional state-transition tracing rule (commit 789688a)
- ✅ Applied at Pass 1 — all 4 axes traced (Open/Close, Forward/Back, Mount/Unmount, Suspense/Lazy).

**Pass 4 iteration 1: clean** (override documented, all other locks preserved).

---

## Audit summary

- Pass 1 — Factual: clean iter 1.
- Pass 2 — Concerns hunt + persona walk: clean iter 2 (after capturing C2 / C3 / C8).
- Pass 3 — Sibling sweep: clean iter 1.
- Pass 4 — Lock hygiene: clean iter 1 (Q2=B override documented per user explicit reaffirm).

**Audit terminated clean. Proceeding to build.**

---

## Build order

1. Item 1 + Item 2 + Item 3 + Item 4: UniversalAddMenu edits (one file, all surgical) — including PlantingForm import + new screen branch + chip handler rewrite + prop removal.
2. Item 5a-5e: 5 page mounts (Home / Calendar / Garden / Journal / Vault) — symmetric subtractive edits.
3. Item 6: Delete PlantingFlowModal.tsx + drop preload line.
4. Verify PlantingForm.handleConfirm onSaved/celebration ordering (Pass 2 C3 follow-up read).
5. Test surface check: grep for any test referencing `PlantingFlowModal` or `plantingFromVaultOpen` — if found, update / delete.
6. `npm run test:run` + `npm run build`.
7. Concurrent-chat fetch (Phase 2 gate item 9 — code commit on shared files extends naturally per the rule's precedent for the form-submit saga's 5-push chain).
8. Git add specific files + commit + push.
9. Phase 5 close-out (in-place close shape — chat continues).

---

## Open follow-ups (captured for Phase 5 buckets)

**(a) Parked items added this chat:**
- PlantingForm Cancel button cohesion gap (ADJACENT — add Cancel-left + Confirm-right footer matching form-submit-saga canonical template; affects both page-mode + modal-mode PlantingForm; ~M effort).
- iPad-portrait width concern for PlantingForm in menu (ADJACENT — `max-w-md` may cramp seed list / supply picker; gather Walter dogfood signal first).

**(b) Deferred audits / known follow-ups:**
- Real-device dogfood verification of the conversion (Syd phone-tests on prod — verify slide-in-place, Back returns to add-plant, planting completes + celebration visible, refetch loss is OK on Garden/Vault).
- Q2=B override entry in ROADMAP §6 2026-05-27.

**(c) Dogfood-style findings:**
- **First real-world test of CLAUDE.md provisional bidirectional state-transition tracing rule (commit 789688a).** Rule applied at Pass 1; matrix surfaced C3 (celebration timing trace) that wouldn't have been caught by Pass 2 alone. Status: **just-captured** — pattern reinforced.
- **First real-world test of orchestrator-spawn-prompt stale-memory detection (Step 0 search).** Both Chapter A + B framings were stale per current code state; surfaced before plan-of-record locked. User reaffirmed locked decisions for both. Status: **just-captured** — Step 0 ran exactly as designed.
