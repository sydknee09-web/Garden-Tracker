# Voyager Sanctuary — Full UI/UX Audit

**Date:** March 2026  
**Scope:** Visualization, Navigation, Button Polish, Descriptions, Layout  
**Sources:** User feedback, Gemini notes, screenshots, codebase review

---

## Executive Summary

The **storybook aesthetic** and **Dark Walnut** theme are strong. Elias and the parchment cards create a grounded, cozy atmosphere. However, **button layout**, **text wrapping**, and **navigation density** undermine polish. This audit provides actionable fixes prioritized by impact.

---

## 1. Critical — Button Overflow & Layout

### 1.1 Plant Pebble / Plant & Next Area — 80px Overflow (Gemini-confirmed)

**Location:** `climb_flow_overlay.dart` → `_NamePebbleCard` (lines 2072–2105)

**Problem:** The row `[Cancel] [Plant Pebble] [Plant & Next Area]` uses fixed-width children with no `Flexible`/`Expanded`. On narrow screens (~360px), "Plant & Next Area" overflows by ~80px.

**Current code:**
```dart
Row(
  mainAxisSize: MainAxisSize.min,
  mainAxisAlignment: MainAxisAlignment.end,
  children: [
    TextButton(onPressed: onCancel, child: Text('Cancel')),
    SizedBox(width: 12),
    FilledButton(..., child: Text('Plant Pebble')),
    SizedBox(width: 8),
    TextButton(..., child: Text('Plant & Next Area')),
  ],
)
```

**Fix options (pick one):**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A** | Shorten label to "Plant & Next" | Minimal code change; clears overflow | Slightly less explicit |
| **B** | Wrap in `Wrap` widget | Buttons stack on small screens | Layout shifts; less predictable |
| **C** | Use `Flexible` + `FittedBox` | Text scales down | Can become illegible |
| **D** | Stack buttons vertically on narrow screens | Clean, predictable | More layout logic |

**Recommended:** **Option A** — Change "Plant & Next Area" → "Plant & Next". Per MASTER_PLAN § P0.1.5, the ghost button is secondary; brevity is acceptable. Add `Flexible` around the TextButton as a safety net.

---

### 1.2 Return to Sanctuary — Awkward Text Wrapping

**Location:** All wizard steps; `returnLabel` passed as `'Return to Sanctuary'` when opened from Elias (management_menu_sheet.dart:110).

**Problem:** The label wraps as "Sanctuar-y" or "Retur / n to Sa / nctuar / y" on narrow screens. `Flexible` allows shrinking but doesn't prevent mid-word breaks.

**Fix:**

1. **Set `softWrap: true`** (already present in some places; ensure everywhere).
2. **Add `minWidth`** so the button doesn't shrink below ~120px:
   ```dart
   SizedBox(
     width: 120,
     child: TextButton(
       onPressed: onReturnToMap,
       child: Text(returnLabel, textAlign: TextAlign.center),
     ),
   )
   ```
3. **Alternative:** Use shorter label when space is tight: "Sanctuary" or "Back to Camp" (context-dependent).
4. **Typography:** Reduce font size for secondary actions from 14 → 12 on mobile: `Theme.of(context).textTheme.labelSmall`.

---

### 1.3 Pack this Journey / On to the next marker — Circular Button Text Wrap

**Location:** `_LandmarkChipsCard` (lines 1389–1430)

**Problem:** Long button labels ("Pack this Journey", "On to the next marker.") wrap inside circular/pill buttons, creating multi-line, cramped text.

**Fix:**

1. **Use fixed, short labels for buttons:** "Pack Journey" or "Pack" for primary; "Next" or "Next Marker" for advance.
2. **Reserve Elias voice for prompts, not button labels.** `EliasDialogue.climbNextLandmark()` returns random strings like "On to the next marker." — too long for a button. Use a **fixed short label** for the button, e.g. `"Next ${markerLabel}"`.
3. **Ensure primary CTA has enough width:** `Expanded` or `Flexible` with `minWidth: 100`.

---

## 2. Button Hierarchy & Spacing

### 2.1 Add Region / Remove — Too Close to Continue (Step 4)

**Location:** `_Step4Markers` (lines 1070–1106)

**Problem:** The "Remove" and "Add Region" row sits 12px above the "Back | Return to Sanctuary | Continue" row. Accidental taps on Continue when aiming for Add/Remove.

**Fix:**

