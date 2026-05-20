# Plan — Add-button menu transition unification (U7) — Path Y, all 5 picks use in-place slide

> **Status:** Planning doc only. No code edits yet. Path Y greenlit by Syd 2026-05-19 in `trusting-bassi-1cc9ff` chat after a misfire ship (`e7d59d7`) used the wrong shape.
> **Maps to:** [BUGS.md U7](../BUGS.md) — *"FAB transitions: 'Add seed' smooth in-place transition; other 3 submenus close + reopen — feels glitchy. Pick one model (in-place sub-screen for all) and align."*
> **Supersedes:** the prior Option-A-vs-Option-B planning version of this file. Decision is locked: **Path Y — all 5 picks use the in-place slide pattern Add Plant already uses. Forms live inside the menu. Menu container stays mounted throughout the FAB flow.**

---

## 1. Framing — why this revision exists

A prior ship (`e7d59d7`, 2026-05-19) attempted the lighter Option B from the older version of this plan (choreographed exit animation + slide-up at matched anchor). Syd reviewed and rejected the shape — the close-then-open feel was still present even with the choreography. Her exact direction: *"I wanted to mimic the add plant module where it's smooth. I don't want it to close. I want the menu to stay open and the new page to generate. Just like how the add plant menu slides in."*

That confirms the actual intent is the literal Add Plant pattern extended to all 5 picks. The menu container stays mounted through the entire FAB flow. Form content slides in within the same container, not as a separate modal.

This document replaces the old plan with the corrective scope.

---

## 2. Inheritance source — what's being reused verbatim

The Add Plant in-place slide lives entirely inside `src/components/UniversalAddMenu.tsx` plus two CSS keyframes in `src/app/globals.css`. Every mechanism listed below is reused as-is. Nothing in this list gets reinvented.

| Mechanism | Where it lives today | What changes |
|---|---|---|
| `screen` state union | [UniversalAddMenu.tsx:54](../../src/components/UniversalAddMenu.tsx) — `"main" \| "add-plant"` | Expand to `"main" \| "add-plant" \| "seed" \| "shed" \| "task" \| "journal"` |
| `screenDirection` state | [UniversalAddMenu.tsx:56](../../src/components/UniversalAddMenu.tsx) | Unchanged |
| Forward-slide animation | [globals.css:224-235](../../src/app/globals.css) — `@keyframes submenu-slide-forward` + `.animate-submenu-slide-forward` (200ms ease-out) | Unchanged. Each new screen wraps in `<div className={slideClass}>`. |
| Back-slide animation | [globals.css:237-249](../../src/app/globals.css) | Unchanged |
| `slideClass` derivation | [UniversalAddMenu.tsx:79](../../src/components/UniversalAddMenu.tsx) | Unchanged |
| Reset-screen-on-open `useEffect` | [UniversalAddMenu.tsx:58-63](../../src/components/UniversalAddMenu.tsx) | Unchanged |
| `useBodyScrollLock(open)` | [UniversalAddMenu.tsx:65](../../src/components/UniversalAddMenu.tsx) | Unchanged |
| Inner Back-button layout | [UniversalAddMenu.tsx:160-165](../../src/components/UniversalAddMenu.tsx) — `flex items-center gap-2 mb-4` with Back arrow + `text-center` h2 | Identical layout for each new sub-screen |
| Cancel button at bottom | [UniversalAddMenu.tsx:234-236](../../src/components/UniversalAddMenu.tsx) | Identical layout for each new sub-screen |
| Container panel shell | [UniversalAddMenu.tsx:85-90](../../src/components/UniversalAddMenu.tsx) — `relative w-full max-w-md rounded-3xl bg-white border ... p-6 max-h-[85svh] overflow-y-auto` | **Stays mounted across all 5 screens.** Animation class remains `animate-fab-menu-enter` for the lifetime of the menu — never swaps to an exit class. |

---

## 3. What gets dropped from `e7d59d7`

