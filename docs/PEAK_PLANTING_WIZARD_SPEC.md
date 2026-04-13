# Peak Creation Wizard (Peak Planting Wizard) — State-Based Reveal Specification

**Purpose:** Core ritual of Voyager Sanctuary. Decouple prompt from input so the user "listens" to Elias before acting. Conversation, not data-entry form.  
**Status:** Locked — ready for implementation  
**Related:** [ALIGNMENT_OUTCOME_SPEC](ALIGNMENT_OUTCOME_SPEC.md), [MASTER_PLAN](MASTER_PLAN.md) Part B

---

## 1. State-Based Reveal

Each step has **two phases**. Input is never visible until the user has "heard" Elias.

| Phase | Content | User Action |
|-------|---------|-------------|
| **Phase A (Lore/Prompt)** | Elias front-and-center, large speech bubble. | Tap **"Continue"** → transitions to Phase B |
| **Phase B (Input/Action)** | Elias slides to top-left (70% scale). Input/options in center. | User completes input, taps **"Next"** (or "Pack Journey" on Step 5) → advances step |

**Rule:** Tapping "Continue" on Phase A **only** sets `isInputPhase = true`. It does **not** advance the step. The user must be in Phase B and tap "Next" to advance.

---

## 2. The 6 Steps — Prompts & Inputs

| Step | Goal | Elias Prompt (Phase A) | Input UI (Phase B) |
|------|------|------------------------|-------------------|
| **0. Intent** | Why the journey matters | *"Before we look to the horizon, look within. Why does this journey matter to your spirit?"* | Multi-line Text: "e.g., To create a space of peace for my family." |
| **1. Identity** | Name the peak | *"A noble cause. Now, what name shall we give this peak on your map?"* | Single-line Text: "e.g., Master Bath Remodel" |
| **2. Appearance** | Visual identity | *"Every mountain has a spirit. How shall we visualize this journey?"* | Icon/Style Picker. Saved to `mountains.appearance_style`. Palette: `dark_walnut` (deep brown), `navy` (inky blue), `slate` (default, Japandi grey-blue), `charcoal` (soft black), `burgundy` (deep wine), `forest` (muted evergreen). |
| **3. Logic** | Journey type | *"Will this be a long trek through the seasons, or a swift ascent?"* | Toggle: "Long-term" (Climb) vs "Sprint" (Survey). **Note:** User can change this for any sub-folder later in the Peak Journal—each marker can have its own Climb or Survey logic. |
| **4. Markers** | Signposts | *"A path is made of landmarks. Where shall we place the first signposts?"* | Manual Map Selection (Chip markers) |
| **5. Placing stones** | First pebble | *"The first step is the hardest. What is the very first pebble you will carry?"* | Text Field: "e.g., Research tile vendors" |

### Logic & Flow Notes

**Intent (Step 0):** Save to `mountains.intent_statement`. 1000-char cap. It is the "North Star" that Elias can reference later if the user hasn't burned a pebble in a while.

**Transition (Step 0 → 1):** The "deep breath." Multi-line box for Intent fades out; crisp, sharp single-line box for the Name fades in.

**Cancel vs Save:** If they hit "Save" at any point after Step 1, it defaults to "Untitled Peak." They must at least reach the Identity phase to commit the peak to the Map.

---

## 3. Technical State Machine

```dart
class WizardState {
  final int currentStep;      // 0–5 (6 steps: Intent → Identity → Appearance → Logic → Markers → Placing stones)
  final bool isInputPhase;    // false = Phase A (prompt), true = Phase B (input)
}
```

**Transitions:**
- **Continue (Phase A):** `isInputPhase = true`. Do **not** advance `currentStep`.
- **Next (Phase B):** Advance `currentStep`. Reset `isInputPhase = false` for new step.
- **Step 5 "Pack this Journey":** Same as Next — advance and close wizard.

**Input visibility:** `Visibility(visible: isInputPhase)` — input only shown in Phase B.

---

## 4. Animation & Transitions

### Prompt → Input (Phase A → Phase B)

| Element | Animation |
|---------|-----------|
| **Elias** | `AnimatedPositioned` — moves to top-left. Scale down to 70%. |
| **Speech bubble** | Shrinks into smaller "header" bubble. |
| **Input field** | `FadeTransition` + `SlideTransition` (offset 0.1 → 0.0, upward). |
| **Continue button** | Text changes to "Next" (or "Pack Journey" on Step 5). |

**Aesthetic:** Organic Modern — smooth, weighted, intentional.

### Step → Step (Next pressed)

- Entire screen **briefly fades to black** (vellum texture).
- Fade back.
- Reset `isInputPhase = false` for new step.
- Elias returns to full-size, center. New prompt.

---

## 5. Elias Typewriter Effect

**Phase A only:** Elias's prompt uses a **character-count typewriter effect** — text reveals character-by-character (or word-by-word) so the user "listens" as Elias "speaks."

---

## 6. Keyboard Awareness

- Apply `MediaQuery.viewInsets.bottom` padding so Elias and input **slide above the keyboard** when focused in Phase B.
- Per [MASTER_PLAN](MASTER_PLAN.md) Universal Patterns.

---

## 7. Cursor Implementation Checklist

- [ ] `WizardState` with `currentStep` (0–5) and `isInputPhase` (bool)
- [ ] `Visibility(visible: isInputPhase)` for input — never show input in Phase A
- [ ] "Continue" (Phase A) → `isInputPhase = true` only. No step advance.
- [ ] "Next" / "Pack Journey" (Phase B) → advance step, reset `isInputPhase`, fade transition
- [ ] `AnimatedPositioned` for Elias (center → top-left 70% on Phase B)
- [ ] Speech bubble shrink on Phase B
- [ ] `FadeTransition` + `SlideTransition` for input reveal
- [ ] Step 0→1 transition: "deep breath" — multi-line fades out, single-line fades in
- [ ] Step transition: fade to black (vellum), fade back, reset phase
- [ ] Typewriter effect for Elias in Phase A
- [ ] `viewInsets.bottom` for keyboard
- [ ] Use provided 6-step prompts
- [ ] Save Intent to `mountain_logs` or description field; "Untitled Peak" if Save before Identity

---

## 8. Alignment Notes

| Item | This Spec | ALIGNMENT_OUTCOME_SPEC |
|------|------------|------------------------|
| Step 0 | Intent (why) — multi-line | Aligns with ALIGNMENT Step 1. |
| Step 1 | Identity (name) — single-line | Aligns with ALIGNMENT Step 2. |
| Step 2 | Appearance (Icon/Style picker) | Visual identity. |
| Step 3 | Long-term vs Sprint | Climb (sequential) vs Survey (areas). Map or extend? |
| Step 4 | Chip/Marker selection | Dynamic 1–10, add/remove. |
| Step 5 | "First pebble" text field | Marker chips, Plant Pebble, Plant & Next Area. |

**Resolution:** Option A chosen. Intent (Step 0) is the foundation; Identity (Step 1) follows. Separating them forces reflection before naming. Merging would risk rushing through the "Why."

---

**End of Peak Creation Wizard Spec.**
