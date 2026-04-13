# Voyager Sanctuary — Refine & Polish Plan

**Role:** Project Manager & Developer  
**Purpose:** Single source of truth for moving from functional logic to "Smooth, Refined, Architectural Luxury"  
**Date:** March 2026  
**Status:** Actionable — ready for Cursor implementation

---

## Executive Summary

This plan synthesizes all user feedback from smoke tests, Gemini chats, and design discussions into a phased, actionable build. The goal is to eliminate "bumpy" interactions and make the app feel tactile and intentional.

**Core principle:** When fixing one instance (e.g., keyboard covering input), apply the **universal pattern** across the app so every screen feels consistent.

---

## 1. Decisions Locked (Answer the 4 Questions)

Before implementation, these four decisions must be locked. **Recommendations** are provided where you haven't answered.

### Q1. Elias Introduction (Lore) — When?

| Option | Description | Recommendation |
|--------|-------------|-----------------|
| **A** | First login → Elias monologue → user taps "Next" → empty Sanctuary | **Recommended.** Clean separation. User lands in Sanctuary after lore. |
| **B** | Monologue → auto-opens New Journey wizard | Feels pushy. User may want to explore first. |
| **C** | Weave lore into 6-step wizard | Bloats wizard; harder to maintain. |

**Decision:** _____________ (A recommended)

**Addition — Whetstone setup in intro:** During the first-time introduction, after the lore screens, the user sets up their Whetstone tasks. Elias guides them via **inline prompt text in the bottom sheet** (e.g. "What small ritual keeps you steady?"); no separate speech bubble—prompt appears at top of Whetstone intro sheet. User adds 1–3 habits in a guided flow. Data feeds into the same Whetstone provider; user can edit anytime from the Whetstone screen.

---

### Q2. Hammer Function — Where?

**Decision (updated):** The Hammer **is** in the Satchel. Trailing icon on each Stone in "Your Satchel". Tap → opens Refine modal where user splits a Stone (boulder) into Pebbles. Elias: *"A heavy stone is just a collection of pebbles waiting for a strike."*

---

### Q3. Placing stones (Step 5) — Marker Selection

| Option | Description | Recommendation |
|--------|-------------|-----------------|
| **A** | User clicks which chip: 1–10 marker chips visible; tap any chip to add pebbles to it | **Recommended.** Maximum flexibility. User can jump between markers. |
| **B** | Next Stone only: fixed order; must fill Marker 1, then 2, then 3 | Simpler but less flexible. |

**Decision:** **A** — Marker Chips only. Remove "Next Stone" automation.

---

### Q4. Step 5 Finalize — Button Label

| Option | Description | Recommendation |
|--------|-------------|-----------------|
| **Pack this Journey** | Metaphor: packing the satchel for the climb | **Recommended.** Aligns with "Pack Satchel" elsewhere. |
| **Finalize the Map** | More literal | Also valid. |

**Decision:** **Pack this Journey** — aligns with Satchel lore.

**Also:** Replace "Lock" in Satchel (slidable action) with **"Return to Satchel"** or **"Undo"** or **"Stow"** — per context. Lock implies irreversible; "Stow" is more accurate (return stone to active pebbles).

---

## 2. Universal Patterns (Golden Rules)

These apply **everywhere** in the app. Fix once, apply everywhere.

| Pattern | Rule | Where to Apply |
|--------|------|----------------|
| **Keyboard** | `SingleChildScrollView` + `MediaQuery.of(context).viewInsets.bottom` padding so focused input scrolls above keyboard | Climb, Edit, Management, Satchel, Auth, Whetstone, any screen with text input |
| **Loading** | Never blank screen. Skeleton or spinner in theme colors. | All async screens |
| **Empty state** | One clear next action. "What do I do?" answered. | Scroll, Satchel, Whetstone |
| **Elias speech bubble** | Only on tap. After **closing** popup menu, not when opening. | Management sheet, Whetstone choice |
| **Text** | Smooth, readable. Georgia font; proper line height. No cramped or jagged rendering. | All Elias copy, prompts, headers |
| **Buttons** | Cancel + Save. Save allows skipping name (empty = default). | Mallet dialogs, inline edit, any save/skip flow |

