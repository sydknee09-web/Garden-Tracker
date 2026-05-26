# FAB-form submit pattern standardization + AddPlantModal C1 close

> **Chat:** continuation of the FAB-tree polish saga (Path Y A-D + E shipped 2026-05-19/20 → fab-tree modal-consistency cluster shipped 2026-05-26 commits 488e7f3 / 7242cb6 / aa4c116 / d269f32 / 79c34a7).
> **Phase:** Phase 1 — Kickoff + plan + audit (NOT shipping until Syd greenlights)
> **Plan-of-record file** (>3 files + state-machine changes + locked-decision touches → plan file required per CLAUDE.md plan-audit standard)
> **Audit gate:** Pass 1 factual + Pass 2 concerns hunt + persona walk + Pass 3 sibling sweep + Pass 4 lock hygiene — all 4 pass-types required.

---

## Purpose (one sentence)

Standardize every FAB-tree form on the AddPlantModal submit-affordance template (3-section flex-col shell + fixed-bar footer with Cancel-left + Save-right + disable-until-required-fields-filled) by restructuring `UniversalAddMenu`'s panel to support per-screen fixed-bar footers (Approach B), then migrating 10 forms + closing the deferred AddPlantModal C1 manual-entry asymmetry via clean embedded mount.

## In-scope (12 items, 1 commit chain)

### Foundation
1. **UniversalAddMenu panel restructure** — convert from `rounded-3xl p-6 max-h-[85svh] overflow-y-auto` single-scroll to `rounded-3xl p-0 max-h-[85svh] flex flex-col` so each screen render-block can carry its own header (flex-shrink-0) + body (flex-1 min-h-0 overflow-y-auto) + footer (flex-shrink-0 border-t). Enables fixed-bar footer for every in-menu form.

### In-menu forms (mounted inside UniversalAddMenu's panel via Path Y)
2. **TaskForm** ([NewTaskModal.tsx:258-446](src/components/NewTaskModal.tsx:258)) — migrate to 3-section flex-col + fixed-bar footer (Cancel-left + Save-right side-by-side per AddPlantModal template; CLOSES VISION §11 "stacked vs side-by-side" parked decision). Disable until Title non-empty.
3. **JournalEntryForm** ([QuickLogModal.tsx:390-588](src/components/QuickLogModal.tsx:390)) — migrate to 3-section + fixed-bar. Disable until ≥1 of {`selectedQuickAction !== null`, `note.trim() !== ""`, `photos.length > 0`, `selectedProfileIds.length > 0`} per Syd Q4.
4. **SeedPacketForm.manual** ([QuickAddSeed.tsx:~1020](src/components/QuickAddSeed.tsx:1020)) — migrate to 3-section + fixed-bar per step (choose/manual/link). Preserve existing per-step disable rules; add disable-until-valid where missing.
5. **SeedPacketForm.link** ([QuickAddSeed.tsx:~669](src/components/QuickAddSeed.tsx:669)) — same shell migration; disable until URL non-empty.
6. **SeedPacketForm.choose** — same shell migration; footer = Cancel only (no submit on choose step).
7. **SupplyForm.form** ([QuickAddSupply.tsx:~682](src/components/QuickAddSupply.tsx:682)) — migrate to 3-section + fixed-bar; disable until supply name non-empty.
8. **SupplyForm.link** ([QuickAddSupply.tsx:~448](src/components/QuickAddSupply.tsx:448)) — same shell migration; disable until URL non-empty.
9. **SupplyForm.choose** ([QuickAddSupply.tsx:~429](src/components/QuickAddSupply.tsx:429)) — same shell migration; footer = Cancel only.

### Standalone modals (open via FAB chip close-menu + slide-up)
10. **BatchAddSeed** ([BatchAddSeed.tsx](src/components/BatchAddSeed.tsx)) — migrate outer shell to 3-section flex-col + fixed-bar per step (capture/extracting/review). Disable per step: capture → ≥1 photo attached; review → all items reviewed/named; extracting → no submit (in-flight).
11. **BatchAddSupply** ([BatchAddSupply.tsx](src/components/BatchAddSupply.tsx)) — same shell migration + same per-step disable rules.
12. **PurchaseOrderImport** ([PurchaseOrderImport.tsx](src/components/PurchaseOrderImport.tsx)) — same shell migration; disable until URL or file selected on input step.

### Closure
13. **AddPlantModal C1 — clean embedded mount.** Add `embedded?: boolean` prop to AddPlantModal; when true, drop the outer `fixed inset-0 ...` backdrop + inner panel wrapper (UniversalAddMenu's now-restructured flex-col panel provides the shell). Header / body / footer render into the menu's panel slots directly. NEW `"add-plant-manual"` screen added to `UniversalAddMenu`'s union; "Manual entry" chip in `screen="add-plant"` sub-screen sets `setScreenDirection("forward"); setScreen("add-plant-manual")` instead of closing menu + opening standalone modal. **Sticky-footer preserved in both contexts** (standalone shell unchanged; in-menu mount uses menu panel's now-native fixed-bar). No shim wrapper trick needed — Q1=B made this clean.

