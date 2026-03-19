# Elias Dialogue Reference

**Purpose:** Single place to review and add Elias's speech. All copy lives in `lib/core/content/elias_dialogue.dart`.  
**Use this doc to:** audit lines, add new variants, keep tone consistent.

**Elias docs:** [ELIAS_VOICE_GUIDE.md](ELIAS_VOICE_GUIDE.md) — voice bible, tone rules, AI prompt, `scripts/generate_elias_dialogue.py`  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) — Build Out section references this doc for Elias prompts (Intro, Wizard, Satchel Pack, Whetstone overlay, Refine).

**Wiring:** `saveFailed()` is used on save/delete failure in `climb_flow_overlay.dart` and `edit_flow_overlay.dart`. `peakJournalArrival()` is shown once on Mountain Detail open in `mountain_detail_screen.dart`. Catalogue below matches `elias_dialogue.dart` (audit applied).

---

## Quick Map: Context → Pool → Type

| Context | Pool / Accessor | Type | Where Used |
|---------|-----------------|------|------------|
| **Sanctuary — Tap Elias** | `onTap()` | Rotating | `sanctuary_screen.dart` |
| **Sanctuary — Cold Hearth** | `coldHearth()` | Rotating | `sanctuary_screen.dart` |
| **Sanctuary — After Burn** | `afterBurn()` | Rotating | `sanctuary_screen.dart` |
| **Sanctuary — Burn Streak** | `burnStreakLine(days)` | Rotating | `sanctuary_screen.dart` |
| **Sanctuary — Mountain Summit** | `mountainSummit()` | Rotating | `sanctuary_screen.dart` |
| **Sanctuary — First Burn** | `firstBurnLine()` | Fixed | `sanctuary_screen.dart` |
| **Sanctuary — On Movement** | `onMovement()` | Rotating | `sanctuary_screen.dart` |
| **Sanctuary — First Land Quest** | `firstLandQuestStep1()`, `firstLandQuestStep3()` | Fixed | `sanctuary_screen.dart` |
| **Sanctuary — Home Intro (first run)** | `sanctuaryHomeIntroSatchel`, `sanctuaryHomeIntroPathAhead`, `sanctuaryHomeIntroFirepit` | Fixed | `sanctuary_screen.dart` (_SanctuaryHomeIntroOverlay) |
| **Stow the Map closing** | `stowTheMapClosing` | Fixed | After save success, before landing on Sanctuary (narrative bridge) |
| **Intro — Name Confirmation (Map Bridge)** | — | Fixed | Elias intro → map close |
| **Intro — Map Closing (Map Bridge)** | — | Fixed | Map close → Sanctuary landing |
| **Sanctuary — Save Failed (Grounded Recovery)** | `saveFailed()` | Fixed | 404 / timeout / generic save error |
| **Management — Pack Satchel** | `afterPack()`, `firstPackLine()`, `satchelFull()` | Rotating / Fixed | `management_menu_sheet.dart` |
| **Map — At Mountain Cap** | `atMountainCap()` | Rotating | `scroll_map_screen.dart` |
| **Map — Tending Slope** | `tendingSlopeUntouched()` | Rotating | `scroll_map_screen.dart` |
| **Peak Journal — Arrival** | `peakJournalArrival()` | Fixed | MountainDetailScreen (on Hero Zoom complete) |
| **Climb Wizard — Intent** | `climbIntentPromptWithIndex()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Intent Cap** | `intentCapReached()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Identity** | `climbIdentityPromptWithIndex()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Logic** | `climbLogicPromptWithIndex()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Landmarks** | `climbLandmarksPromptWithIndex()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Heavy Satchel** | `heavySatchel()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Duplicate Landmark** | `duplicateLandmark()` | Rotating | `climb_flow_overlay.dart` |
| **Climb Wizard — Pebbles** | `climbPebblesPromptWithIndex()`, `climbPebbleAdded()`, `climbNextLandmark()`, `climbAllDone()` | Rotating | `climb_flow_overlay.dart` |
| **Edit Flow** | `openEdit()`, `afterRename()`, `afterAddPebble()`, `afterDelete()` | Rotating | `edit_flow_overlay.dart` |
| **Satchel — Whetstone Overlay** | `whetstone_entry()`, `whetstone_habit_nudge()`, `whetstone_refine_nudge()` | Fixed | Whetstone choice overlay (bubble tail) |
| **Whetstone** | `habitStreakMilestone(days)` | Rotating | `whetstone_screen.dart` |
| **Satchel — Empty** | `emptySatchel()`, empty nudge to Map | Rotating / Fixed | Whetstone overlay when satchel empty |
| **Satchel — Return After Idle** | `returnAfterIdle()` | Rotating | Whetstone overlay idle 30s: "The stone stays blunt until the hand moves." |
| **5-Beat Intro** | `introBeat1` … `introBeat5`, `introPostFirstMountain`, `introWhetstonePrompt`, `introWhetstoneInsist`, `introPostWhetstone` | Fixed | EliasIntroOverlay — [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md) |