---

## 3. Phase 0 — P0 Friction (Fix Immediately)

### 3.1 Keyboard Overlays Text Input (P0)

**Problem:** Keyboard covers text input. User cannot see what they type.

**Fix:** Wrap every screen with text input in:
```dart
SingleChildScrollView(
  child: Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
    child: /* content */,
  ),
)
```
Or use `AnimatedPadding` when keyboard appears.

**Files:** `climb_flow_overlay.dart`, `edit_flow_overlay.dart`, `management_menu_sheet.dart`, `satchel_screen.dart`, `auth_screen.dart`, `whetstone_screen.dart`, `scroll_map_screen.dart` (mallet dialogs).

**Verification:** Open keyboard on any screen with input; focused field should scroll above keyboard.

---

### 3.2 Elias & Fire Lag (1st Drop)

**Problem:** On first stone drop, Elias disappears and there is lag swapping the firepit. Elias scales with fire; only fire should scale. Only visible after navigating away and back.

**Fix:**
1. **Pre-load assets:** `EliasWidget` and Hearth images should be precached before first drop.
2. **Consistent Key & Stack:** `_EliasWidget` uses a stable `Key` (e.g. `ValueKey('elias_hearth')`) and fixed Stack index. No rebuild that causes "blink."
3. **Elias size:** Elias must **not** scale with fire. Only fire scales. Remove any shared scale logic between Elias and Hearth.
4. **AnimatedOpacity/ColorFiltered:** Use smooth transition for state change, not widget rebuild.

**Files:** `sanctuary_screen.dart` — `_EliasWidget`, `_HearthWidget`, `TweenAnimationBuilder` / `RepaintBoundary` stack.

---

### 3.3 Save/Skip → Cancel and Save

**Problem:** "Skip" implies not saving. Confusing.

**Fix:** Replace "Skip" with "Cancel." "Save" allows empty name (default/no name). User can tap Save with nothing typed and it will save with default or empty title.

**Files:** `scroll_map_screen.dart` — `_showNameNewNodeDialog` (lines ~574–595). Also check mallet dialogs for boulder/pebble/shard naming.

**Verification:** Dialog shows Cancel + Save. Save with empty name = saves with default (e.g. "Untitled" or empty).

---

### 3.4 Duplicate "New Journey" Buttons

**Problem:** FAB (+) and "New Journey" in Management sheet both exist. User confused.

**Fix:** Both **must** open the **same** Climb/creation wizard. No duplicate flows. Tapping Elias → Management → New Journey is the primary entry. Map FAB is for power users. Same `onClose` / `openClimb=true` behavior.

**Files:** `management_menu_sheet.dart`, `scroll_map_screen.dart`. Verify both call `_openClimbFlow` or equivalent.

**Verification:** Elias → New Journey and Map FAB → same wizard. No divergence.

---

### 3.5 Lock Terminology

**Problem:** "Lock" in Satchel slidable action. "Lock" in Step 5.

**Fix:**
- **Satchel slot:** `Lock` → `Stow` or `Return to Map` (when marking stone as "not ready to burn" — return to active pebbles). When marking stone as "ready" → `Done` or `Ready to Burn`.
- **Step 5 completion:** Replace any "Lock" with **"Pack this Journey"** or **"Return to Map"** per Q4.

**Files:** `satchel_screen.dart` (line ~579), `climb_flow_overlay.dart` (Step 5).

---

## 4. Phase 1 — Gamification & Lore

### 4.1 Elias Introduction (First Login)

**Trigger:** First login (or first time after signup). User has never seen the intro.