### Verify-only
14. **PlantingForm (inside PlantingFlowModal)** ([PlantingForm.tsx:871](src/components/PlantingForm.tsx:871)) — already has own `confirmBarClass` sticky bottom-bar + `confirmButtonDisabled`. Verify visual cohesion against the AddPlantModal template (same `border-t border-neutral-200` separator, same `px-6 py-4` padding, same Cancel-left + Save-right ordering). Tweak inline if drift, but no shell change.

## Out-of-scope (parked or ADJACENT)

- **AddPlantManualModal** ([AddPlantManualModal.tsx:113](src/components/AddPlantManualModal.tsx:113)) — Vault profile → Packets tab "+ Add packet" modal. Same submit-shape sibling but NOT in FAB tree. Logged as **Pass 3 ADJACENT finding**; defer to future polish pass per Syd Q3. Reason: keeps this ship's scope contained.
- **HarvestModal** — not FAB-tree (reached via grow-instance harvest flow). Listed in Syd's brief as "anything else" but it's structurally different (post-harvest end-state flow). Pass 3 ADJACENT finding.
- **EditJournalModal** / **EditPacketModal** / **AddItemModal** / **FeedbackModal** / **InviteMemberModal** — non-FAB-tree edit/utility modals. Pass 3 ADJACENT findings for future cohesion pass.
- **Auth pages** (login/signup/reset/update-password) — non-FAB-tree, separate aesthetic surface (already noted as out-of-scope in VISION §8 form-error treatment 2026-05-26 footnote).
- **Custom date dropdown** — separate chapter parked.

## Success criteria

- Every FAB-tree form (in-menu + standalone) uses the 3-section flex-col + fixed-bar Cancel-left + Save-right template
- Disable-until-required-fields-filled active on every form (no submit-tap-then-error path)
- Enter-key still submits in `<form onSubmit>`-wrapped forms (TaskForm, JournalEntryForm, etc.)
- AddPlantModal C1 closed: Manual entry chip slides forward to in-menu sub-screen (matches the 4 other FAB-tree manual-entry chips); back-arrow slides back to add-plant sub-screen; standalone mount unchanged for non-FAB callers
- VISION §11 "Save / Cancel button consistency across modals" parked decision closes (locked: side-by-side Cancel-left + Save-right + bg-emerald)
- Tests pass (`npm run test:run`); local build clean (`npm run build`)
- Preview MCP mobile-viewport sanity check at 412×915 on a representative form (FAB → Add task chosen as visual proof point)
- Persona walk clean (Maya/Sydney/Walter/Aria/Sam — each form works for each persona)

---

## Required reading (done)

- CLAUDE.md (full) — RULES CARD + Chat Lifecycle Protocol + plan-audit standard + AskUserQuestion-forbidden
- VISION.md §4 Principle 9, §7 FAB & Modals, §8 Design tokens (transitions + form-error), §11 parked decisions (Save/Cancel consistency)
- ROADMAP.md §6 recent FAB-cluster ships (commits 488e7f3 → 025a955)
- Parked plans: `.cursor/plans/fab_addplantmodal_extraction.plan.md` (C1 scope discovery), `.cursor/plans/fab_tree_modal_consistency.plan.md` (closed)
- AddPlantModal as template ([AddPlantModal.tsx:541-973](src/components/AddPlantModal.tsx:541)) — verified shell shape

---

## The AddPlantModal template (single source of truth)

For every form, this is the shell shape we're standardizing on:

```tsx
<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/20" role="dialog" aria-modal="true" aria-labelledby="...-title">
  <div ref={modalRef} className="bg-white rounded-3xl border border-neutral-200/80 shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden" tabIndex={-1}>

    {/* Header — flex-shrink-0 */}
    <div className="flex-shrink-0 px-6 pt-6 pb-4">
      {/* Back arrow OR spacer + h2 + spacer */}
    </div>

    {/* Body — flex-1 min-h-0 overflow-y-auto */}
    <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-2.5 relative">
      <SubmitLoadingOverlay show={submitting} message="..." />
      {/* form fields */}
      {error && <FormError>{error}</FormError>}
    </div>

    {/* Footer — flex-shrink-0 border-t */}
    <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex gap-2.5 justify-end">
      <button type="button" onClick={onClose} disabled={submitting} className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10 disabled:opacity-50">
        Cancel
      </button>
      <button type="submit" disabled={submitting || !canSubmit} className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
        {submitting ? "Saving…" : "Save"}
      </button>
    </div>

  </div>
</div>
```

**For in-menu mounted forms** (after UniversalAddMenu panel restructure), the outer `<div className="fixed inset-0...">` and the inner panel wrapper come from UniversalAddMenu — the form just renders the three flex-shrink-0 / flex-1 / flex-shrink-0 children directly.

**For `<form onSubmit>`-wrapped forms** (TaskForm, JournalEntryForm, etc.), the `<form>` wraps the entire 3-section shell (or just the body+footer if header has no submit-affecting buttons), with submit button being `type="submit"` — preserves Enter-key submit.

---

## Plan — per item

### Item 1: UniversalAddMenu panel restructure (foundation, ships FIRST)

**Files touched:**
- EDIT: [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) — outer panel structure