---

## Full Catalogue by Context

### Sanctuary — Tap Elias

**Context:** User taps Elias on the Hearth.  
**Type:** Rotating (no-repeat within same session)  
**Pool:** `_onTap`

| # | Line |
|---|------|
| 1 | The fire holds as long as you tend it. |
| 2 | You are further along than you think. |
| 3 | The summit does not move. You do. |
| 4 | Each stone burned is ground covered. |
| 5 | Patience and progress are the same thing. |
| 6 | You returned. That is enough for now. |
| 7 | The path waits. So do I. |
| 8 | Every return is a kind of burn. |
| 9 | You are here. That is the step that matters. |

---

### Sanctuary — Cold Hearth

**Context:** User taps Elias when fire is cold (no stones dropped).  
**Type:** Rotating  
**Pool:** `_coldHearth`

| # | Line |
|---|------|
| 1 | The embers are whispering for more wood. |
| 2 | No stone on the fire yet. When you are ready. |
| 3 | The hearth is patient. Bring a stone when it serves you. |

---

### Sanctuary — After Burn

**Context:** User burns a stone in the Hearth.  
**Type:** Rotating  
**Pool:** `_afterBurn`

| # | Line |
|---|------|
| 1 | It is done. The path opens. |
| 2 | One stone burned. Keep moving. |
| 3 | Progress is quiet work. |
| 4 | The peak remembers. |
| 5 | Well done. Rest, then return. |
| 6 | A stone burned is a debt paid to yourself. |
| 7 | One less weight. The path remembers. |
| 8 | Ash to earth. The fire is fed. |

---

### Sanctuary — Burn Streak

**Context:** User burns when streak ≥ 2.  
**Type:** Rotating (indexed by days)  
**Pool:** `_burnStreak`

| Days | Line |
|------|------|
| 2 | Two days in a row you've fed the fire. |
| 3 | Three days running. The path remembers. |
| 4 | Four days. The peak feels your steps. |
| 5 | Five days. Steady as stone. |
| 6+ | A week of burns. The fire knows your name. |

---

### Sanctuary — Mountain Summit

**Context:** Last pebble of a mountain burned.  
**Type:** Rotating  
**Pool:** `_mountainSummit`

| # | Line |
|---|------|
| 1 | The peak is yours. |
| 2 | Summit reached. The peak bows. |
| 3 | Every stone burned. The path is clear. |

---

### Sanctuary — First Burn (Fixed)

**Context:** User's first-ever burn.  
**Type:** Fixed  
**Pool:** `_firstBurn`

| Line |
|-----|
| One stone burned. The path opens. |

---

### Sanctuary — Home Intro (first run)

**Context:** First time the user lands on Sanctuary after the Elias intro and first mountain. Three-step overlay (Satchel → Path Ahead → Firepit) with spotlight and gold ring.  
**Type:** Fixed (one line per step)