- Increase `SizedBox(height: 24)` before the nav row to **32px or 40px**.
- Add a subtle visual separator (e.g. `Divider(color: AppColors.whetLine, height: 1)`) between list management and primary navigation.
- Consider moving Add/Remove to a **floating row** above the region list, or to the top of the card.

---

### 2.2 Universal Nav Row Pattern

**Problem:** Every step uses a similar `Row` with Back, Return, Continue. The pattern is duplicated 6+ times with slight variations. Inconsistent spacing and `Flexible` usage.

**Fix:**

- Extract a **shared widget** `_WizardNavRow`:
  ```dart
  _WizardNavRow(
    onBack: onBack,
    onReturn: onReturnToMap,
    returnLabel: returnLabel,
    primaryLabel: 'Continue',  // or custom
    onPrimary: onContinue,
  )
  ```
- Apply consistent `Flexible`/`Expanded` and `SizedBox` spacing.
- Use `LayoutBuilder` to switch to a **column layout** when `constraints.maxWidth < 320`.

---

## 3. Navigation & Flow

### 3.1 Clunky Navigation — Root Causes

| Issue | Manifestation | Fix |
|-------|---------------|-----|
| **Too many options in one row** | Back, Return to Sanctuary, Pack/Continue/Next in same row | Stack secondary actions (Back, Return) above primary; or use icon-only for Return (compass already exists) |
| **Unclear hierarchy** | "Return to Sanctuary" vs "Back" vs "Pack this Journey" — all feel equally weighted | Primary = filled orange; secondary = text; tertiary = icon (compass) |
| **Context switching** | User in wizard, wants to "go home" — "Return to Sanctuary" is correct but competes with "Back" | Rename "Back" → "Previous Step" when `onBack != null`; keep "Return to Sanctuary" as escape hatch |
| **Step 5 density** | Chips + Return to Sanctuary + Back + Pack/Next in one card | Split: chips + overflow message in one block; nav in a second block with more padding |

---

### 3.2 Compass vs Return Button Redundancy

**Current:** Compass icon (top-right) and "Return to Sanctuary" text button both close the overlay. On mobile, the text button wraps; the compass is always visible.

**Recommendation:** Keep both. Compass = quick escape for power users; Return = explicit for clarity. Ensure the text button doesn't wrap (see §1.2).

---

## 4. Descriptions & Copy

### 4.1 "Descriptions are not useful"

**Examples from screenshots:**

| Screen | Current | Issue | Improvement |
|--------|---------|-------|-------------|
| Step 4 | "Define one to ten phases. Each name must be unique." | Generic; doesn't explain *what* a phase/marker is | "Name the waypoints on your path—e.g. Research, Plan, Execute. Each must be unique." |
| Step 5 | "Stone by stone. Tap a marker to begin." | Poetic but vague | "Tap a marker to add pebbles. Add several per marker, or move to the next." |
| Identity | "This is your primary objective." | True but unhelpful | "This name appears on your map. Keep it short and memorable." |
| Appearance | "Every mountain has a spirit. How shall we visualize this journey?" | Good tone; could clarify | Add: "Choose a color theme for this peak on the map." |

---

### 4.2 Elias Prompts — Random vs Fixed

**Current:** `EliasDialogue.climbNextLandmark()` returns random strings: "On to the next marker.", "Next stone.", "The path continues.", "Another marker awaits."

**Problem:** When used as a **button label**, randomness causes layout instability and inconsistent length. "On to the next marker." is 22 chars; "Next stone." is 11.

**Fix:** Use Elias randomness **only for prompt text** (the paragraph above the inputs). Use **fixed, short labels** for buttons: "Next Marker", "Next", "Pack Journey".

---

## 5. Visual Balance & Elias Hitbox

### 5.1 Elias Overlap with Input Fields

**Location:** All steps; Elias is `Align(alignment: Alignment.centerLeft)` with `Transform.translate(offset: Offset(0, 20))`.

**Problem:** On small screens, Elias's hit area can overlap the parchment card. If Elias is tappable (e.g. in a future iteration), focus could be stolen from the TextField.

**Current:** In `climb_flow_overlay.dart`, Elias is rendered via `EliasWidget` with `showGreeting: false`. The widget is not wrapped in `GestureDetector` here, so no hitbox issue in the wizard. **Verify** that `EliasWidget` does not consume taps.

**Recommendation:** Ensure `IgnorePointer` or `AbsorbPointer` on Elias when it's decorative in the wizard, OR position Elias so it never overlaps the card on minimum supported width (320px).

