# Whetstone Choice Overlay — Bubble Tail Specification

**Purpose:** Bridge between high-level planning and daily grind. Elias physically points at the Whetstone icon—reinforcing presence in the UI.  
**Status:** Locked — ready for implementation  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) Build Out 8, [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md)

---

## 1. Entry Point & Flow Logic

**Japandi principle:** Minimal entry points. Flow is strictly linear to prevent navigation fatigue.

| Phase | Action |
|-------|--------|
| **Trigger** | User is in **Your Satchel** view. They tap the **Whetstone icon** (sharpening stone). |
| **Transition** | `BackdropFilter` (Sigma 8) instantly softens the background. Whetstone icon remains "cut out" or highlighted. |
| **Choice** | Elias appears above the icon with a single path: **"Sharpen Habits"** (daily Whetstone/Habit tracker). Refine/Edit is on the Map (Peak Detail); direct users there to edit nodes. |

---

## 2. Technical Anchor — The Bubble Tail

Dynamic anchor so the speech bubble tail points accurately regardless of screen size (dashboard, remote desk).

| Item | Spec |
|------|------|
| **Hook** | Assign a `GlobalKey` to the Whetstone `IconButton` in the Satchel. |
| **Layout timing** | Use `WidgetsBinding.instance.addPostFrameCallback`. Overlay calculates position **after** the Satchel list has finished rendering—prevents tail pointing at "ghost" coordinates. |
| **Math** | Calculate the center-top of the icon's `RenderBox`. Offset the Elias overlay by **12px vertically** for tail breathing room. |

---

## 3. Aesthetic & Lore Integration

| Item | Spec |
|------|------|
| **Blur** | **Sigma 8.** Frosted glass depth—hides text clutter on the Map while keeping warm, organic colors visible in the periphery. |
| **Idle logic** | If overlay is left open **> 30 seconds** without a selection, auto-close with gentle fade. Elias parting: *"The stone stays blunt until the hand moves."* Wire `returnAfterIdle()`. |
| **Empty Satchel** | If user opens Whetstone but Satchel is empty, suggest going to the Map to add a stone or refine. Wire `emptySatchel()`. |

---

## 4. Elias Dialogue (`elias_dialogue.dart`)

| Key | Line | Purpose |
|-----|------|---------|
| `whetstone_entry` | *"A dull blade makes for a dangerous climb. How shall we prepare?"* | General overlay prompt. |
| `whetstone_habit_nudge` | *"Your daily rituals are the edge of your blade. Keep them sharp."* | Tooltip for Sharpen Habits. |
| `whetstone_refine_nudge` | *"This stone is too heavy. Let us strike it into smaller truths."* | Map/Refine flow only (not used in Satchel overlay). |

---

## 5. Implementation Checklist for Cursor

- [ ] `GlobalKey` on Whetstone `IconButton` in Satchel
- [ ] `addPostFrameCallback` to get icon `RenderBox` position (center-top)
- [ ] `SpeechBubblePainter` with `tailOffset` parameter for triangular tail pointing downward
- [ ] `Stack` with `BackdropFilter(filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8))` behind Elias, above Satchel
- [ ] Whetstone icon at higher z-index (or `CompositedTransformTarget`) so it remains unblurred and interactive
- [ ] Elias overlay offset 12px above icon center-top
- [ ] Single choice: "Sharpen Habits" → `/whetstone`
- [ ] Idle timeout 30s → fade close + `returnAfterIdle()` line
- [ ] Empty Satchel → `emptySatchel()` or suggest Map to add/refine stone
- [ ] Add `whetstone_entry`, `whetstone_habit_nudge`, `whetstone_refine_nudge` to `elias_dialogue.dart`

---

**End of Whetstone Choice Overlay Spec.**