| Step | Accessor | Line |
|------|----------|------|
| 0 Satchel | `sanctuaryHomeIntroSatchel` | Your satchel is heavy with intent. Carry only what you mean to finish. |
| 1 Path Ahead | `sanctuaryHomeIntroPathAhead` | These slots hold the stones for your climb. Keep them close to your heart—and the fire. |
| 2 Firepit | `sanctuaryHomeIntroFirepit` | The hearth transforms effort into peace. Feed the fire when a stone has served its purpose. |

---

### Sanctuary — On Movement

**Context:** User pans/drags on Sanctuary (throttled).  
**Type:** Rotating  
**Pool:** `_onMovement`  
**Technical note:** Movement dialogue should only trigger when Elias is *not* currently engaged in a Fixed intro or Tutorial sequence (e.g. Sanctuary Home Intro, First Land Quest). Suppress `onMovement()` during those flows so "Look at" / tap guidance is not overwritten.

| # | Line |
|---|------|
| 1 | You move. I notice. |
| 2 | The path rewards those who return. |
| 3 | A small step is still a step. |
| 4 | The fire is glad to see you. |
| 5 | Take your time. I am here. |
| 6 | The summit does not move. You do. |
| 7 | Each stone burned is ground covered. |
| 8 | Patience and progress are the same thing. |

---

### Sanctuary — First Land Quest (Fixed)

**Context:** First-run empty state; directs user to Satchel or Hearth.  
**Type:** Fixed  
**Pools:** `_firstLandQuestStep1`, `_firstLandQuestStep3`

| Step | Line |
|------|------|
| 1 | Your satchel is light. We must prepare for the ascent. Look within your bag. |
| 3 | The effort of the climb is fuel for the fire. Offer your finished works to the Hearth. |

---

### Sanctuary — Home Intro (First Run)

**Context:** First-run "User Manual" moment on Sanctuary landing. Fixed overlay steps.  
**Type:** Fixed  
**Pool:** `sanctuaryHomeIntroStep(index)`  
**Where:** `Fixed_SanctuaryHomeIntroOverlay`

| Step | Line |
|------|------|
| 0 (Satchel) | Your satchel is heavy with intent. Carry only what you mean to finish. |
| 1 (Path Ahead) | These slots hold the stones for your climb. Keep them close to your heart—and the fire. |
| 2 (Firepit) | The hearth transforms effort into peace. Feed the fire when a stone has served its purpose. |

---

### Intro — Map Bridge (Stow the Map)

**Context:** Transitional beat between intro naming phase and Sanctuary landing. Bridges "name confirmed" → map close → begin climb.  
**Type:** Fixed

| Moment | Line |
|--------|------|
| Name Confirmation | A fine name. Before we step forward, let us consult the map. |
| Map Closing | The path is set. Let's find our footing and begin the climb. |

---

### Management — Pack Satchel

**Context:** User taps "Pack Satchel" from Management sheet.  
**Type:** Rotating / Fixed  
**Pools:** `_afterPack`, `_firstPack`, `_satchelFull`

| Scenario | Pool | Line(s) |
|----------|------|---------|
| Satchel full | `_satchelFull` | Your satchel is full. Burn a stone before you add more. / Six stones is the limit. Feed the fire first. |
| First pack | `_firstPack` | Your satchel is packed. Drag a stone to the fire when it's done. |
| After pack | `_afterPack` | Your stones are chosen. Make them count. / The satchel is packed. The climb begins. / Carry only what matters. / A full bag and a clear head. / Begin. / These stones are yours. See them through. |

---

### Map — At Mountain Cap

**Context:** User tries to add a 4th peak.  
**Type:** Rotating  
**Pool:** `_atMountainCap`

| # | Line |
|---|------|
| 1 | Three peaks at once. Chronicle one to open a new path. |
| 2 | Three peaks at once is the cap. Chronicle one to open a new path. |

---

### Map — Tending Slope

**Context:** Mountain untouched 7+ days.  
**Type:** Rotating  
**Pool:** `_tendingSlopeUntouched`