**Flow:**
1. Full-screen overlay (outside main wizard).
2. Elias introduces himself, the Hearth, the Satchel, and the stones.
3. User taps "Next" (or tap anywhere) 2–4 times.
4. **Whetstone setup step:** Elias explains the Whetstone via **inline prompt text in the Whetstone intro sheet** (e.g. "What small ritual keeps you steady?"); the sheet contains the prompt and habit fields together. User adds 1–3 habits in a guided flow (Elias prompt → input field → Add → repeat or Continue). Data feeds into `whetstoneProvider` (same as Whetstone screen). User can edit anytime from the Whetstone screen.
5. Final screen: "You're ready. Begin." → dismiss to empty Sanctuary.

**Copy:** Generate and review Elias speech bubbles. See `elias_dialogue.dart` for tone. Add Whetstone intro lines to `elias_dialogue.dart` (used as inline prompt in sheet, not a separate bubble).

**Files:** New `lib/features/onboarding/elias_intro_overlay.dart`. `has_seen_elias_intro` in Supabase `profiles` (migration `20250317000000_add_has_seen_elias_intro.sql`). Trigger on auth redirect. Reuse `whetstoneProvider.addItem()` for habit creation. **Full spec:** [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md).

**External work:** None. Copy can be generated in code.

---

### 4.2 Step-by-Step Elias Speech (Peak Planting Wizard)

**Problem:** Prompt and input on same page. Not gamified. User doesn't read.

**Fix:** State-based reveal. Phase A (Elias prompt) → Phase B (input). Never both. "Continue" only reveals input; "Next" advances step.

**Full spec:** [PEAK_PLANTING_WIZARD_SPEC.md](PEAK_PLANTING_WIZARD_SPEC.md)

**Flow:** WizardState (currentStep, isInputPhase). Phase A: Elias + typewriter, "Continue". Phase B: Elias top-left 70%, input fades in, "Next". Step transition: fade to black (vellum), reset.

---

### 4.3 Rotate "What Would You Like to Do?"

**Problem:** Static "What would you like to do?" in Management sheet.

**Fix:** Rotate from pool: e.g. "What would you like to do?", "The fire holds as long as you tend it.", "You are further along than you think.", etc. Use `EliasDialogue.onTap()` or similar pool. Generate and review.

**Files:** `management_menu_sheet.dart`, `elias_dialogue.dart`.

---

### 4.4 Speech Bubble — Only When Tap, After Popup Close

**Problem:** Bubble shows when opening menu. Should show when user **taps** Elias and **after** they leave the popup.

**Fix:** Do **not** set `eliasMessageProvider` when opening Management sheet. Set it **after** user closes the sheet (pop). Or: show bubble only on tap, and **before** sheet opens; when sheet closes, show bubble again with a contextual line. Per GAPS §8: Option C — bubble when sheet closes.

**Files:** `sanctuary_screen.dart` — `_EliasWidget` onTap. `management_menu_sheet.dart` — `Navigator.pop` callback. `elias_provider.dart`.

---

## 5. Phase 2 — UX Polish

### 5.1 Move Stones Up — Smooth Animation

**Problem:** When stone is deleted or completed, stones should move up with a smooth, fun animation.

**Fix:** Use `AnimatedList` or `AnimatedSliverList` for satchel slots, Map pebble rows, etc. When item removed, animate out (slide up + fade). When item added, animate in.

**Files:** `sanctuary_screen.dart` — `_CompactSatchelTray`. `scroll_map_screen.dart` — `_MountainSection`, pebble rows. `satchel_screen.dart`.

---

### 5.2 Blank Row When No Stone

**Problem:** "If no stone for the row, should we leave blank?"

**Fix:** If a marker has no pebbles, show an empty row with a subtle hint (e.g. "Tap to add a pebble") or leave blank. Do **not** hide the row. Keeps layout consistent.

**Files:** `scroll_map_screen.dart` — `_TrailPebbleRow`, `_MountainTrailBody`.

---

### 5.3 Move Seek Guidance Down

**Problem:** Seek Guidance is high in the list.

