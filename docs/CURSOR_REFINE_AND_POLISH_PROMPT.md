# Cursor Implementation Prompt — Refine & Polish

**Derived from:** [MASTER_PLAN.md](MASTER_PLAN.md)

**Copy this entire prompt into Cursor.** It is self-contained. Work through each phase in order. Do not run smoke tests (user is away); implement and verify logic only.

---

## Context

You are implementing the Voyager Sanctuary "Refine & Polish" plan. The app is a Flutter goals/task app with gamified elements: Elias (guide), Hearth (burn tasks), Satchel (task bag), Map (goal hierarchy). The goal is to eliminate bumpy interactions and achieve "Smooth, Refined, Architectural Luxury."

**Key docs:** `docs/MASTER_PLAN.md`, `docs/ALIGNMENT_OUTCOME_SPEC.md`, `docs/Completed/AUDIT_FIX_IMPLEMENTATION_PLAN.md`.

**Universal rule:** When fixing one instance (e.g., keyboard covering input), apply the pattern everywhere.

---

## Phase 0 — P0 Friction (Do First)

### Task 0.1 — Keyboard Overlays Text Input

**Problem:** Keyboard covers focused text input. User cannot see what they type.

**Fix:** For every screen/overlay with a `TextField` or `TextFormField`:
1. Wrap the scrollable content in `SingleChildScrollView` (or ensure parent is scrollable).
2. Add bottom padding: `MediaQuery.of(context).viewInsets.bottom` so the focused field scrolls above the keyboard.
3. Use `Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: ...)` or `AnimatedPadding` with `viewInsets.bottom`.

**Files to update:**
- `lib/features/scroll_map/climb_flow_overlay.dart` — Step 1–5 inputs
- `lib/features/scroll_map/edit_flow_overlay.dart`
- `lib/features/management/management_menu_sheet.dart`
- `lib/features/satchel/satchel_screen.dart`
- `lib/features/auth/auth_screen.dart`
- `lib/features/whetstone/whetstone_screen.dart` (already has viewInsets — verify)
- `lib/features/scroll_map/scroll_map_screen.dart` — `_showNameNewNodeDialog` and any `showDialog` with TextField

**Verification:** In each file, ensure the dialog or overlay body uses `viewInsets.bottom` in its padding when keyboard is shown.

---

### Task 0.2 — Elias & Fire Lag (1st Drop)

**Problem:** On first stone drop: Elias disappears, lag swapping firepit, Elias scales with fire (wrong — only fire should scale). Only correct after navigating away and back.

**Fix:**
1. **Preload assets:** Ensure Elias and Hearth images are precached. Check `sanctuary_screen.dart` — use `precacheImage` in `initState` or before first build.
2. **Stable Key:** Give `_EliasWidget` and the Hearth stack a consistent `ValueKey` (e.g. `ValueKey('elias_hearth_layer')`) so they don't rebuild unnecessarily.
3. **Elias size:** Elias must NOT scale with fire. In `sanctuary_screen.dart`, the `TweenAnimationBuilder` / `Transform` that scales on `focusOnHearth` — ensure Elias is NOT inside that scale. Only the Hearth/fire scales. Elias stays fixed size.
4. **Stack order:** Elias behind Hearth. Use `RepaintBoundary` if needed to prevent unnecessary repaints.

**Files:** `lib/features/sanctuary/sanctuary_screen.dart` — `_EliasWidget`, `_HearthWidget`, the `TweenAnimationBuilder` block (lines ~56–110).

**Key check:** `_EliasWidget` is inside the same `Transform` as the Hearth. The scale is applied to the whole `Stack` (Elias + Hearth). When `focusOnHearth` is true, both scale. **Fix:** Move Elias outside the scale, or apply scale only to the Hearth child. Elias should have fixed dimensions.

---

### Task 0.3 — Save/Skip → Cancel and Save

**Problem:** Dialogs use "Skip" and "Save." "Skip" is confusing. Should be "Cancel" and "Save." Save allows empty name (user can skip adding a name by tapping Save with nothing typed).

