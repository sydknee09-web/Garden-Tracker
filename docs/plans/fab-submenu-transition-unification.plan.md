# Plan — FAB submenu transition unification (U7)

> **Status:** Planning doc only. No code edits. Captured 2026-05-19.
> **Maps to:** [BUGS.md U7](../BUGS.md) — *"FAB transitions: 'Add seed' smooth in-place transition; other 3 submenus close + reopen — feels glitchy. Pick one model (in-place sub-screen for all) and align."* (Captured pre-2026-05-13. ~2-3h estimate at capture time.)
> **Related captures:** [ROADMAP §6](../ROADMAP.md) — *"FAB transition standard locked: fade-scale (open/close), horizontal-slide (submenu), slide-up (target modal). 200ms in / 150ms out."* — names the spec but doesn't reconcile which of the 5 entry points are "submenus" vs "target modals." This plan resolves that.

---

## 1. Framing

User taps the FAB → UniversalAddMenu opens (centered, fade-scale in via `animate-fab-menu-enter`). 5 options below:

| Option | Current behavior | Pattern |
|---|---|---|
| Add seed packet | `onClose() + open QuickAddSeed` | close-then-open (glitch) |
| **Add plant** | `setScreen("add-plant")` → in-place horizontal slide via `animate-submenu-slide-forward` | **in-place sub-screen** |
| Add to shed | `onClose() + open QuickAddSupply` | close-then-open (glitch) |
| Add task | `onClose() + open NewTaskModal` | close-then-open (glitch) |
| Add journal | `onClose() + open QuickLogModal` | close-then-open (glitch) |

What the user perceives on the glitchy 4: FAB menu **disappears instantly** at center-screen (`if (!open) return null` — no exit animation) → blank frame → new modal **slides up from bottom** (`animate-modal-slide-up`). Two distinct on-screen positions (center → bottom on mobile) + a missing exit animation = "close then reopen" feel.

Add Plant feels smooth because the menu shell stays mounted; only the inner content swaps via the horizontal-slide keyframe at the same screen position.

**The fix:** align all 5 to a single transition language. Two architecture paths considered in §3, recommendation locked in §3.3.

---

## 2. Current-state inventory

### Files in play