**Fix:** Reorder Management menu: New Journey, Pack Satchel, Seek Guidance, Archive Recovery, Settings.

**Files:** `management_menu_sheet.dart`.

---

### 5.4 Text Readability

**Problem:** Text isn't smooth to read.

**Fix:** Ensure `EliasTypography`, `letterSpacing`, `height` (line height) are set. Use `fontFamily: 'Georgia'` for body. Check `elias_typography.dart` and `app_theme.dart`. Avoid cramped or low-contrast text.

**Files:** `elias_typography.dart`, `app_theme.dart`, all screens using Elias copy.

---

## 6. Phase 3 — Hammer in Satchel

**Clarification:** Hammer **is** in Satchel. Trailing icon on each Stone in "Your Satchel". Tap → opens Refine modal where user splits a Stone (boulder) into Pebbles. Elias: *"A heavy stone is just a collection of pebbles waiting for a strike."*

**Whetstone choice overlay:** When user taps Whetstone icon from Satchel, overlay offers **Sharpen Habits only**. Refine/Edit is on the Map (Peak Detail, tap node). Ensure bubble tail points at Whetstone icon (per FEATURE_RECOMMENDATIONS §3.5).

---

## 7. Execution Order

| Phase | Task | Priority |
|-------|------|----------|
| 0 | 3.1 Keyboard padding | P0 |
| 0 | 3.2 Elias & Fire lag fix | P0 |
| 0 | 3.3 Save/Skip → Cancel/Save | P0 |
| 0 | 3.4 Duplicate buttons (verify) | P0 |
| 0 | 3.5 Lock terminology | P0 |
| 1 | 4.1 Elias Introduction overlay | P1 |
| 1 | 4.2 Step-by-step Elias (wizard) | P1 |
| 1 | 4.3 Rotate Management greeting | P1 |
| 1 | 4.4 Speech bubble timing | P1 |
| 2 | 5.1 Stone movement animation | P1 |
| 2 | 5.2 Blank row handling | P2 |
| 2 | 5.3 Seek Guidance order | P2 |
| 2 | 5.4 Text readability | P1 |

---

## 8. Hard Truths (External Work Required)

| Item | What You Need | Why |
|------|---------------|-----|
| **Sound effects** | Pre-recorded or licensed audio files | Burn celebration, mallet strike, etc. App already has `stone_drop.mp3`, `weight.mp3`. Adding more requires assets. |
| **Elias art assets** | Designer or asset pack | New poses, expressions. Current assets are fixed. |
| **Custom fonts** | License if using commercial fonts | Georgia is system; custom serif would need license. |

**No external work:** Keyboard fix, layout, copy, state logic, animations, Elias dialogue text — all codeable.

---

## 9. Verification Checklist

After implementation:

- [ ] Keyboard never covers focused input on any screen.
- [ ] First stone drop: Elias does not disappear; no lag; only fire scales.
- [ ] All dialogs: Cancel + Save (Save allows empty name).
- [ ] New Journey: Elias and Map FAB open same wizard.
- [ ] Satchel: "Lock" → "Stow" or appropriate label.
- [ ] First login: Elias intro overlay (if Q1 = A).
- [ ] Wizard: Elias prompt first, then Continue, then input.
- [ ] Management: Rotating greeting; bubble after sheet close.
- [ ] Stone delete/complete: Smooth animation.
- [ ] Text: Readable, smooth.

---

## 10. Related Docs

- [AUDIT_FIX_IMPLEMENTATION_PLAN.md](AUDIT_FIX_IMPLEMENTATION_PLAN.md) — Node stream, loop bug, cache
- [SMOKE_TEST_ISSUES_AND_FIXES.md](Completed/SMOKE_TEST_ISSUES_AND_FIXES.md) — Issue log
- [ALIGNMENT_OUTCOME_SPEC.md](ALIGNMENT_OUTCOME_SPEC.md) — Target experience
- [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) — P0/P1/P2 features

---

**End of Refine & Polish Plan.**
