# Elias Introduction — Full Specification

**Purpose:** Transition from "productivity tool" to "living world." Elias front and center before any buttons. Voyager Sanctuary is a place of ritual, not just a task list.  
**Status:** Locked — ready for implementation  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) Build Out 1 & 2

---

## 1. The 5-Beat Cinematic Intro — "The Forest Threshold"

A Ghibli-esque sequence that welcomes the user, teaches the Sanctuary (Satchel, Hammer, Hearth), and prompts first mountain creation—all before any button appears. **Archivist tone:** warm, mythic, human. Ellipses (...) create a soft, conversational pause (typewriter can pause briefly at each).

**Forest Threshold (cold start):** A dense tree/forest image fades to reveal the Sanctuary. `FadeTransition` or `AnimatedOpacity`—simpler than parting. **Animation speed:** Link to `has_seen_elias_intro`. First-time users: slower, more cinematic to build anticipation. Returning users: quick, smooth "welcome back."

**Returning-user flow (has_seen_elias_intro = true):** Forest image holds 1s → Crossfade 1.5s to Sanctuary Map. "Descending into the sanctuary" every time. See [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md) §6.

### The Sequence (Final Script)

| Beat | Visual / Animation | Elias Pose | Dialogue (Typewriter Effect) |
|------|--------------------|------------|-----------------------------|
| **1** | Forest image fades to reveal the campsite | Sitting, hands open | *"Welcome, Traveler. The path has been quiet for a long time... but the mountains never forget a friendly face."* |
| **2** | Camera pulls in closer to Elias | Slight bow/nod | *"You can call me Elias. I will happily take you up the mountain... and help you find the peace between the peaks."* |
| **3** | Vellum reveal: The Satchel appears, glowing softly | Gesturing to the bag | *"The mountains are the journeys you climb. Stones block the way. Your Satchel carries what you break. Bring them here... burn them in the Hearth, and the path opens."* |
| **4** | Vellum reveal: A Stone shatters into Pebbles | Hand held open | *"But even a mountain is moved one pebble at a time. Strike a stone with your Hammer to find the manageable steps within."* |
| **5** | The Hearth fire flickers into a warm glow (`#C26D2B`) | Holding a cup | *"Burn those pebbles here in the Hearth, and let the weight return to the earth as light. Tell me... what is calling to you today?"* |

**Name capture (insert after Beat 2):** Two steps so Elias can use the traveler’s name in the rest of the intro. See [ELIAS_NAME_CAPTURE_RECOMMENDATIONS.md](ELIAS_NAME_CAPTURE_RECOMMENDATIONS.md).

| Step | Dialogue |
|------|----------|
| **Name prompt** | *"And you... every traveler carries a name along with their pack. What shall I call you as we walk?"* [Input: name; default if blank: "Wayfarer"] |
| **Name confirmation** | *"Ah, [Name]. A name with weight and worth. Let's see if we can't make it feel a little lighter by the time we reach the summit."* |

After name confirmation, continue with Beat 3 and Beat 5 using the stored name: Beat 3 *"The mountains are the journeys you climb, [Name]. Stones block the way..."*; Beat 5 *"...Tell me, [Name]... what is calling to you today?"* Profile field: `display_name` (nullable; persist default when user skips).

**User Action:** Tap screen or arrow/chevron to advance. Tap-to-advance skips typewriter if still animating (optional: tap again to skip). Standard visual-novel mechanic.

**Typewriter polish:** Pause briefly (~300ms) at ellipses for a natural, conversational beat.

**After the final beat (Beat 5):** The intro is 7 steps total (Beats 1–2 → name prompt → name confirmation → Beats 3–5). The New Journey Wizard opens directly after Beat 5. User completes the 6-step flow (Intent → Identity → Appearance → Logic → Markers → Placing stones).

### 1.1 Map Bridge (Stow the Map)

Transitional beat between the naming phase and the Map/Wizard, and between Map and Sanctuary landing. Ensures the handover from "consult the map" to "begin the climb" is explicit.

