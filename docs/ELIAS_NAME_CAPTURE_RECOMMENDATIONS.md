# Elias Name Capture — Review & Recommendations

**Purpose:** Review your notes and Gemini’s suggestions for adding a name-capture step to the Elias intro, and lock implementation choices for Voyager Sanctuary.  
**Status:** Recommendations ready for implementation  
**Related:** [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md), [ELIAS_VOICE_GUIDE.md](ELIAS_VOICE_GUIDE.md)

---

## 1. Review of Your Notes & Gemini

### What holds up

- **Name deepens immersion** — Shifting from “Traveler” to a chosen name matches the “personal apprenticeship” tone and fits the existing story-book pacing.
- **Placement** — Putting name capture **after Elias introduces himself (Beat 2)** and **before the Satchel/Hearth explanation (Beat 3)** keeps the flow natural: Elias says who he is, then asks who you are, then explains the tools.
- **Future use** — Using the name in later dialogue (“Tell me, [Name]… what is calling to you today?” and in encouragement during task-breaking) is a strong, consistent use of the variable.
- **No-penalty default** — If the user skips or leaves the name blank, giving a default like “Starlight” or “Wayfarer” keeps dialogue personal without forcing data entry. This aligns with the app’s philosophy.
- **Tone consistency** — Keeping the same serif font, underlines, centered layout, and Elias illustration on the name screens matches the existing intro (and your screenshots).

### What to lock in

- **Two-step flow** — One screen to ask for the name, one to confirm and use it. That matches both Gemini variants and gives a clear “Elias heard you” moment.
- **Storage** — Store the name on the **profile** (e.g. `display_name` or `traveler_name`) so it syncs across devices and is available everywhere Elias speaks.
- **Dialogue wording** — Prefer the variant that fits right after “You can call me Elias…”:  
  **Prompt:** *“And you… every traveler carries a name along with their pack. What shall I call you as we walk?”*  
  **Confirmation:** *“Ah, [Name]. A name with weight and worth. Let’s see if we can’t make it feel a little lighter by the time we reach the summit.”*  
  Alternative prompt if you want a slightly more mythic tone: *“But before we begin our ascent… a traveler is more than just a face in the mountains. Tell me… what name do you carry?”*

---

## 2. Recommendations

### 2.1 Placement in the intro (final)

Keep the current 5-beat order, but **insert two steps between Beat 2 and Beat 3**:

| Step | Content |
|------|--------|
| Beat 1 | Welcome, Traveler… |
| Beat 2 | You can call me Elias… |
| **Name prompt** | And you… every traveler carries a name… [Input] |
| **Name confirmation** | Ah, [Name]. A name with weight and worth… |
| Beat 3 | The mountains are the journeys you climb**, [Name]**… |
| Beat 4 | But even a mountain is moved one pebble at a time… |
| Beat 5 | Burn those pebbles here… **Tell me, [Name]…** what is calling to you today? |

So the **intro becomes 7 steps** (5 lore beats + 2 name steps), then wizard → closing line → Whetstone → Sanctuary.

### 2.2 Variable storage

- **Schema:** Add a nullable text column to `profiles`, e.g. `display_name` (or `traveler_name`). Syncs across devices; no extra table.
- **When to save:** On “Tap to continue” after the **confirmation** screen: persist the name (or the chosen default) to the profile so Beat 3 and Beat 5 can read it. If you keep the name in intro overlay state until then, you can save once and then continue with the rest of the beats.
- **Default when blank/skip:** Use a single default, e.g. **“Wayfarer”** (or “Starlight”). Store that default in the profile as well so later dialogue is consistent (“Tell me, Wayfarer…”).

### 2.3 Tone and UI

- **Font / layout:** Same as existing intro: Georgia (or existing serif), white/cream text, thin yellow-green underlines, Elias centered above the text.
- **Input field:** Style the name input to feel part of the story — e.g. a minimal underlined field (same serif, same underline style) rather than a heavy form control. Placeholder: “Enter your name” or “What shall I call you?”
- **Confirmation:** Same layout as other beats: Elias + confirmation line + “Tap to continue.” No extra buttons unless you explicitly want a “Skip” that applies the default.

### 2.4 Future integration points

Once the name is on the profile (or in a provider that reads profile):

- **Intro Beat 3:** `"The mountains are the journeys you climb, [Name]. Stones block the way…"`
- **Intro Beat 5:** `"…Tell me, [Name]… what is calling to you today?"`
- **Post–first mountain (optional):** e.g. “This mountain is now carved into our map, [Name]. You can access it…”
- **Whetstone / other overlays:** Use name in key lines where it fits (e.g. “Before you go, [Name]—every climber needs a sharp edge…”).
- **Hammer / high-friction moments:** “Steady your hand, [Name]. One strike of the hammer at a time.” (As Gemini suggested.)

Implement by either:

- Adding **name-aware helpers** in `elias_dialogue.dart`, e.g. `introBeat3WithName(String name)`, `introBeat5WithName(String name)`, and using a single `[Name]` placeholder in the string, or
- Passing the resolved display name (from profile or default) into the intro overlay and any other place that shows Elias dialogue, and doing a simple replace of `[Name]` (or a token) in the string before display.

### 2.5 Technical checklist

- [ ] Migration: add `display_name` (or `traveler_name`) to `profiles` (nullable text).
- [ ] Profile model + repository: read/write the new field; ensure `ensureProfile` / fetch still work.
- [ ] Intro overlay: after Beat 2, show name-prompt step (Elias + prompt + input); on submit, show confirmation step with “Ah, [Name]. …”; on “Tap to continue” after confirmation, save name (or default) to profile, then continue with Beat 3.
- [ ] Beat 3 and Beat 5 (and any other intro lines that use the name): use name from profile or from overlay state (e.g. after save + refetch, or state passed through).
- [ ] Default: when name is null/empty, use “Wayfarer” (or “Starlight”) and persist it so all later dialogue is consistent.
- [ ] Optional: add `EliasDialogue.introNamePrompt`, `introNameConfirmation(String name)`, and `introBeat3WithName(String name)` / `introBeat5WithName(String name)` (and update ELIAS_INTRODUCTION_SPEC + ELIAS_VOICE_GUIDE examples).

---

## 3. Summary

- Your instinct and Gemini’s flow are aligned: **ask for the name right after Elias introduces himself**, then **confirm**, then continue with **Satchel/Hearth** and **inject the name** into Beat 3, Beat 5, and beyond.
- Gemini isn’t outdated for this feature; the main implementation work is: **two new intro steps**, **one new profile field**, **name-aware dialogue helpers or token replacement**, and **a no-penalty default**.
- Lock the dialogue to the “every traveler carries a name” prompt and “Ah, [Name]. A name with weight and worth…” confirmation, keep the same visual style as the rest of the intro, and store the name on the profile so Elias can use it everywhere.

---

**Next step:** Add the name-capture beat and dialogue to [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md) as the canonical spec, then implement migration → model → overlay → dialogue helpers.