| # | Line |
|---|------|
| 1 | The weeds are tall on that northern peak, but the earth is still good. |
| 2 | That path has gone quiet. The stones remember. |

---

### Peak Journal — Arrival

**Context:** User arrives at Mountain Detail after Hero Zoom transition. Elias appears from the side.  
**Type:** Fixed  
**Spec:** [PEAK_JOURNAL_SPEC.md](PEAK_JOURNAL_SPEC.md)

| Key | Line |
|-----|------|
| `peakJournalArrival` | Welcome to the base of this peak. Let us look at the path you've carved. |

---

### Climb Wizard — Intent (Step 0)

**Context:** Step 0 — why does this journey matter?  
**Type:** Rotating (no-repeat)  
**Pool:** `_climbIntentPrompt`

| # | Line |
|---|------|
| 1 | What is your intent for this climb? |
| 2 | What brings you to this peak? |
| 3 | Every journey has a purpose. What is yours? |

---

### Climb Wizard — Intent Cap Reached

**Context:** User exceeds 1000 chars on Intent.  
**Type:** Rotating  
**Pool:** `_intentCapReached`

| # | Line |
|---|------|
| 1 | Keep it focused. The peak is won with clarity, not volume. |
| 2 | A thousand characters is enough. Distill the essence. |

---

### Climb Wizard — Identity (Step 1)

**Context:** Step 1 — name the peak.  
**Type:** Rotating (no-repeat)  
**Pool:** `_climbIdentityPrompt`

| # | Line |
|---|------|
| 1 | Let's give this journey a name—a title for the peak. |
| 2 | What shall we call this peak? |
| 3 | Name the peak. |
| 4 | Every peak deserves a name. What is yours? |
| 5 | Speak the title into being. |

---

### Climb Wizard — Logic (Step 3)

**Context:** Step 3 — Climb vs Survey.  
**Type:** Rotating (no-repeat)  
**Pool:** `_climbLogicPrompt`

| # | Line |
|---|------|
| 1 | How does this journey unfold? Climb: step-by-step. Survey: areas to explore. |
| 2 | Choose the path: sequential steps or distinct regions? |
| 3 | The Climb: one milestone after another. The Survey: areas to explore. |
| 4 | Step-by-step or by region? Choose. |

---

### Climb Wizard — Landmarks (Step 4)

**Context:** Step 4 — add markers.  
**Type:** Rotating (no-repeat)  
**Pool:** `_climbLandmarksPrompt`

| # | Line |
|---|------|
| 1 | A peak isn't conquered in a single stride. What markers will define the path to the top? |
| 2 | Break the climb into phases. What do you call them? |
| 3 | Name the waypoints. One to ten. |
| 4 | Every summit has waypoints. What are yours? |
| 5 | The trail divides. Name each marker. |

---

### Climb Wizard — Heavy Satchel

**Context:** User tries to add 11th marker.  
**Type:** Rotating  
**Pool:** `_heavySatchel`

| # | Line |
|---|------|
| 1 | Heavy satchel. Ten markers is the limit. Lighten the load. |
| 2 | Ten waypoints is enough. The path needs clarity, not clutter. |

---

### Climb Wizard — Duplicate Landmark

**Context:** Two markers share the same name.  
**Type:** Rotating  
**Pool:** `_duplicateLandmark`

| # | Line |
|---|------|
| 1 | Each marker needs a unique name. Clear signage on the path. |
| 2 | No two waypoints share a name. Distinguish them. |

---

### Error Handling — Save Failed (Grounded Recovery)

**Context:** Generic recovery when a save fails (404, timeout, or other persistence error). Keeps immersion from breaking.  
**Type:** Fixed  
**Pool:** `saveFailed()`

| Line |
|-----|
| The mountain mist is thick right now—let's try that choice again. |

---

### Climb Wizard — Pebbles

**Context:** Step 5 — add pebbles per marker.  
**Type:** Rotating  
**Pools:** `_climbPebblesPrompt`, `_climbPebbleAdded`, `_climbNextLandmark`, `_climbAllDone`