**Fix:** In `_showNameNewNodeDialog` (and any similar dialog):
- Replace "Skip" button with "Cancel". Cancel = close without saving.
- "Save" = save the title. If `controller.text.trim().isEmpty`, save with empty string or a default like "Untitled" (per product preference). Do not return early on empty — allow Save to complete.

**Files:** `lib/features/scroll_map/scroll_map_screen.dart` — `_showNameNewNodeDialog` (around lines 574–595). Also check mallet handlers: `_malletOnMountain`, `_malletOnBoulder`, `_malletOnPebble`, `_malletOnShard` — they all use this dialog.

**Integration tests:** `add_task_journey.dart` uses `find.text('Skip')`. Update to `find.text('Cancel')` after this change.

---

### Task 0.4 — Duplicate New Journey Buttons

**Problem:** FAB (+) on Map and "New Journey" in Management sheet. Both must open the same wizard.

**Fix:** Verify both call `_openClimbFlow` (or equivalent). Management sheet: `context.push('${AppRoutes.scroll}?openClimb=true')` — this navigates to Scroll and opens Climb. Map FAB: `onPressed: () => _openClimbFlow(context)`. Both should result in `ClimbFlowOverlay` opening. No duplicate logic.

**Files:** `lib/features/management/management_menu_sheet.dart`, `lib/features/scroll_map/scroll_map_screen.dart`, `lib/app.dart` (route with `openClimbOnMount`).

**Verification:** Trace both entry points. Confirm they lead to the same `ClimbFlowOverlay`.

---

### Task 0.5 — Lock Terminology

**Fix:**
1. **Satchel slot slidable:** `label: isReady ? 'Lock' : 'Done'` — change "Lock" to "Stow" or "Return to Map" when the action returns the stone to active pebbles. When marking ready: "Done" or "Ready" is fine.
2. **Step 5 (Placing stones):** If any button says "Lock," change to "Pack this Journey" or "Return to Map" per plan.

**Files:** `lib/features/satchel/satchel_screen.dart` (line ~579), `lib/features/scroll_map/climb_flow_overlay.dart` (Step 5).

---

## Phase 1 — Gamification & Lore

### Task 1.1 — Elias Introduction (First Login)

**Full spec:** [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md)

**Implementation:**
1. **Migration:** Run `20250317000000_add_has_seen_elias_intro.sql` (adds `has_seen_elias_intro` to `profiles`).
2. **Storage:** `has_seen_elias_intro` in Supabase `profiles` — NOT SharedPreferences. Syncs across devices.
3. **Trigger:** Auth redirect. If `profiles.has_seen_elias_intro == false` → push to EliasIntroOverlay instead of Sanctuary.
4. **3-beat lore:** State machine. AnimatedSwitcher cross-fade. Beat 1 (Threshold), Beat 2 (Satchel), Beat 3 (Hearth). Copy in spec.
5. **Whetstone setup:** Min 1, max 3 habits. **No skip.** Elias: "Every climber needs a sharp edge. What is the one small ritual that keeps you steady?" Embed habit fields in intro. "Add another" (secondary) + "Continue" (primary orange). Save via `whetstoneProvider.addItem()`.
6. **On Continue (final):** `supabase.from('profiles').update({'has_seen_elias_intro': true})`; navigate to `/scroll`.
7. **No skip:** `PopScope(canPop: false)` during intro.
8. Add intro dialogue lines to `elias_dialogue.dart` per spec §7.

**Files:** New `lib/features/onboarding/elias_intro_overlay.dart` (EliasIntroOverlay), auth redirect logic, `elias_dialogue.dart`.

---

### Task 1.2 — Step-by-Step Elias (Peak Creation Wizard)

**Full spec:** [PEAK_PLANTING_WIZARD_SPEC.md](PEAK_PLANTING_WIZARD_SPEC.md)

**State-based reveal:** Phase A (Elias prompt) → Phase B (input). Never both. "Continue" (Phase A) only sets `isInputPhase = true`. "Next" (Phase B) advances step.