| Moment | Dialogue | When to show |
|--------|----------|--------------|
| **Name confirmation → Map** | *"A fine name. Before we step forward, let us consult the map."* (Optionally: *"Which peak shall we scout first?"*) | After name confirmation; immediately before opening the Map / New Journey Wizard. Implemented as intro step 7 in EliasIntroOverlay; accessor: `EliasDialogue.introBridgeToMap`. |
| **Map closing → Sanctuary** | *"The path is set. Let's find our footing and begin the climb."* | When the user is about to leave the Map (e.g. after planting the first mountain, before the post-first-mountain line and Whetstone, or when navigating to Sanctuary). Accessor: `EliasDialogue.stowTheMapClosing`. |

Full catalogue: [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md) § Intro — Map Bridge (Stow the Map).

### 1.2 Map Bridge & Sanctuary landing — Implementation Checklist

- [x] **SanctuaryScreen:** No first-entry spotlight overlay (beta UX). Pan/drag still triggers `onMovement()` on a throttle. Tutorial is Elias’s spoken intro + bubbles, not cutout highlights.
- [x] **Intro flow:** `introBridgeToMap` fires as step 7 immediately after name confirmation; then the New Journey Wizard opens.
- [x] **Elias pose on Sanctuary:** Time-of-day default silhouette (no forced `elias_guide_pose` for a 3-step home tour).
- [x] **stowTheMapClosing:** When the user taps "Stow the Map" in the intro wizard, the flow shows `EliasDialogue.stowTheMapClosing` in a dialog for screen time, then continues to post-first-mountain and Whetstone (no direct `context.go` until after Whetstone).

---

## 2. The Visual Handover (Background Progression)

The background tells the story. No mist—use forest fade and parallax.

| Beats | Background | Tone |
|-------|------------|------|
| **1–2** | Lush green forest edge (The Threshold) | Forest fades to reveal Elias |
| **3–4** | Parallax shift to campsite workbench/satchel area | Satchel and Hammer introduced |
| **5** | Settles on the Hearth; warm orange glow (`#C26D2B`) | Full Sanctuary revealed |

---

## 3. The Conclusion (After Wizard)

When the user completes the New Journey wizard and "Plants" their mountain:

- Wizard closes.
- User returns to the Campsite.
- **Elias's closing line:** *"This mountain is now carved into our map. You can access it anytime from your satchel here at our campsite. I'll keep the fire going."*

---

## 4. Whetstone Setup (After Wizard — No Skip)

**Decision:** Whetstone setup runs *immediately after* the New Journey wizard. Keeps the "no skip" ritual for habits while letting the user finish the main story (first peak) first.

**Flow:**

1. After wizard closes and Elias delivers the closing line (above).
2. **Elias's Whetstone prompt:** *"Before you go—every climber needs a sharp edge. What small ritual keeps you steady?"*
3. User adds 1–3 habits (min 1 required, max 3). "Add another" (secondary) or "Continue" (primary) until done.
4. No skip. Elias insists: *"Every climber needs a sharp edge. What is the one small ritual that keeps you steady?"*
5. On "Continue" (final): Save habits to `whetstone_items` via `whetstoneProvider.addItem()`.
6. **Elias's final line:** *"Your edge is sharp. Go to the Campsite when you are ready."*
7. Set `has_seen_elias_intro = true` in profiles.
8. Navigate to `/sanctuary` (Campsite).

**Rationale:** User finishes the big story (first peak) first. Habits feel like a smaller, focused step. Clear narrative: "You've planted your mountain. Now, what keeps you sharp?"

---

## 5. Technical Flags & Storage

| Item | Value |
|------|-------|
| **Flag** | `has_seen_elias_intro` |
| **Storage** | Supabase `profiles` table (public schema) |
| **Why** | Syncs across devices. User may switch between phone/tablet/laptop. |
| **Migration** | `supabase/migrations/20250317000000_add_has_seen_elias_intro.sql` |

### Logic

- **Trigger:** On auth redirect (after successful login/signup). If `profiles.has_seen_elias_intro == false` → push to EliasIntroOverlay (intro overlay) instead of Sanctuary/Map.
- **After intro:** On Whetstone setup completion (1–3 habits saved) → `supabase.from('profiles').update({'has_seen_elias_intro': true})` where `id = auth.uid()`. Navigate to `/sanctuary`.