The misfire ship added orchestration that's incompatible with the in-place pattern. All of it is removed.

- `@keyframes fab-menu-exit` + `.animate-fab-menu-exit` utility class added to [globals.css](../../src/app/globals.css) — deleted.
- `.animate-fab-menu-exit` reference inside the `prefers-reduced-motion` media-query block — deleted.
- `isExiting` state, `pendingActionRef`, `fallbackTimerRef`, `beginExit`, `runPending`, `handleClose`, `handleAnimationEnd`, `EXIT_FALLBACK_MS` constant in [UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx) — deleted.
- Anchor shift to `items-end sm:items-center pb-20 sm:pb-4` on the menu wrapper at [UniversalAddMenu.tsx:84](../../src/components/UniversalAddMenu.tsx) — reverted to the pre-`e7d59d7` `items-center justify-center`.

---

## 4. The only invention — form sub-components (mechanical extraction)

Each of the 4 modal files needs its form body separated from its modal shell so it can render in two places: inside `UniversalAddMenu` (when reached via the add-button menu) and inside its own standalone modal shell (when mounted by non-add-button callers — vault page, shed page, etc.).

This is mechanical, not design. The new sub-components don't change form behavior, validation, submit paths, photo capture, or any user-facing details. They just separate "the form" from "the surrounding modal frame."

**Shell-vs-form boundary in each modal** (confirmed via grep — the panel-open line is where the form body starts):

| Modal | LOC | Shell ends at | New form sub-component (named export, same file) |
|---|---|---|---|
| [QuickLogModal.tsx](../../src/components/QuickLogModal.tsx) | 584 | L379 (`animate-modal-slide-up` panel) | `<JournalEntryForm>` |
| [NewTaskModal.tsx](../../src/components/NewTaskModal.tsx) | 451 | L258 | `<TaskForm>` |
| [QuickAddSeed.tsx](../../src/components/QuickAddSeed.tsx) | 1127 | L510 (plus a secondary return at L1120 that needs separate handling — likely a nested confirmation modal) | `<SeedPacketForm>` |
| [QuickAddSupply.tsx](../../src/components/QuickAddSupply.tsx) | 691 | L330 | `<SupplyForm>` |

**Extraction rules** (apply to all 4 modals):

1. Lift the entire panel-inner content (everything between the panel open and panel close `</div>`) into a new function component declared in the same file as a named export. No new files — keeps git-blame readable.
2. The original modal component becomes a ~10-line shell: `if (!open) return null; return <Backdrop onClick={onClose} /><Panel><XxxForm {...formProps} /></Panel>;`.
3. The form sub-component accepts:
   - All the original form-related props (e.g. `onSubmit`, `defaultPlantType`, `preSelectedProfileId`, etc.) verbatim from the existing modal's interface.
   - A new `onCancel: () => void` prop — wraps the standalone-modal's `onClose` OR the add-button menu's `setScreen("main")` depending on caller.
   - A new `onBack?: () => void` prop — when provided, the form renders a Back arrow that calls `onBack`. When absent (non-add-button callers), no Back arrow renders. The add-button menu wires `onBack` to `() => { setScreenDirection("back"); setScreen("main"); }`.
4. Form-internal state (which step of the form the user is on, photo upload state, error state, etc.) stays inside the form sub-component. It does NOT move up to `UniversalAddMenu`.

---

## 5. Files touched — full inventory (Gate 1)

### Refactored

