# Elias Presentation

## Purpose

To provide a single source of truth for the visual treatment of Elias's dialogue. This ensures a consistent user experience ("Sanctuary feel") and eliminates UI inconsistencies when adding new dialogue contexts.

## Reference

- **Content:** See [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md) for the actual text strings.
- **Voice/Tone:** See `elias_voice_guide.yaml`.

## Presentation Modes

| Mode | Visual Style | Context | Code Reference |
|------|--------------|---------|----------------|
| **Cinematic** | Plain typewriter text on a dimmed background gradient. | 5-Beat Intro, Lore beats, Major transitions. | `elias_intro_overlay.dart` |
| **Modal** | `_EliasParchmentDialog` (centered parchment card). | Confirmations, Wizard completions, Whetstone intro closing. | `elias_intro_overlay.dart` |
| **Character Bubble** | Speech bubble with a tail pointing to Elias. | Sanctuary tapping (General interaction/Nudges). | `sanctuary_screen.dart` (`_SpeechBubble`) |
| **Targeted Bubble** | Parchment bubble with a tail pointing to a specific UI element. | Whetstone (Satchel): Sharpen Habits only. (Refine/Edit is handled on the Map). | `whetstone_choice_overlay.dart` |

## Presentation Rules

### Context Matching

- If the dialogue is **narrative or world-building**, use **Cinematic**.
- If the dialogue is a **short confirmation after an action**, use **Modal**.
- If the **user initiated contact with Elias**, use **Character Bubble**.
- If **Elias is guiding a specific UI action**, use **Targeted Bubble**.

### The Whetstone Exception

The Whetstone Intro Setup (Onboarding) uses **inline prompt text** at the top of the bottom sheet rather than a bubble. This maintains focus on the input fields while Elias provides the prompt ("What small ritual keeps you steady?").

### Legibility Rule

Dialogue must always appear on a **dedicated surface** (Parchment, Bubble, or Scrim). Never render bare light text directly over detailed art without a backing element.

## Implementation Notes (Satchel)

The Whetstone Choice Overlay (Targeted Bubble) in the Satchel is restricted to a **single path: Sharpen Habits**. If the user needs to Refine Path (Edit nodes), they must be directed to the Map (Peak Detail).