---

## 6. Assets & Aesthetic Direction

| Asset | Description |
|-------|-------------|
| **Forest image** | Dense thicket/tree illustration. Fades to reveal Sanctuary (Beat 1 and cold-start loading). `FadeTransition` or `AnimatedOpacity`. Single asset; no parting motion. |
| **Elias poses** | 5 variations: Sitting, hands open (1), Slight bow/nod (2), Gesturing to bag (3), Hand open (4), Holding cup (5) |
| **Satchel glow** | Soft glow on vellum for Beat 3 |
| **Hammer + shatter** | Hammer icon appears; Stone "shatters" into Pebbles for Beat 4 |
| **Hearth glow** | Fire flickers into warm orange for Beat 5 |
| **Backgrounds** | Forest edge (1–2), Campsite workbench (3–4), Hearth (5) |

**Note:** If assets not yet available, use existing Elias sprite with subtle transforms. Placeholder copy in `elias_dialogue.dart`.

---

## 7. No Skip — Immersive Ritual

- **Disable system back button** during the intro sequence.
- User must complete the flow (5 beats + wizard + Whetstone setup).
- Use `PopScope(canPop: false)` or equivalent during intro.

---

## 8. Cursor Implementation Checklist

- [x] Create `lib/features/onboarding/elias_intro_overlay.dart` (EliasIntroOverlay) — implemented
- [ ] State machine: 5 beats (lore) → New Journey Wizard → closing line → Whetstone setup (1–3 habits) → final line → `/sanctuary`
- [ ] Tap-to-advance with optional typewriter skip
- [ ] `AnimatedSwitcher` or equivalent for cross-fade between beats
- [ ] Background parallax: forest edge → workbench → Hearth
- [ ] On Beat 5 complete: open New Journey Wizard (same flow as Elias → "New Journey")
- [ ] On wizard complete: show closing line; then Whetstone setup (Elias prompt, 1–3 habits, no skip)
- [ ] On Whetstone complete: save habits via `whetstoneProvider.addItem()`; `supabase.from('profiles').update({'has_seen_elias_intro': true})`; navigate to `/sanctuary`
- [ ] Auth redirect: if `!has_seen_elias_intro` → show intro instead of Sanctuary
- [ ] `PopScope(canPop: false)` during intro (including Whetstone step)
- [ ] Run migration `20250317000000_add_has_seen_elias_intro.sql`

---

## 9. Elias Dialogue Additions

Add to `elias_dialogue.dart`:

```dart
// 5-Beat Cinematic Intro — "The Forest Threshold" (Archivist tone, ellipses for pause)
static const String introBeat1 = "Welcome, Traveler. The path has been quiet for a long time... but the mountains never forget a friendly face.";
static const String introBeat2 = "You can call me Elias. I will happily take you up the mountain... and help you find the peace between the peaks.";
static const String introBeat3 = "The mountains are the journeys you climb. Stones block the way. Your Satchel carries what you break. Bring them here... burn them in the Hearth, and the path opens.";
static const String introBeat4 = "But even a mountain is moved one pebble at a time. Strike a stone with your Hammer to find the manageable steps within.";
static const String introBeat5 = "Burn those pebbles here in the Hearth, and let the weight return to the earth as light. Tell me... what is calling to you today?";

// Post–first mountain (after wizard)
static const String introPostFirstMountain = "This mountain is now carved into our map. You can access it anytime from your satchel here at our campsite. I'll keep the fire going.";

// Whetstone setup prompt (after closing line)
static const String introWhetstonePrompt = "Before you go—every climber needs a sharp edge. What small ritual keeps you steady?";
static const String introWhetstoneInsist = "Every climber needs a sharp edge. What is the one small ritual that keeps you steady?";

// Post–Whetstone (final)
static const String introPostWhetstone = "Your edge is sharp. Go to the Campsite when you are ready.";
```

---

**End of Elias Introduction Spec.**