| File | What changes | Edit shape |
|---|---|---|
| [UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx) | Revert all `e7d59d7` orchestration; expand `screen` union; add 4 new `screen === "seed" \| "shed" \| "task" \| "journal"` branches that mount the new form sub-components with `onBack` wired to the back-slide; remove the 4 `onAdd*` props (`onAddSeed`, `onAddToShed`, `onAddTask`, `onAddJournal`) since the forms now mount inside the menu. | ~150 LOC removed (e7d59d7 cruft + 4 entry-handler signatures) + ~200 LOC added (4 new screen branches with their inner content) ≈ net +50 LOC |
| [QuickAddSeed.tsx](../../src/components/QuickAddSeed.tsx) | Extract `<SeedPacketForm>` named export. Modal becomes thin shell. | ~1100 LOC reorganized; net ~0 |
| [QuickAddSupply.tsx](../../src/components/QuickAddSupply.tsx) | Extract `<SupplyForm>` named export. Modal becomes thin shell. | ~670 LOC reorganized; net ~0 |
| [NewTaskModal.tsx](../../src/components/NewTaskModal.tsx) | Extract `<TaskForm>` named export. Modal becomes thin shell. | ~440 LOC reorganized; net ~0 |
| [QuickLogModal.tsx](../../src/components/QuickLogModal.tsx) | Extract `<JournalEntryForm>` named export. Modal becomes thin shell. | ~570 LOC reorganized; net ~0 |

### Cleaned up

| File | What changes | Edit shape |
|---|---|---|
| [globals.css](../../src/app/globals.css) | Delete `fab-menu-exit` keyframe + `.animate-fab-menu-exit` utility class + the prefers-reduced-motion reference. | -15 LOC |
| [UniversalAddContext.tsx](../../src/contexts/UniversalAddContext.tsx) | Remove the 4 modal-open handlers (`openSeed`, `openShed`, `openTask`, `openJournal`) from the parts of the context that fed the add-button menu. Non-add-button callers that use the context directly are preserved or unchanged. Audit during implementation will confirm exact pruning. | ~20 LOC |

### Add-button-mounting pages (FAB mountings removed)

| File | What changes |
|---|---|
| [src/app/page.tsx](../../src/app/page.tsx) (home) | Remove `<QuickAddSeed>`, `<NewTaskModal>`, `<QuickLogModal>`, `<QuickAddSupply>` mountings from the add-button flow. Update `<UniversalAddMenu>` prop wiring to drop the 4 `onAdd*` props. |
| [src/app/garden/page.tsx](../../src/app/garden/page.tsx) | Same shape |
| [src/app/calendar/page.tsx](../../src/app/calendar/page.tsx) | Same shape |
| [src/app/journal/page.tsx](../../src/app/journal/page.tsx) | Same shape |
| [src/app/vault/VaultPageContent.tsx](../../src/app/vault/VaultPageContent.tsx) | Same shape |

Each removal is ~50 LOC per page (4 modal mountings + their `open` / `onClose` / submit-handler props).

### Files NOT touched (non-add-button callers — preserved verbatim)

The form sub-components are designed so these surfaces keep working without any change. They continue to mount the original modal components as standalone modals.

- [src/app/vault/[id]/page.tsx](../../src/app/vault/[id]/page.tsx) — mounts `QuickAddSupply`, `QuickLogModal`, `QuickAddSeed` for plant-again / vault-specific flows.
- [src/app/vault/shed/[id]/page.tsx](../../src/app/vault/shed/[id]/page.tsx) — mounts `QuickAddSupply` (×2), `QuickLogModal`.
- [src/components/ShedView.tsx](../../src/components/ShedView.tsx) — mounts `QuickAddSupply`.
- [src/app/vault/components/VaultShedWing.tsx](../../src/app/vault/components/VaultShedWing.tsx) — mounts `QuickAddSupply`.
- Any other direct callers found during implementation grep.

---

## 6. Risks + mitigations