**Approach:**
- Change line 117 panel from `relative w-full max-w-md rounded-3xl bg-white border border-neutral-200/80 p-6 max-h-[85svh] overflow-y-auto animate-fab-menu-enter pointer-events-auto ${FAB_MENU_SHADOW_CLASS}` to `relative w-full max-w-md rounded-3xl bg-white border border-neutral-200/80 max-h-[85svh] flex flex-col overflow-hidden animate-fab-menu-enter pointer-events-auto ${FAB_MENU_SHADOW_CLASS}`. Drops `p-6` and `overflow-y-auto`; adds `flex flex-col overflow-hidden`.
- Each screen's render-block (currently a single content div with all elements inline) becomes a 3-section triplet: header div with `flex-shrink-0 px-6 pt-6 pb-4`, body div with `flex-1 min-h-0 overflow-y-auto px-6 pb-6`, footer div with `flex-shrink-0 px-6 py-4 border-t border-neutral-200`.
- "main" screen (chip chooser) gets the same triplet — header (h2 "Add"), body (5 chips), footer (Cancel button moves from end-of-body to fixed-bar footer).
- All sub-screens (seed/plant/shed/task/journal + new add-plant-manual) get the same triplet.
- `screenDirection` + `slideClass` animation wrap the body content only (not header/footer) so slide animation runs on the form body, header stays anchored, footer stays anchored. **Pass 2 concern: this may visually change the in-place-slide UX feel — body slides but header/footer don't. Need persona check (Sydney noticing the new slide shape).**

**Alternative considered:** keep current single-scroll panel + nested form scrolls (Q1=C). Rejected per Syd Q1=B.

**Effort:** M (~2h) — surgical structural rework of one file + every sub-screen render-block.

### Item 2: TaskForm migration

**Files touched:**
- EDIT: [src/components/NewTaskModal.tsx](src/components/NewTaskModal.tsx) — both TaskForm body + NewTaskModal shell

**Approach:**
- TaskForm body: convert from current "header div + `<form>` with inline buttons at end" to "header (kept) + `<form>` wrapping body + footer triplet."
- Wrap `<form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto ... + flex-shrink-0 ... border-t">` — or split: `<form>` outer, with body div (`flex-1 min-h-0 overflow-y-auto`) and footer div (`flex-shrink-0 border-t`) inside.
- Footer: Cancel-left + Save-right side-by-side (flips current stacked Save-top + Cancel-below — CLOSES VISION §11 parked).
- Disable: `disabled={saving || !title.trim()}` (add Title-required gating).
- Submit button: `type="submit"` preserved → Enter-key submit works.
- NewTaskModal shell: drop `overflow-y-auto p-6` from panel wrapper line 478; add `flex flex-col overflow-hidden` instead.

**Effort:** S (~45min).

### Item 3: JournalEntryForm migration

**Files touched:**
- EDIT: [src/components/QuickLogModal.tsx](src/components/QuickLogModal.tsx) — both JournalEntryForm body + QuickLogModal shell

**Approach:**
- Same shell migration as TaskForm.
- Disable: `disabled={saving || uploadingPhoto || !canSubmit}` where `canSubmit = selectedQuickAction !== null || note.trim() !== "" || photos.length > 0 || selectedProfileIds.length > 0`. Per Syd Q4 = "at least one of {action / note / photo / linked plant}."
- Preserve Enter-key submit via `type="submit"` in fixed footer.
- QuickLogModal shell: same flex-col conversion as NewTaskModal shell.

**Effort:** S (~45min).

### Items 4-6: SeedPacketForm (choose / manual / link) migration

**Files touched:**
- EDIT: [src/components/QuickAddSeed.tsx](src/components/QuickAddSeed.tsx) — SeedPacketForm body for all 3 steps + QuickAddSeed shell

**Approach:**
- SeedPacketForm renders different step content; each step gets its own 3-section block (header is shared across steps since it has the back-arrow + h2 logic; body and footer differ per step).
- Choose step footer: Cancel only (no submit on chip chooser).
- Manual step footer: Back (back-to-choose) + Add to vault (disable until plant name non-empty for new-mode; preserve existing per-step disable for existing-mode); side-by-side.
- Link step footer: Back + Import (disable until URL non-empty); side-by-side.
- QuickAddSeed standalone shell: flex-col conversion.
- In-menu mount (when SeedPacketForm renders inside UniversalAddMenu): per Item 1, the menu's panel provides the shell — SeedPacketForm just renders the header/body/footer triplet directly.

**Effort:** M (~1.5h) — 3 step shapes × footer-per-step + standalone shell + in-menu mount.

### Items 7-9: SupplyForm (choose / form / link) migration

**Files touched:**
- EDIT: [src/components/QuickAddSupply.tsx](src/components/QuickAddSupply.tsx) — SupplyForm body for all 3 steps + QuickAddSupply shell

**Approach:** mirror SeedPacketForm exactly (same 3-step shape, same footer-per-step rules).
- Choose step footer: Cancel only.
- Form step footer: Back/Cancel-left + Save-right (disable until supply name non-empty).
- Link step footer: Back + Import (disable until URL non-empty); side-by-side.

**Effort:** M (~1.5h).

### Item 10: BatchAddSeed migration

**Files touched:**
- EDIT: [src/components/BatchAddSeed.tsx](src/components/BatchAddSeed.tsx)