---

### 5.2 Character Scaling

**Status:** Elias scales well (140×210 in wizard). No change needed.

---

## 6. Implementation Checklist

### Phase 1 — Critical (Do First)

- [x] **1.1** Fix Plant Pebble row overflow: shorten "Plant & Next Area" → "Plant & Next" + wrap in `Flexible(flex: 2)` (Plant & Next gets more space than Plant Pebble)
- [x] **1.2** Fix "Return to Sanctuary" wrapping: `FittedBox` + `softWrap: false`; `TextButton.styleFrom(minimumSize: Size.zero, padding: EdgeInsets.symmetric(horizontal: 8))`
- [x] **1.3** Replace dynamic Elias strings with fixed short labels: `idx == boulderCount - 1 ? 'Finish' : 'Next $markerLabel'`

### Phase 2 — Polish

- [ ] **2.1** Increase vertical padding between Add/Remove and Continue in Step 4
- [ ] **2.2** Extract `_WizardNavRow` shared widget for consistency
- [ ] **2.3** Add `LayoutBuilder` for narrow screens: stack buttons vertically when width < 320

### Phase 3 — Copy & UX

- [ ] **3.1** Improve step descriptions (see §4.1 table)
- [ ] **3.2** Clarify Back vs Return to Sanctuary (rename Back → "Previous Step" where applicable)
- [ ] **3.3** Add helper text for Appearance step: "Choose a color theme for this peak."

### Phase 4 — Technical

- [ ] **4.1** Verify `ListView`/`GridView` in Step 4 uses `shrinkWrap: true` (already present in `_Step4Markers`)
- [x] **4.2** Add `Semantics` for navigation/action buttons: `climb_nav_return`, `climb_nav_pack`, `climb_plant_pebble`, `climb_plant_and_next`

---

## 6.5 UI/UX Constraints (Implementation Lock)

**Do not change without updating tests and audit.** These constraints prevent layout regressions.

| Constraint | Value | Rationale |
|------------|-------|-----------|
| **Pack FAB threshold** | `LayoutBuilder` with `constraints.maxWidth < 360` | 360px = standard logical width for smaller Android devices (Pixel 4a, older Samsung A-series). Below this, use "Pack Journey" instead of "Pack this Journey". |
| **Integration test finders** | `find.bySemanticsLabel('climb_nav_return')`, `find.bySemanticsLabel('climb_nav_pack')`, `find.bySemanticsLabel('climb_plant_pebble')` | Stable semantics labels prevent tests from breaking when visible copy changes. |
| **Logic step truncation** | `maxLines: 3`, `overflow: TextOverflow.ellipsis` on `_LogicOption` subtitle | "The Climb" / "The Survey" descriptions must not be cut off mid-sentence; ellipsis handles varying screen heights. |
| **Plant Pebble row** | `Flexible(flex: 2)` for "Plant & Next"; label shortened to "Plant & Next" | Prevents ~80px overflow on narrow screens (~360px). |
| **Step 5 advance button** | `idx >= boulderCount - 1 ? 'Finish' : 'Next $markerLabel'` | Fixed labels; no EliasDialogue in button text. |
| **Return button** | `FittedBox(fit: BoxFit.scaleDown)` + `softWrap: false` | Prevents "Return to Sanctuary" wrapping awkwardly. |

---

## 7. Code References

| File | Relevant Section |
|------|------------------|
| `lib/features/scroll_map/climb_flow_overlay.dart` | `_NamePebbleCard` (2072–2105), `_LandmarkChipsCard` (1389–1430), all `Row` nav patterns |
| `lib/features/management/management_menu_sheet.dart` | Line 110: `returnLabel: 'Return to Sanctuary'` |
| `lib/core/content/elias_dialogue.dart` | `_climbNextLandmark`, `_climbAllDone`, `_climbLandmarksPrompt`, etc. |
| `lib/core/constants/app_colors.dart` | Color tokens for consistency |

---

## 8. Design Tokens to Formalize

Per MASTER_PLAN Phase 12: "Typography and color system formalized."

| Token | Current | Suggested |
|-------|---------|-----------|
| Nav row spacing | 8, 12 px ad hoc | 12 px between all nav items |
| Card padding | 24 px | 24 px (keep) |
| Min touch target | — | 44×44 px (iOS HIG) |
| Secondary font size | 14 | 12 for nav text on mobile |
| Primary button min width | — | 100 px |

---

**End of Audit.**