| Risk | What could break | Mitigation |
|---|---|---|
| `screen`-state name collision | `QuickAddSupply.tsx:39` already declares `const [screen, setScreen]` for its internal "choose vs form" state machine. `QuickAddSeed.tsx` likely has the same shape. If the extracted form sub-components keep the name `screen`, there's no collision (sub-components have their own scope), but during the extract it's easy to slip up. | Rename the form-internal state to `step` or `formScreen` during extraction. Establish convention in the first sub-component, mirror across the others. |
| Photo capture inside `QuickAddSeed` | The `<input type="file">` capture flow has to keep working when the form renders inside the add-button menu's panel. | Should work mechanically (no change to the file-input pattern). Phone-verify the photo-capture flow specifically after refactor. |
| Focus traps | Each modal today owns its focus trap via being the topmost dialog. When the form sub-component lives inside `UniversalAddMenu`, the menu's `aria-modal="true"` takes over. | Should work — but tab-order needs a verification pass. Audit during Pass 2. |
| Body scroll lock | Today each modal calls `useBodyScrollLock(open)` independently. When the form lives inside the add-button menu, the menu's `useBodyScrollLock(open)` already locks the body. The form sub-component must NOT call `useBodyScrollLock` again (double-counting). The standalone-modal shell still calls it. | Move `useBodyScrollLock` calls out of the form sub-components and into the standalone-modal shells only. |
| `NewTaskModal` "no-chooser" feel | Add Plant has an inner chooser; `NewTaskModal` goes straight to a form. When the user taps "Add task," they see the task form sliding in directly (no chooser layer). | Acceptable — the inheritance is "in-place slide," not "chooser screen specifically." Slide-in to a form IS the pattern. |
| Submit-completion handoff | After a form submits inside the add-button menu, the menu should close (return to no-menu state) and any toast / refresh should run. | The form sub-component's `onSubmit` callback handles this. The add-button menu's submit handler closes the menu via `onClose()` and triggers any necessary refresh — same as today's external-modal callbacks. |
| Secondary return in `QuickAddSeed.tsx` L1120 | The 1127-LOC file has an early-return main render plus a secondary return that's likely a nested confirmation modal. | Handle as a separate extraction step. The secondary render stays outside the main form sub-component — it's its own concern, possibly its own mini-component. |
| Non-add-button caller drift | If the form sub-component's interface drifts from the modal's original prop shape, non-add-button callers can break silently. | The standalone-modal shell IS a non-add-button caller — if it works after refactor (and tests + typecheck pass), all other callers using the same prop shape also work. |

---

## 7. Cleanup approach for `e7d59d7`

Recommended: **revert-then-rebuild.**

- **Commit #1:** `git revert e7d59d7` — restores `UniversalAddMenu.tsx` + `globals.css` to the pre-misfire state. Production briefly goes back to today's behavior. Diff is small and auto-generated.
- **Commit #2:** the Path Y refactor as a single coherent commit (or split into 2-3 if the form-extraction wants its own commit per modal — discretion of the implementing chat).

This keeps the misfire honest in git history ("ship-then-revert-then-redo") and makes the corrective diff easy to read.

Alternative: build over `e7d59d7` in a single commit. Smaller history footprint but mixes "undoing my mistake" with "the new design" in one diff. Less readable in retrospect.

---

## 8. Estimated build

| Phase | Effort |
|---|---|
| Revert `e7d59d7` + verify | ~15 min |
| Extract `<TaskForm>` from `NewTaskModal.tsx` (smallest, simplest) | ~1 hour |
| Extract `<JournalEntryForm>` from `QuickLogModal.tsx` | ~1.5 hours |
| Extract `<SupplyForm>` from `QuickAddSupply.tsx` | ~1.5 hours |
| Extract `<SeedPacketForm>` from `QuickAddSeed.tsx` (largest, has internal chooser + secondary render) | ~2-3 hours |
| Add 4 new screens to `UniversalAddMenu.tsx` + wire `onBack` + drop `onAdd*` props | ~1.5 hours |
| Update 5 add-button-mounting pages (drop modal mountings + prop wiring) | ~1 hour |
| Clean up `UniversalAddContext.tsx` | ~30 min |
| 4-pass plan-audit (iterative-until-clean) | ~1-2 hours |
| Tests + build + grep for orphans | ~30 min |
| Verification + Gate 2 surfacing | ~30 min |
| **Total** | **~10-13 hours of focused work** |