**Approach:**
- Outer modal shell converts to 3-section flex-col (matches AddPlantModal pattern).
- Header: existing header content (Back + h2 + Close) moves into `flex-shrink-0 px-6 pt-6 pb-4`.
- Body: existing step-state content into `flex-1 min-h-0 overflow-y-auto px-6 pb-6`.
- Footer: NEW `flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex gap-2.5 justify-end` containing the step-specific primary action button. Currently buttons are INSIDE the body at end of each step — move to footer slot.
- Per-step disable:
  - capture step: disable Load Plant Profile Picture button until `pendingCount > 0` (already implemented at line 1035 — preserve)
  - extracting step: button hidden / disabled (in-flight; no user action)
  - review step: disable Save/Confirm until all items are named/reviewed (verify current disable logic)
- Footer also adds Cancel-left where appropriate (currently Close-X is in the header — keep header Close; footer Cancel may not be needed since header Close already exists).

**Effort:** M (~1.5h) — multi-step modal with 3 distinct step layouts.

### Item 11: BatchAddSupply migration

**Files touched:**
- EDIT: [src/components/BatchAddSupply.tsx](src/components/BatchAddSupply.tsx)

**Approach:** mirror BatchAddSeed exactly (same 3-step shape).

**Effort:** S-M (~1h) — smaller file (480 LOC vs 1046).

### Item 12: PurchaseOrderImport migration

**Files touched:**
- EDIT: [src/components/PurchaseOrderImport.tsx](src/components/PurchaseOrderImport.tsx)

**Approach:** same 3-section shell conversion + per-step footer.
- Input step footer: Extract button (disable until URL or file present).
- Extracting step: in-flight, no footer action.
- Review step: Save All + Cancel side-by-side; disable Save until all rows validated.

**Effort:** S-M (~1h) — 374 LOC.

### Item 13: AddPlantModal C1 — clean embedded mount

**Files touched:**
- EDIT: [src/components/AddPlantModal.tsx](src/components/AddPlantModal.tsx) — add `embedded` prop
- EDIT: [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) — add `"add-plant-manual"` to screen union + new screen render block + rewire Manual entry chip
- EDIT: 5 page mounts (home / garden / calendar / journal / vault page) — drop the standalone-mount handler for FAB-flow (keep `openPlant()` context callers for non-FAB triggers)