| File | LOC | Role |
|---|---|---|
| [src/components/UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx) | 243 | FAB menu shell + internal `add-plant` sub-screen. Centered modal (`flex items-center justify-center`), `z-[100]`. |
| [src/components/QuickAddSeed.tsx](../../src/components/QuickAddSeed.tsx) | 1126 | Modal panel anchored `items-end sm:items-center`, `z-[60]`. Slide-up via `animate-modal-slide-up`. |
| [src/components/QuickAddSupply.tsx](../../src/components/QuickAddSupply.tsx) | 686 | Same shell — `items-end sm:items-center`, `z-[60]`, slide-up. |
| [src/components/NewTaskModal.tsx](../../src/components/NewTaskModal.tsx) | 446 | Same shell. |
| [src/components/QuickLogModal.tsx](../../src/components/QuickLogModal.tsx) | 560 | Same shell. |
| [src/components/AddPlantModal.tsx](../../src/components/AddPlantModal.tsx) | 990 | Same shell (unified via [10d2f1f](https://github.com/sydknee09-web/Garden-Tracker/commit/10d2f1f); header pattern unified via [7714859](https://github.com/sydknee09-web/Garden-Tracker/commit/7714859)). |
| [src/contexts/UniversalAddContext.tsx](../../src/contexts/UniversalAddContext.tsx) | 110 | Owns the `activeModal` state machine: `"menu" \| "seed" \| "shed" \| "plant" \| "task" \| "journal"`. Drives which modal is open. |
| [src/app/globals.css:210-260](../../src/app/globals.css) | — | Keyframes: `fab-menu-enter`, `submenu-slide-forward`, `submenu-slide-back`, `modal-slide-up`. |

### Entry-point handlers in UniversalAddMenu

[src/components/UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx):

| Line | Handler | Pattern |
|---|---|---|
| L98–106 | Add seed packet | `onClick={() => { onClose(); onAddSeed(); }}` |
| L107–117 | Add plant | `onClick={() => { setScreenDirection("forward"); setScreen("add-plant"); }}` |
| L118–128 | Add to shed | `onClick={() => { onClose(); onAddToShed(); }}` |
| L129–139 | Add task | `onClick={() => { onClose(); onAddTask(); }}` |
| L140–150 | Add journal | `onClick={() => { onClose(); onAddJournal(); }}` |

Add Plant is the outlier — local `screen` state instead of an external modal open.

### Position mismatch (the visual driver of the glitch)

UniversalAddMenu shell at [L84](../../src/components/UniversalAddMenu.tsx): `flex items-center justify-center` — **centered on viewport.**

Target modals (since [10d2f1f](https://github.com/sydknee09-web/Garden-Tracker/commit/10d2f1f)): `flex items-end sm:items-center justify-center` — **bottom on mobile, centered on desktop.**

On mobile (412×915 — Syd's device) the menu pops in center, modal slides up from bottom. The two endpoints DON'T overlap in screen position — even with perfect timing, the transition can't feel in-place because the source and target aren't co-located. This is why the user sees position-jump on top of the timing-jump.

### Animation primitives available

[src/app/globals.css](../../src/app/globals.css):

- `fab-menu-enter` (L210) — opacity 0→1 + scale 0.92→1 + translateY 8→0
- `submenu-slide-forward` (L224) — opacity 0→1 + translateX 16→0
- `submenu-slide-back` (L237) — opacity 0→1 + translateX -16→0
- `modal-slide-up` (L250) — opacity 0→1 + translateY 24→0

No `fab-menu-exit` keyframe today. No coordinated entry/exit choreography hook.

---

## 3. Architecture options

### Option A — Embed the 4 separate modals as screens inside UniversalAddMenu

**Shape.** Add 4 new `screen` values to UniversalAddMenu: `"seed" | "shed" | "task" | "journal"`. Each modal's form content extracts to a render-as-children helper exposed by the modal component. UniversalAddMenu mounts the right helper based on `screen`. The menu shell stays put; only the inner content swaps via `animate-submenu-slide-forward` — identical to today's Add Plant behavior.

**What changes.**
- UniversalAddMenu grows from 243 → ~600+ LOC (5 screen branches).
- QuickAddSeed / QuickAddSupply / NewTaskModal / QuickLogModal refactored to expose a `<FormContent>` named export that takes `onSubmit` / `onCancel` / `onBackToMenu` props and renders the form-only DOM (no backdrop, no panel, no z-index, no fixed positioning). Their backdrop+panel shell goes away; the menu shell hosts them.
- `UniversalAddContext` simplifies — the `activeModal` state machine collapses. The menu is the only mounted modal at any time; `screen` inside it tracks which form is showing.
- Any callsite that opens these modals OUTSIDE the FAB flow (Plant Again from vault profile uses `QuickAddSeed`; Edit modes use various) needs an alternate mount path. **This is the load-bearing complication.** QuickAddSeed today opens both from FAB AND from vault toolbar scans + plant profile Plant Again; collapsing its shell breaks non-FAB callers unless preserved.

**LOC estimate.** ~3400 LOC across 4 modals needs structural restructure — separating shell from content. Net code reduction (no duplicate shells) but high-touch refactor. **~M-to-L size, ~12-20h build.**

**Tradeoffs.**

| Pro | Con |
|---|---|
| Matches Add Plant pattern exactly — full cohesion. | High-touch refactor across 4 large files. |
| Long-term simplification — one shell, content swaps. | Non-FAB callers of QuickAddSeed / etc. need preservation paths. |
| No position-jump on mobile (menu shell stays put). | Risk: bulk-mode flows, photo capture flows, focus traps inside each modal expect their own shell — re-wiring is delicate. |
| Cleanest fit with [ROADMAP §6 FAB transition standard](../ROADMAP.md). | Bigger surface = bigger audit, longer feedback loop. |

### Option B — Lighter surgery: unify anchor + add coordinated exit animation

**Shape.** Don't restructure modals. Instead:

1. **Move UniversalAddMenu shell to the same anchor as target modals.** Change `flex items-center justify-center` ([L84](../../src/components/UniversalAddMenu.tsx)) → `flex items-end sm:items-center justify-center pb-20 sm:pb-4`. Now menu and modals occupy the same screen position on mobile (bottom) and desktop (center). The position-jump goes away.
2. **Add a `fab-menu-exit` keyframe.** Mirror `fab-menu-enter` (opacity 1→0 + scale 1→0.92 + translateY 0→8). 150ms per the [ROADMAP §6 standard](../ROADMAP.md).
3. **Coordinate close + open.** When user taps one of the 4 entry points: trigger menu exit animation, wait ~150ms (the exit duration), then open the target modal. The target modal's `modal-slide-up` (200ms in) starts as menu finishes exiting. Net: menu fades-out-down while modal slides-up — both at the same anchor position on mobile.
4. **Optional polish.** Make the bottom-mobile anchor match exactly: same `pb-20` between menu and modal so the panels land on the same Y coordinate. (Already partially aligned post-`10d2f1f`.)

**What changes.**
- UniversalAddMenu: ~20-line edit (anchor className change + new animation state for exit + ~150ms timeout coordination).
- globals.css: ~10 lines for `fab-menu-exit` keyframe + utility class.
- UniversalAddContext: ~10-line edit to gate `openSeed`/`openShed`/`openTask`/`openJournal` on an exit-animation `setTimeout`, OR move the timeout into UniversalAddMenu's close handler (preferred — keeps the context state-machine simple).
- No edits to the 4 target modal files.

**LOC estimate.** ~50 LOC touched. **~XS-to-S size, ~3-4h build (including audit + tests).**

**Tradeoffs.**

| Pro | Con |
|---|---|
| Small surface — low audit cost, fast feedback loop. | Add Plant continues to use horizontal-slide in-place; the other 4 use the choreographed close-then-open. Two transition models coexist — different from Option A's "all in-place." |
| No restructure to the 4 large modals — risk-bounded. | Choreography depends on a `setTimeout` — fragile on slow devices if not React-state-driven. Mitigation: use `onAnimationEnd` instead of a fixed timeout. |
| Matches the [ROADMAP §6 standard](../ROADMAP.md) literally — "submenu = horizontal-slide" (Add Plant), "target modal = slide-up" (the 4). The standard already classifies these as different transition types. | Doesn't fully eliminate the "glitch" perception — it ameliorates it (no position-jump, no missing exit anim) but the user still sees menu disappear THEN modal appear, just choreographed. |
| Easy to undo if Option A becomes preferred later. | Doesn't pre-empt anything Phase 2 wants (Zones rewrite) — same as Option A. |

### 3.3 — Recommended path: Option B first, Option A optional later

**Recommend Option B for the immediate ship.** Reasoning:

1. **Honors the locked [ROADMAP §6 standard](../ROADMAP.md) literally.** Submenu = Add Plant only (in-place horizontal slide). Target modals = the 4 (slide-up). Option B makes the target-modal transition *good* without redefining it. Option A redefines all 5 as "submenus" — which IS the user's preference per [U7](../BUGS.md) ("in-place sub-screen for all") but conflicts with the locked standard's classification. A standard rewrite is a bigger decision than a transition fix.
2. **Risk-bounded.** ~50 LOC touched vs ~3400 LOC restructured. Audit passes terminate faster. Phone-verify cycle is faster.
3. **Most of the perceived "glitch" is the position mismatch + missing exit animation**, not the close-then-open conceptually. Option B fixes both root causes. The remaining "two transition models" cohesion concern is a future call.
4. **Reversible.** If Option B ships and Syd still reads the transition as glitchy on her phone, escalate to Option A as a follow-up ship with the empirical data ("Option B didn't go far enough"). Option A is a big enough investment to deserve evidence not speculation.

**Open call for Syd:** see Q1 in §6. The recommendation is Option B; explicit greenlight resolves the question.

---

## 4. Files to touch (Option B path — recommended)

| File | Edit shape | Est lines |
|---|---|---|
| [src/components/UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx) | Change shell anchor to `items-end sm:items-center pb-20 sm:pb-4` ([L84](../../src/components/UniversalAddMenu.tsx)); add internal `isExiting` state; on entry-point click → set `isExiting` → on `animationend` → call `onClose() + onAddSeed/onAddToShed/etc.` | ~30 |
| [src/app/globals.css:210-260](../../src/app/globals.css) | Add `@keyframes fab-menu-exit` (mirror enter) + `.animate-fab-menu-exit` utility class. Honors `prefers-reduced-motion` block at L264-267. | ~15 |
| [src/contexts/UniversalAddContext.tsx](../../src/contexts/UniversalAddContext.tsx) | None expected if menu owns the exit-then-open coordination internally. (Audit confirms.) | 0 |
| `src/components/UniversalAddMenu.test.tsx` | **New** — assert entry-point click triggers exit animation BEFORE calling `onAdd*` handler. Use `act` + mocked `onAnimationEnd`. | ~60 |

**Estimated total touched LOC:** ~45 / +60 new test = ~105 lines net.

For Option A path the file list expands to all 4 modal files + UniversalAddMenu (~600 LOC) + UniversalAddContext refactor + non-FAB caller preservation paths. ~10× the surface area. Not enumerated here unless Syd locks Option A.

---

## 5. Migration risk + mitigations (Option B)

| Risk | What breaks | Mitigation |
|---|---|---|
| **prefers-reduced-motion users** — animations disabled means exit-then-open becomes synchronous; user perceives jump back. | A11y regression. | New `fab-menu-exit` keyframe goes into the existing `prefers-reduced-motion: reduce` block (globals.css L264-267) — for reduced-motion users, fall back to instant close + instant open (same as today, just no animation-pretense). |
| **`onAnimationEnd` doesn't fire** if device is mid-frame-drop or animation is preempted. | Modal never opens. | Belt-and-suspenders: `setTimeout(handler, 200)` fallback if `onAnimationEnd` hasn't fired by then. Captures both fast paths + edge cases. |
| **Add Plant in-place pattern keeps its no-exit-animation** (stays mounted). | UI inconsistency between Add Plant and the other 4. | Acceptable — Add Plant's sub-screen stays in same component; the menu doesn't unmount. The "exit animation" is conceptually a different event. Honored by [ROADMAP §6 standard](../ROADMAP.md). |
| **Position anchor change** — menu pops up from bottom on mobile instead of center. | Different feel than today. | This IS the fix. Aligns with the 4 target modals. Verify on Preview MCP at 412×915. Syd phone-verify. |
| **Existing tests** — any test mocking the menu's `onClick` may not exercise the new exit animation path. | Tests pass but don't cover the new code path. | New test file (`UniversalAddMenu.test.tsx`) specifically asserts the animation-gated open. |

---

## 6. Open questions for Syd

**Q1. Option A vs Option B (the architecture call).**

- **Recommended:** Option B — lighter surgery, ~50 LOC, ~3-4h. Fixes the two root causes (position jump + no exit animation). Reversible.
- Alt: Option A — full in-place sub-screen unification across all 5. ~3400 LOC restructure, ~12-20h. Matches U7's original "Pick one model (in-place sub-screen for all)" framing literally, but conflicts with the [ROADMAP §6 standard's](../ROADMAP.md) submenu-vs-target-modal classification.

If Q1 = Option B, the remaining questions Q2–Q3 apply. If Q1 = Option A, Q2–Q3 are dissolved and a new audit shape kicks in.

Default if no redirect: **Option B**.

**Q2. (Option B only.) Anchor unification scope.**

Today UniversalAddMenu is centered; target modals are bottom-on-mobile. Option B aligns the menu to bottom-on-mobile.

- **Recommended:** Move menu to `items-end sm:items-center pb-20 sm:pb-4` — exactly matches the 4 target modals (and AddPlantModal post-[10d2f1f](https://github.com/sydknee09-web/Garden-Tracker/commit/10d2f1f)).
- Alt: Move all modals to centered. Rejected — bottom-on-mobile is the [10d2f1f](https://github.com/sydknee09-web/Garden-Tracker/commit/10d2f1f) locked decision; reverting it would undo cohesion work + impact 6 other modals.

Default if no redirect: **Recommended**.

**Q3. (Option B only.) Exit duration to match [ROADMAP §6 standard](../ROADMAP.md).**

ROADMAP says *"200ms in / 150ms out"* for the FAB transition standard.

- **Recommended:** `fab-menu-exit` runs 150ms (matches "150ms out" exactly). `modal-slide-up` already runs ~200ms ("200ms in" matches). Net: 150ms menu-exit + 200ms modal-enter overlap by ~50ms at the tail.
- Alt: Run them strictly sequentially (no overlap) — 150ms then 200ms = 350ms total visible transition. Feels slow on mobile.

Default if no redirect: **Recommended** (overlap).

---

## 7. Test strategy (Option B path)

### Existing coverage to preserve

- No existing UniversalAddMenu test file. ([src/components/UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx) is untested.) Other modal tests exist but assert content, not orchestration.

### New coverage needed

- **`UniversalAddMenu.test.tsx`** (new):
  - Entry-point button click triggers `isExiting` state (not immediate `onClose` + `onAddX`).
  - `onAnimationEnd` on the menu panel triggers `onClose` then `onAddX`.
  - Fallback `setTimeout(200ms)` fires if `onAnimationEnd` is absent.
  - Add Plant entry-point continues to use internal `setScreen` (no animation-gated open).
  - `prefers-reduced-motion` path bypasses the animation — synchronous close+open (assert via media-query mock).

### Audit passes required

- **Pass 1 — Factual:** keyframes named correctly; `animationend` event timing matches CSS duration; `prefers-reduced-motion` block at globals.css L264 covers the new `fab-menu-exit`.
- **Pass 2 — Concerns hunt:** race between user double-clicking entry-point before exit anim finishes; menu re-opening mid-exit; focus management across the animation boundary (focus trap on menu vs modal); body-scroll-lock continuity (both menu and modals call `useBodyScrollLock` — verify no flicker mid-transition); slow-device behavior (do we mask the modal mount until menu exit completes?); a11y announce-on-transition timing.
- **Pass 3 — Sibling sweep:** search for other surfaces that use `onAnimationEnd` for transition coordination (cohesion grep); check if other modals have a parallel exit pattern we'd want to mirror; check QuickAddSeed has its own `onBackToMenu` flow that re-opens UniversalAddMenu — does that need a forward-slide-back pattern too?
- **Pass 4 — Lock hygiene:** VISION §10 don't-touch list, §11 parked decisions; ROADMAP §6 "FAB transition standard" — already named, this ship honors it; [10d2f1f](https://github.com/sydknee09-web/Garden-Tracker/commit/10d2f1f) lock on `items-end sm:items-center` anchor — this ship extends the lock to UniversalAddMenu (extension is consistent, not a violation).

---

## 8. Estimated effort

### Option B (recommended)

| Phase | Effort |
|---|---|
| Plan + audit (4 passes, iterative-until-clean) | ~1 hour |
| Animation keyframe + utility class | ~15 min |
| UniversalAddMenu exit-state + animation-end coordination | ~1-2 hours |
| New test file | ~1 hour |
| Preview MCP mobile-viewport verification | ~15 min |
| Manual phone verify on prod | ~5 min (Syd) |
| **Total** | **~3-4 hours of build time (XS-S)** |

### Option A (alternate)

| Phase | Effort |
|---|---|
| Plan + audit (4 passes — more iterative cycles given LOC) | ~2-3 hours |
| Refactor 4 modals to expose `<FormContent>` named exports + strip shell | ~6-10 hours |
| UniversalAddMenu adds 4 new screen branches | ~2-3 hours |
| Preserve non-FAB callers (QuickAddSeed Plant Again, vault toolbar scan, etc.) | ~2-3 hours |
| New + updated tests (5 modal files = wider regression surface) | ~2-3 hours |
| Manual phone verify | ~15 min (Syd) |
| **Total** | **~14-22 hours (M-L)** |

---

## 9. Suggested commit sequence

### Option B (recommended)

**One bundled commit.** ~50 LOC touched is small enough to ship atomically. Commit message names:
1. Anchor unification on UniversalAddMenu (matches [10d2f1f](https://github.com/sydknee09-web/Garden-Tracker/commit/10d2f1f) lock).
2. New `fab-menu-exit` keyframe + utility.
3. Animation-end-gated open coordination.
4. New regression test.

### Option A (alternate)

**3-commit split** if Option A is greenlit:
1. Refactor target modals to expose `<FormContent>` (no behavior change — just shell-vs-content separation).
2. Extend UniversalAddMenu with 4 new screens; wire to FormContent helpers.
3. Update tests + remove old standalone-modal mount paths (with preservation for non-FAB callers explicit in commit message).

---

## 10. Where this plan ends

This is a planning doc, not a kickoff. Before any code lands, Syd reviews + answers Q1 (Option A vs B — the load-bearing call) + Q2–Q3 if Option B + greenlights the ship via the standard "yes build" gate. Then the work runs Phase 2 readiness gate (full plan-file at `.claude/plans/<branch>.md`, all 4 audit pass-types iterative-until-clean) before the first code edit.

After ship, [BUGS U7](../BUGS.md) marks closed with the commit SHA + verification date.