| Scenario | Pool | Sample Lines |
|----------|------|--------------|
| Pebbles prompt | `_climbPebblesPrompt` | Now break each marker into stones. Tap one to add a pebble. / Each marker holds many pebbles. Tap a stone to add one. |
| Pebble added | `_climbPebbleAdded` | Another? Tap the same stone again or choose another. / One more pebble on the path. |
| Next landmark | `_climbNextLandmark` | On to the next marker. / Next stone. / The path continues. |
| All done | `_climbAllDone` | Path is clear. Return when you are ready to climb. / The peak is set. Return to the map. |

---

### Edit Flow (Refine Modal / Hammer)

**Context:** Refine modal — rename, add pebble, delete. Hammer shatters boulders into pebbles.  
**Type:** Rotating  
**Pools:** `_openEdit`, `_afterRename`, `_afterAddPebble`, `_afterDelete`  
**Spec:** [HAMMER_REFINE_MODAL_SPEC.md](HAMMER_REFINE_MODAL_SPEC.md)

| Scenario | Pool | Preferred Lines (Refine) |
|----------|------|--------------------------|
| Open modal | `_openEdit` | Let us look closer at this weight. Where shall we strike? |
| Add pebble | `_afterAddPebble` | A fine fragment. That is one less burden for the spirit. |
| Rename stone | `_afterRename` | A new name, a new path. It feels lighter already. |
| Delete pebble | `_afterDelete` | Let the dust return to the earth. We only carry what is useful. |

*Additional rotating variants:* What would you change? / Refine the path. / Another stone on the path. / Cleared. The path adjusts.

---

### Satchel — Whetstone Choice Overlay

**Context:** User taps Whetstone icon in Satchel. Elias appears with bubble tail pointing at icon. **Single choice:** Sharpen Habits. Refine/Edit is on the Map (Peak Detail, tap node).  
**Type:** Fixed  
**Spec:** [WHETSTONE_CHOICE_OVERLAY_SPEC.md](WHETSTONE_CHOICE_OVERLAY_SPEC.md)

| Key | Line | Purpose |
|-----|------|---------|
| `whetstone_entry` | A dull blade makes for a dangerous climb. How shall we prepare? | General overlay prompt. |
| `whetstone_habit_nudge` | Your daily rituals are the edge of your blade. Keep them sharp. | Tooltip for Sharpen Habits. |
| `whetstone_refine_nudge` | This stone is too heavy. Let us strike it into smaller truths. | Map/Refine flow only (not Satchel overlay). |

**Idle (30s):** Wire `returnAfterIdle()` — *"The stone stays blunt until the hand moves."*  
**Empty Satchel:** Wire `emptySatchel()` — suggest Map to add or refine stone. Prefer this nudge when the mechanical fix is "go to Map for a stone":  
*"An empty bag is a quiet path. Visit the map to find a stone worth carrying."*

---

### Whetstone — Habit Streak

**Context:** 7, 30, or 100-day habit streak.  
**Type:** Rotating (by milestone)  
**Pools:** `_habitStreak7`, `_habitStreak30`, `_habitStreak100`

| Days | Sample Lines |
|------|--------------|
| 7 | Seven days. The stone is sharp. / A week of tending. Well done. |
| 30 | Thirty days. The path knows your steps. / A month of discipline. The peak bows. |
| 100 | One hundred days. You are the stone. / A hundred days. The fire remembers. |

---

### Empty Satchel & Return After Idle (pools)

**Empty satchel** — `emptySatchel()`. Wired: Whetstone overlay when satchel empty. Pool now includes Map nudge.

| # | Line |
|---|------|
| 1 | Nothing packed yet. |
| 2 | The bag is empty. Pack your stones. |
| 3 | An empty satchel is a question. Answer it. |
| 4 | No stones chosen. Visit the Map. |
| 5 | An empty bag is a quiet path. Visit the map to find a stone worth carrying. |