**Approach (per Syd Q2 = clean embedded — Q1=B made this trivial):**
1. AddPlantModal grows `embedded?: boolean` prop (default false). When true:
   - Skip the outer `<div className="fixed inset-0 z-[60]...">` backdrop wrapper
   - Skip the inner panel wrapper `<div ref={modalRef} className="bg-white rounded-3xl ... flex flex-col overflow-hidden">` (menu's panel provides this)
   - Skip `useFocusTrap` and `useBodyScrollLock` (menu owns these; single-source-of-truth)
   - Render the 3-section triplet (header div + body div + footer div) directly — menu's restructured panel lays them out
2. The `enrichmentFailed` secondary modal at AddPlantModal.tsx:977 stays as-is (already `fixed inset-0 z-[60]` — positioning is DOM-parent-independent). Verified.
3. UniversalAddMenu:
   - Add `"add-plant-manual"` to `UniversalAddMenuScreen` union
   - Add new `<div key="add-plant-manual" className={slideClass}>` render block in the menu's switch/render logic, rendering `<AddPlantModal open embedded onClose={onClose} onBackToMenu={() => { setScreenDirection("back"); setScreen("add-plant"); }} defaultPlantType={addPlantDefaultType} stayInGarden={pathname.startsWith("/garden")} hidePlantTypeToggle={pathname.startsWith("/garden")} />`
   - In `screen="add-plant"` sub-screen: change "Manual entry" chip handler from `onClose() + onAddPlantManual()` (closes menu + opens standalone modal) to `setScreenDirection("forward"); setScreen("add-plant-manual")` (slides in-place)
   - Drop the now-unused `onAddPlantManual` prop from `UniversalAddMenuProps` interface
4. 5 page mounts: drop `onAddPlantManual={openPlant}` prop wiring on `<UniversalAddMenu>` (keeps `openPlant` available in context destructure for non-FAB callers).

**Effort:** M (~1.5h).

---

## Pass 1 — Factual cite-by-path

To re-verify after revisions (each cite has been confirmed via Read/Grep against the codebase):

- [ ] `AddPlantModal.tsx:541` — 3-section shell pattern verified (header flex-shrink-0 + body flex-1 min-h-0 overflow-y-auto + footer flex-shrink-0 border-t)
- [ ] `AddPlantModal.tsx:966-973` — fixed footer with Cancel + Save buttons, `disabled={submitting || (mode === "new" && !plantName.trim())}` template
- [ ] `AddPlantModal.tsx:977-1010` — `enrichmentFailed` secondary modal at `fixed inset-0 z-[60]` — DOM-parent-independent; survives embedded mount
- [ ] `NewTaskModal.tsx:279` — TaskForm uses `<form onSubmit={handleSubmit}>` wrapper
- [ ] `NewTaskModal.tsx:428-443` — Submit button stacked above Cancel (VISION §11 parked anti-pattern)
- [ ] `NewTaskModal.tsx:431` — `disabled={saving}` only (no validation gating)
- [ ] `NewTaskModal.tsx:478` — NewTaskModal shell uses `overflow-y-auto rounded-3xl p-6 max-h-[85vh]` (single-scroll, not flex-col)
- [ ] `QuickLogModal.tsx:417` — JournalEntryForm uses `<form onSubmit={handleSubmit}>` wrapper
- [ ] `QuickLogModal.tsx:573-585` — Side-by-side Cancel + Save inline at end-of-form
- [ ] `QuickLogModal.tsx:577` — `disabled={saving || uploadingPhoto}` only
- [ ] `QuickLogModal.tsx:625` — QuickLogModal shell uses `overflow-y-auto p-6 max-h-[85vh]` (single-scroll)
- [ ] `QuickAddSeed.tsx:1020-1043` — SeedPacketForm.manual buttons inline at end
- [ ] `QuickAddSupply.tsx:682-690` — SupplyForm.form buttons inline at end
- [ ] `BatchAddSeed.tsx:1033-1036` — Load Plant Profile Picture button has `disabled={saving || pendingCount === 0}`
- [ ] `BatchAddSupply.tsx:462-464` — handleExtractAll button has `disabled={readyCount === 0}`
- [ ] `PurchaseOrderImport.tsx:341-343` — handleExtract button has `disabled={isExtracting}` only
- [ ] `PlantingForm.tsx:871-880` — has own `confirmBarClass` sticky bottom-bar + `confirmButtonDisabled` (verify visual cohesion only)
- [ ] `UniversalAddMenu.tsx:117` — current panel structure is single `p-6 max-h-[85svh] overflow-y-auto` (target for restructure)
- [ ] `AddPlantManualModal.tsx:113` — out-of-scope sibling; ADJACENT finding
- [ ] VISION §11 "Save / Cancel button consistency across modals (raised 2026-05-08)" — confirmed parked, this work CLOSES it

## Pass 2 — Concerns / gaps / inconsistencies hunt

**Hunt categories named for this plan:**

- **State machine traces** — UniversalAddMenu's `screen` state + `screenDirection` interaction with new `add-plant-manual` screen; AddPlantModal's mode/plantType state preserved across embedded mount
- **Form-submit-semantics regressions** — Enter-key submit MUST be preserved on `<form onSubmit>`-wrapped forms (TaskForm, JournalEntryForm, SeedPacketForm, SupplyForm)
- **Disable-until-valid edge cases** — JournalEntryForm "at least one of" logic; multi-step forms (Batch/PurchaseOrder) per-step disable rules
- **Focus trap + body scroll lock single-source-of-truth** — when AddPlantModal is embedded, menu owns these; standalone, modal owns; ensure no double-lock or double-trap
- **Animation interaction** — slide animation on screen change wraps body only (per Item 1); header/footer stay anchored — visual feel may differ from current full-content slide; persona check
- **Z-index hierarchy** — AddPlantModal's `enrichmentFailed` secondary modal at z-[60] mounted INSIDE menu's z-[100] panel; verify no stacking surprises
- **Mobile-vs-desktop behavior** — `max-h-[85svh]` on menu panel ensures mobile cutoff doesn't reoccur (U23 lesson); standalone modals use `max-h-[85vh]`; verify both work at iPad-portrait + desktop
- **Cohesion-by-aggregation / micro-aesthetic** — every form ends up with the same shell, same footer padding, same gap, same Cancel-color + Save-color tokens; explicit anchor: AddPlantModal:541-973
- **Persona walk** — Maya / Sydney / Walter / Aria / Sam

**Concerns to surface in Pass 2 re-audit (after revisions, looping until clean):**

- **C1: Enter-key submit on JournalEntryForm with empty form.** Current: `<form onSubmit>` wrapping; Enter triggers submit; submit button disabled doesn't prevent form submission via Enter on input. Fix: validation gate at top of `handleSubmit` already returns early on empty (currently `if (!user?.id || !selectedQuickAction)` etc.) — verify the new "at least one of" canSubmit is also checked inside handleSubmit, not just at button disable.
- **C2: SubmitLoadingOverlay positioning under new flex-col body.** AddPlantModal uses `<SubmitLoadingOverlay show={submitting} message="...">` inside `relative` body container — overlay covers body only, not header or footer. Verify same positioning works for all migrated forms (overlay should NOT cover the footer's Cancel button so user can still cancel mid-submit if needed).
- **C3: BatchAddSeed extracting step "no footer action" UX.** Currently the extracting step shows in-flight spinner inline. Under fixed-bar footer pattern, the footer would be empty / display nothing on extracting step. **Question for Pass 2**: does the footer render an empty bar (looks weird), or does the footer hide entirely on extracting step (footer height jumps)? Resolution: footer shows a Cancel button on every step (lets user abort even mid-extract). Primary action button hidden on extracting step. Cancel always present.
- **C4: PurchaseOrderImport "Extract" step's URL or file input.** Disable-until-valid: `disabled={!urlInput && !fileInput}` — both fields are optional-but-one-required. Verify there's a clean way to express this for the user (placeholder text "Paste URL or upload file" makes the OR clear).
- **C5: SeedPacketForm.manual existing-mode submit gating.** Currently the existing-mode button is `disabled={submitting || addedToVault}`. The plan adds disable-until-valid which for existing-mode means "selectedProfileId truthy + packet selected (if seasonal)." Need to codify per-mode disable logic carefully.
- **C6: UniversalAddMenu panel `p-6` removal breaks current spacing.** Removing `p-6` from outer panel means each screen's header/body/footer must each have their own `px-6` + appropriate `py-*` — sweep every screen's render block.
- **C7: animate-fab-menu-enter on initial open.** When menu opens, the entire panel scale-up + fade-in animates. Under new flex-col + body-only-slide, the initial open still uses `animate-fab-menu-enter` on the panel — verified this works (animation applies to outer panel container, not body content).
- **C8: AddPlantModal embedded mount loses `bg-white rounded-3xl border ...` inner panel chrome.** Currently the AddPlantModal's inner panel is `bg-white rounded-3xl border border-neutral-200/80 shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden`. When embedded, menu's panel provides bg-white/rounded/border/shadow/max-w/max-h/flex-col/overflow-hidden — match equivalent. Verify menu panel post-restructure has same visual chrome.

**Persona walk:**

- **Maya (Power Gardener):** All forms feel more consistent — every Save lives in the same spot (bottom-right of fixed-bar). No regressions to her batch flows (PlantingForm unchanged shell; BatchAddSeed multi-photo flow preserved). Universal disable-until-valid surfaces the "almost ready" signal as she fills forms — small win.
- **Sydney (Spring-Planner Hobbyist):** This is the persona that benefits most. The whole point is "every FAB-form behaves the same way." Previously TaskForm flipped Save above Cancel; QuickLog had side-by-side; some flows had inline buttons that scrolled off; she had to learn each form's quirks. After: one shell, one footer, one disable rule. Cohesion claim is real for her.
- **Walter (Retiree Gardener):** Fixed-bar footer = Save always visible without scrolling. Big win for iPad-primary + larger-finger affordance. Cancel-left + Save-right cohesion makes button location predictable across forms. Disable-until-valid prevents accidental-tap-empty-form frustration. Universally positive.
- **Aria (Houseplant Urban User):** Uses FAB rarely; cohesion doesn't matter as much. But when she does use it (one-off journal entry, one-off plant add), the form behaving like every other form is small-quiet-good. No persona regression.
- **Sam (First-Time Beginner):** First impression matters. Fixed-bar Save means she always knows where to tap; disable-until-valid teaches her "this form needs X" without an error toast. Reduces friction on first add-plant / first add-task / first add-journal — exactly when first impressions form. Universally positive.

**No persona is excluded by this change. Pass 2 persona walk = clean.**

## Pass 3 — Sibling pattern sweep

**Vocabulary-breadth grep families to run (per CLAUDE.md 2026-05-17 vocab-breadth sub-rule):**

- **Modal shell patterns:** `fixed inset-0|max-h-\[85vh\]|max-h-\[85svh\]|max-h-\[90vh\]|max-w-md|max-w-lg|max-w-2xl|flex flex-col overflow-hidden|rounded-3xl bg-white|animate-modal-slide-up|animate-fab-menu-enter` — find all modal shells and verify cohesion treatment matches AddPlantModal template
- **Footer / button-row patterns:** `border-t border-neutral|border-t border-black|justify-end gap-|flex gap-3 pt-2|flex gap-2 pt-|space-y-2 pt-2|space-x-2|w-full py-3 rounded-xl bg-emerald` — find all submit-affordance shapes
- **Disable patterns:** `disabled=\{saving|disabled=\{submitting|disabled=\{importing|disabled=\{isExtracting|disabled=\{loading|disabled=\{!.*\.trim|disabled=\{!.*\.length|disabled=\{readyCount|disabled=\{pendingCount` — find all disable expressions across forms
- **Form-wrapper patterns:** `<form onSubmit=|onSubmit=\{handleSubmit|type="submit"` — find all `<form>`-wrapped submits (Enter-key behavior surface)
- **Cancel-button patterns:** `border-teal-gus/40|text-teal-gus|hover:bg-teal-gus/10|w-full py-2.5 rounded-3xl border` — find all Cancel-button color tokens; verify cohesion (locked: teal-gus/40 + text-teal-gus + hover:bg-teal-gus/10)
- **Save-button patterns:** `bg-emerald-600|bg-emerald hover:bg-emerald-700|bg-emerald-900` — find all Save-button color tokens; AddPlantModal uses `bg-emerald-600 hover:bg-emerald-700`; other forms vary (TaskForm uses `bg-emerald` shorthand, AddPlantManualModal uses `bg-emerald-900` — surface for canonicalization)
- **Header / back-arrow patterns:** `aria-label="Back"|ICON_MAP.Back|setScreenDirection|backToMenu` — verify back-arrow pattern matches template

**Expected findings + classifications:**

- **BLOCKING — TaskForm stacked Save-above-Cancel:** VISION §11 parked decision; this work CLOSES the parked decision. Migration MUST flip to side-by-side Cancel-left + Save-right.
- **BLOCKING — Save-button color drift:** AddPlantModal `bg-emerald-600` (= #059669); TaskForm `bg-emerald` (= emerald.DEFAULT = #10b981 = emerald-500); JournalEntryForm `bg-emerald-600`; SeedPacketForm/SupplyForm `bg-emerald` (= #10b981); BatchAddSeed/Supply `bg-emerald` (= #10b981); PurchaseOrderImport `bg-emerald` (= #10b981); AddPlantManualModal `bg-emerald-900` (= #064e3b — out of scope ADJACENT). **Verified against `tailwind.config.ts` lines 26-39.** Canonicalize migrated forms to `bg-emerald-600 hover:bg-emerald-700` — matches AddPlantModal template exactly. Visual impact: Save buttons on TaskForm + SeedPacketForm + SupplyForm + BatchAddSeed + BatchAddSupply + PurchaseOrderImport slightly darken (emerald-500 → emerald-600, a small but visible shift). JournalEntryForm already at emerald-600 (no change). Per VISION §11 "Save / Cancel button consistency" closure — this IS the locked direction.
- **ADJACENT — AddPlantManualModal** ([AddPlantManualModal.tsx:224-241](src/components/AddPlantManualModal.tsx:224)) — same shape sibling out of FAB tree. Logged for future polish pass.
- **ADJACENT — HarvestModal** — has its own submit pattern; out of FAB tree but related shape. Future polish.
- **ADJACENT — EditJournalModal** — edit pattern peer of JournalEntryForm; will drift if not migrated together. **Question for Syd: bundle EditJournalModal now (same shape; minimal extra cost) or strictly hold scope?** Defer-to-Syd; recommendation = hold scope tight (defer ADJACENT to future polish pass).
- **CONCERN — `bg-emerald` shorthand alias** — if `bg-emerald` resolves to a different shade than `bg-emerald-600`, the migration introduces a color shift on TaskForm. Resolve in Pass 4 via tailwind.config.ts lookup.
- **CONCERN — `border-teal-gus/40 text-teal-gus` Cancel-button token** — locked as Cancel-button convention across multiple forms; verify it stays consistent after migration (no accidental drift to `border-neutral-300 text-neutral-700`).
- **CONCERN — multi-step modals (BatchAddSeed/Supply/PurchaseOrder)** — fixed-bar footer with EMPTY footer on extracting step looks weird; resolution (per C3): always render a Cancel button on every step + hide primary action button on in-flight steps.

## Pass 4 — Lock hygiene

**Locked decisions to verify don't get brushed (or to verify this work intentionally closes):**

- [ ] **VISION §1 Operating Principle 7 (Cohesion as a quality bar)** — THIS WORK directly serves this principle. ✅ Aligned.
- [ ] **VISION §4 Principle 9 (mobile-first + desktop responsive in every commit)** — Every form must work on phone-portrait AND iPad+ desktop. Fixed-bar footer with `max-w-md w-full` shell already responsive. Pass 2 persona walk covers this. ✅ Aligned.
- [ ] **VISION §7 (FAB & modals) — Three transition languages approved (2026-05-08)** — UniversalAddMenu panel restructure preserves `animate-fab-menu-enter` on outer panel; sub-screen slides via `animate-submenu-slide-forward|back` on body content only. ✅ Aligned.
- [ ] **VISION §7 — "No perceptible gap when transitioning from menu to target modal"** — AddPlantModal C1 embedded mount stays in-menu (no modal transition needed); other standalone modals still use existing menu-fade-out + modal-slide-up overlap pattern. ✅ Aligned.
- [ ] **VISION §8 Design Tokens — Transitions table** — 200ms entries / 150ms exits preserved. ✅ Aligned.
- [ ] **VISION §8 Design Tokens — Form-level error treatment (locked 2026-05-26)** — FormError component at bottom of form, italic red + warning icon. PRESERVED in every migrated form (kept in body, not moved to footer). ✅ Aligned.
- [ ] **VISION §10 don't-touch list** — none of the 7 items are brushed by this work (Plantable banner, Calendar grid prominence, Plantable widget separation, plant-placeholder PNG, Active Garden gallery card, empty-by-default onboarding, no-activity-feed — all unrelated). ✅ Verified.
- [ ] **VISION §11 — "Save / Cancel button consistency across modals" (parked 2026-05-08)** — **THIS WORK CLOSES THE PARKED DECISION.** Locked direction: side-by-side Cancel-left + Save-right + `bg-emerald-600` brand token. NewTaskModal stacked pattern flips to side-by-side. ✅ Closes parked decision (capture in ROADMAP §6 decision log at ship time).
- [ ] **VISION §11 — "Modal/menu placement on desktop — audit pass needed" (parked, re-flagged 2026-05-17)** — this work does NOT close the broader desktop-modal-placement audit (separate larger scope). But it DOES standardize the in-FAB-tree modal shell shape which is a precondition for the desktop audit. Stays parked. Flag in plan log. ✅ Unrelated; not brushed.
- [ ] **VISION §11 — "Calendar task row primitive" / "App-wide icon density" / "HarvestModal end-state realization"** — all unrelated; not brushed. ✅ Verified.
- [ ] **ROADMAP §6 Decision log — FAB transition standard (amended 2026-05-20)** — this work realizes the "all FAB picks = symmetric submenus" lock more completely by closing the AddPlantModal Manual entry asymmetry. ✅ Closes C1 deferral.
- [ ] **CLAUDE.md push tiers** — code ship; needs explicit "yes build" greenlight per push.
- [ ] **CLAUDE.md role-lock + AskUserQuestion-forbidden** — this plan commits recommendations + executes; clarifying questions surfaced as plain-English asks at end of message; NO AskUserQuestion calls. ✅ Compliant.
- [ ] **Concurrent-chat fetch gate (Phase 2 readiness item 9)** — must run `git fetch origin main` + `git diff origin/main` BEFORE final ship to catch any parallel-chat amendments to canonical docs. Logged for pre-push step.

---

## Phase 2 readiness gate (BEFORE Phase 3 execute)

- [x] Purpose stated in one sentence ✅
- [x] Acceptance criteria specific + testable ✅ (Success criteria above)
- [x] Files to be modified enumerated (path-level) ✅ (per-item file lists)
- [x] Edge cases listed (Pass 2 content) ✅ (concerns C1-C8 + persona walk)
- [x] Sibling sweep run ✅ (Pass 3 vocab grep families named + expected classifications listed)
- [x] Lock-hygiene confirmed (Pass 4) ✅ (every relevant lock checked; VISION §11 explicitly closes)
- [x] Aesthetic decisions surfaced and answered ✅ (Q1=B / Q2=clean embedded / Q3=defer / Q4=at-least-one-of locked in chat 2026-05-26)
- [ ] User "yes build" greenlight received ⏳ — pending Syd plan-review skim
- [ ] `git fetch origin main` + diff vs HEAD — pending pre-execute

---

## Effort + sequencing summary

| Phase | Item(s) | Effort | Order | Dependencies |
|---|---|---|---|---|
| **Commit 1: Foundation** | Item 1 — UniversalAddMenu panel restructure | M (~2h) | First | None — foundation enables every subsequent fixed-bar |
| **Commit 2a: Single-step in-menu forms** | Items 2-3 — TaskForm, JournalEntryForm | S-M (~1.5h) | Second | Commit 1 |
| **Commit 2b: Multi-step in-menu forms** | Items 4-9 — SeedPacketForm (3 steps × 2 modes), SupplyForm (3 steps) | M-L (~2.5h) | Third | Commit 1 |
| **Commit 3: Standalone multi-step modals** | Items 10-12 — BatchAddSeed, BatchAddSupply, PurchaseOrderImport | M (~3h) | Fourth | None — independent shell migrations |
| **Commit 4: AddPlantModal C1** | Item 13 — embedded prop + menu rewire + 5-page mounts | M (~1.5h) | Fifth | Commit 1 (menu structure) |
| **Verify-only** | Item 14 — PlantingForm visual cohesion check | XS (~15min) | Bundled with closest commit | None |

**Total estimated: 9.75-10.5h across 5 sub-commits.** Amendment from original 4-commit plan logged 2026-05-26 mid-execute: SeedPacketForm.manual step has multi-mode sub-shape (link-to-existing × add-new × preSelectedProfileId branches) that pushes its migration complexity past "single commit with TaskForm/JournalEntryForm" boundary. Splitting Commit 2 into 2a (single-step simpler forms) + 2b (multi-step multi-mode forms) improves revert safety + smaller per-commit review surface — aligned with Syd's stated commit-shape values.

**Alternative: bundle all 4 commits into 1 if Syd prefers a single ship.** Slightly higher revert blast-radius but tighter end-state cohesion.

---

## Open questions to Syd (in chat after this plan is shown)

Per CLAUDE.md role-lock + Rule A+C: Plain-English asks at end of next message, each with `(Recommended)` first option per Rule C.

1. **Commit-shape preference** — 4 separate commits (recommended for revert safety) vs 1 bundled commit (tighter end-state cohesion). Recommend 4 commits.
2. **Save-button color shift acknowledged** — Pass 1 verified: `bg-emerald` (= #10b981 / emerald-500) ≠ `bg-emerald-600` (= #059669). 5 forms currently use `bg-emerald`: TaskForm, SeedPacketForm, SupplyForm, BatchAddSeed, BatchAddSupply, PurchaseOrderImport. Migration canonicalizes all to `bg-emerald-600 hover:bg-emerald-700` per AddPlantModal template — a small but visible Save-button darkening on these 5 forms. JournalEntryForm + AddPlantModal already at emerald-600 (no change). VISION §11 "bg-emerald vs bg-emerald-600" parked sub-question resolves to: locked at `bg-emerald-600`.

---

## Plan-of-record meta

- **Created:** 2026-05-26 — chat resuming from socket-error mid-draft
- **Audit log lives in this file** (not chat scrollback) per CLAUDE.md plan-audit standard (≥3 files + state-machine touches + locked-decision touches → plan file required)
- **Closes:**
  - Parked plan `.cursor/plans/fab_addplantmodal_extraction.plan.md` (AddPlantModal C1 extraction)
  - VISION §11 "Save / Cancel button consistency across modals (raised 2026-05-08)"
  - The "FAB-tree polish saga" thread that's been running since Path Y A-D (2026-05-19)
- **Logs as ADJACENT for future polish pass:** AddPlantManualModal, HarvestModal, EditJournalModal, EditPacketModal, AddItemModal, FeedbackModal, InviteMemberModal, auth pages