**Implementation:**
1. `WizardState` with `currentStep` (0–5) and `isInputPhase` (bool) — 6 steps: Intent → Identity → Appearance → Logic → Markers → Placing stones
2. `Visibility(visible: isInputPhase)` for input
3. Phase A → B: `AnimatedPositioned` Elias to top-left (70%), bubble shrinks, input `FadeTransition` + `SlideTransition`
4. Step → Step: fade to black (vellum), reset `isInputPhase = false`
5. Typewriter effect for Elias in Phase A
6. `viewInsets.bottom` for keyboard

**Files:** `lib/features/scroll_map/climb_flow_overlay.dart`, `climb_flow_provider.dart`

---

### Task 1.3 — Rotate Management Greeting

**Fix:** In `management_menu_sheet.dart`, replace static "What would you like to do?" with a rotated line from `EliasDialogue.onTap()` or a new pool. Add `_managementGreeting` pool in `elias_dialogue.dart` if needed.

**Files:** `management_menu_sheet.dart`, `elias_dialogue.dart`.

---

### Task 1.4 — Speech Bubble Timing

**Fix:** Do NOT set `eliasMessageProvider` when opening Management sheet. Set it when the sheet **closes** (in `Navigator.pop` callback or when user dismisses). Or: show bubble only after sheet closes, with a contextual line. Per GAPS §8 Option C.

**Files:** `sanctuary_screen.dart` — `_EliasWidget` onTap. `management_menu_sheet.dart`. Ensure `onTap` does not set `eliasMessageProvider` before `showModalBottomSheet`. Set it in the sheet's `whenClosed` or equivalent.

---

## Phase 2 — UX Polish

### Task 2.1 — Stone Movement Animation

**Fix:** When a stone is deleted or completed, animate the list. Use `AnimatedList` or `AnimatedSliverList` for satchel slots and Map pebble rows. On remove: `AnimatedListState.removeItem` with slide-up + fade. On add: animate in.

**Files:** `sanctuary_screen.dart` — `_CompactSatchelTray`. `scroll_map_screen.dart` — `_MountainSection`, pebble rows. `satchel_screen.dart`.

---

### Task 2.2 — Blank Row When No Stone

**Fix:** If a marker has no pebbles, show an empty row (or placeholder "Tap to add a pebble"). Do not hide the row.

**Files:** `scroll_map_screen.dart` — `_TrailPebbleRow`, `_MountainTrailBody`.

---

### Task 2.3 — Move Seek Guidance Down

**Fix:** Reorder Management menu: New Journey, Pack Satchel, Seek Guidance, Archive Recovery, Settings.

**Files:** `management_menu_sheet.dart`.

---

### Task 2.4 — Text Readability

**Fix:** Ensure `EliasTypography`, `letterSpacing`, `height` (line height) are set. Use `fontFamily: 'Georgia'` for body. Check `elias_typography.dart` and `app_theme.dart`.

**Files:** `elias_typography.dart`, `app_theme.dart`, screens with Elias copy.

---

## Phase 3 — Audit Fix (Already Planned)

If not yet done, implement from `Completed/AUDIT_FIX_IMPLEMENTATION_PLAN.md` (or MASTER_PLAN Part E):
- Task 1.1: Node stream `mountain_id` filter
- Task 2.1: Loop bug fix (keepAlive climbFlowProvider)
- Task 2.2: Elias cache fix
- Task 3.1: `_saveTitle` narrow invalidation

---

## Execution Order

1. Phase 0 (Tasks 0.1–0.5) — all P0
2. Phase 1 (Tasks 1.1–1.4) — gamification
3. Phase 2 (Tasks 2.1–2.4) — polish
4. Phase 3 — audit fixes if pending

---

## Constraints

- **RLS & user_id:** Every DB insert/upsert must include `user_id: user.id`.
- **No new tables** unless explicitly required.
- **Existing schema:** Use `intent_statement`, `name`, `layout_type`, `is_archived`.
- **Integration tests:** Update `add_task_journey.dart` for Skip→Cancel.

---

## Definition of Done

- All Phase 0 tasks complete.
- Phase 1 tasks complete (Elias intro, step-by-step wizard, rotating greeting, bubble timing).
- Phase 2 tasks complete (animations, blank row, menu order, text).
- No new linter errors.
- App builds and runs.

User will smoke test after return. Focus on correct implementation; do not run integration tests unless explicitly requested.

---

**End of Cursor Prompt.**