**Return after idle** — `returnAfterIdle()`. Wired: Whetstone overlay (idle ~30s).

| # | Line |
|---|------|
| 1 | The fire's still here. Whenever you're ready. |
| 2 | You returned. That is enough for now. |
| 3 | The stone stays blunt until the hand moves. |

---

### Unused / Available Pools (other)

| Pool | Accessor | Notes |
|------|----------|--------|
| (see above) | `emptySatchel()`, `returnAfterIdle()` | Both wired; full lines listed in preceding sections. |

---

### 5-Beat Cinematic Intro (In Code)

Per [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md). Accessors: `EliasDialogue.introBeat1` … `introBeat5`, `introPostFirstMountain`, `introWhetstonePrompt`, `introWhetstoneInsist`, `introPostWhetstone`.

| Beat / Step | Line |
|-------------|------|
| 1 | Welcome, Traveler. The path has been quiet for a long time... but the mountains never forget a friendly face. |
| 2 | You can call me Elias. I will happily take you up the mountain... and help you find the peace between the peaks. |
| 3 | The mountains are the journeys you climb. Stones block the way. Your Satchel carries what you break. Bring them here... burn them in the Hearth, and the path opens. |
| 4 | But even a mountain is moved one pebble at a time. Strike a stone with your Hammer to find the manageable steps within. |
| 5 | Burn those pebbles here in the Hearth, and let the weight return to the earth as light. Tell me... what is calling to you today? |
| Post–first mountain | This mountain is now carved into our map. You can access it anytime from your satchel here at our campsite. I'll keep the fire going. |
| Whetstone prompt | Before you go—every climber needs a sharp edge. What small ritual keeps you steady? |
| Whetstone insist | Every climber needs a sharp edge. What is the one small ritual that keeps you steady? |
| Post–Whetstone | Your edge is sharp. Go to the Campsite when you are ready. |

---

## How to Add Dialogue

### Add to a Rotating Pool

1. Open `lib/core/content/elias_dialogue.dart`.
2. Find the private list (e.g. `_onTap`, `_afterBurn`).
3. Add a new string to the list:
   ```dart
   static const List<String> _onTap = [
     'The fire holds as long as you tend it.',
     'You are further along than you think.',
     'Your new line here.',  // ← add
   ];
   ```
4. No code changes needed — the existing `_pick()` logic will include it.

### Add a Fixed Line

1. Open `lib/core/content/elias_dialogue.dart`.
2. Add a private constant:
   ```dart
   static const String _myNewFixedLine = 'Elias says exactly this.';
   ```
3. Add a public accessor:
   ```dart
   static String myNewFixedLine() => _myNewFixedLine;
   ```
4. Wire it in the screen/overlay where it should appear.

### Add a New Rotating Pool (New Context)

1. Add the private list:
   ```dart
   static const List<String> _myNewContext = [
     'First variant.',
     'Second variant.',
   ];
   ```
2. Add the public accessor:
   ```dart
   static String myNewContext() => _pick(_myNewContext);
   ```
3. Use `EliasDialogue.myNewContext()` in the relevant widget.
4. Update this reference doc.

**Rule 4: Variable Injection.** Some lines take an `int days` (or similar) parameter for string interpolation in the UI—e.g. `burnStreakLine(days)`, `habitStreakMilestone(days)`. Keep the parameter type and usage consistent so the accessor signature and any interpolation (e.g. "Two days", "Seven days") do not break. When adding or editing such lines, check both the Dart accessor and the caller for the correct parameter.

### Tone Guidelines

See [ELIAS_VOICE_GUIDE.md](ELIAS_VOICE_GUIDE.md) for full voice rules, vocabulary, and sentence style. Quick check: warm, short sentences, metaphor-rich, no guilt, second person.

---

**File:** `lib/core/content/elias_dialogue.dart`  
**Last updated:** Use this doc as the source of truth for review; sync edits back to the Dart file.  
**Script:** When broadening variety in rotating pools, use this catalogue as the menu for `scripts/generate_elias_dialogue.py`.