This is too big for a single one-chat ship squeezed at the end of another conversation. The implementing chat should be a fresh chat starting cold from this plan.

---

## 9. Gate 2 commitments — surface before push

When code is ready in the implementing chat, before any `git push`, the chat surfaces:

1. **Diff against `e7d59d7`** showing all Option B orchestration is gone (no `fab-menu-exit`, no `isExiting`, no `EXIT_FALLBACK_MS`, no anchor shift).
2. **Inheritance cross-reference table** — every row from §2 above marked ✓ "reused verbatim."
3. **Side-by-side** of the new `screen === "seed"` (or any of the 4 new screens) branch structure vs. the existing `screen === "add-plant"` branch — proving they share shape.
4. **Test result** — 439/439 (or higher if new tests added) still pass.
5. **Production build** — clean.
6. **Web parity verification** — phone viewport (412×915) + desktop browser (≥1280px) both verified. Preview MCP if `.env.local` available in worktree; otherwise documented skip + Syd phone-verify on prod.
7. **Menu-stays-open confirmation** — explicit narrative confirming the menu container never unmounts during the FAB flow.

After Gate 2 surfacing, hold for Syd's explicit "yes ship" before any push.

---

## 10. Test strategy

### Existing coverage to preserve

- 439/439 tests currently passing. All should still pass after refactor (public component APIs preserved for non-add-button callers).
- No tests today directly cover `UniversalAddMenu` orchestration. The Path Y refactor is a good opportunity to add minimal coverage:
  - Tapping each entry-point button changes the menu's internal `screen` state (no external modal opens from the add-button flow).
  - Tapping the Back arrow inside a sub-screen returns to `screen === "main"`.
  - Form submit inside the menu fires the original submit callback + closes the menu.

### New coverage worth adding

- Regression test: assert that the 4 modal files still work as standalone modals (mount with `open=true`, verify form-content renders inside the panel shell).
- Regression test: assert the add-button menu's panel container has only one animation class (`animate-fab-menu-enter`) — never an exit class — guarding against the `e7d59d7` shape coming back.

---

## 11. Audit passes required (4-pass standard)

Per [CLAUDE.md Plan-audit standard](../../CLAUDE.md):

- **Pass 1 — Factual:** every line reference + prop name + keyframe name verified via Read/Grep.
- **Pass 2 — Concerns hunt:** state-machine collisions (form-internal `screen`); race conditions on submit-during-back; null/empty form-state when menu re-opens; photo-capture continuity; focus-trap shift; body-scroll-lock single-source-of-truth; persona walk (Maya / Sydney / Walter / Aria / Sam).
- **Pass 3 — Sibling sweep:** grep for any other surfaces that pass `<QuickAddSeed>` / `<QuickAddSupply>` / `<NewTaskModal>` / `<QuickLogModal>` as JSX; check `UniversalAddContext` consumers for prop drift after the 4 `onAdd*` removals; grep `animate-modal-slide-up` to confirm only the standalone-modal shells use it (form sub-components never do).
- **Pass 4 — Lock hygiene:** VISION §10 (don't-touch list) — `UniversalAddContext` is on this list per CLAUDE.md, surface explicitly before any context-pruning; §11 (parked decisions) — touch nothing parked; ROADMAP §6 (FAB transition standard) — Path Y honors it by making all 5 picks use the "submenu" classification (in-place slide) rather than mixing classifications.

---

## 12. Where this plan ends

This is the planning doc, not the kickoff. Implementation runs in a fresh chat. Phase 2 readiness gate (4-pass audit iterative-until-clean) executes inside the implementing chat before any code lands.

After the implementing chat ships clean + Syd phone-verifies + desktop-verifies, [BUGS U7](../BUGS.md) gets a ✅ Fixed marker with the commit references in a follow-up doc commit.
