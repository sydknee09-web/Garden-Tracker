# Elias Dialogue Audit — Recommendations

**Purpose:** Audit results and actionable recommendations for Elias's dialogue in Voyager Sanctuary.  
**Sources:** [GEMINI_ELIAS_DIALOGUE_AUDIT_HANDOFF.md](GEMINI_ELIAS_DIALOGUE_AUDIT_HANDOFF.md), [elias_dialogue.dart](../lib/core/content/elias_dialogue.dart), [ELIAS_VOICE_GUIDE.md](ELIAS_VOICE_GUIDE.md), [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md).  
**Voice:** Warm, short, metaphor-rich, no guilt, second person. ~80 chars for bubbles when possible. Avoid: tasks, goals, productivity, achieve, success, complete, checklist, reminder.

**Implementation status:** §2 rewrites, §3 missing pieces (saveFailed, peakJournalArrival, returnAfterIdle line, empty-satchel Map nudge, Edit Flow preferred lines, optional variants), and UI wiring are done. Save failures use `EliasDialogue.saveFailed()` in climb_flow_overlay and edit_flow_overlay; Mountain Detail shows `EliasDialogue.peakJournalArrival()` once on arrival.

---

## 1. Audit by context / pool

| Context / Pool | Note |
|----------------|------|
| **After Burn** (`_afterBurn`) | Five lines fit world/vibe. One line uses "task" (avoid): *"A task completed is a debt paid to yourself."* — Replace with stone/work metaphor. |
| **After Pack** (`_afterPack`) | Five lines fit. One line uses "tasks" (avoid): *"These tasks are yours. See them through."* — Replace "tasks" with "stones" or "works". |
| **Empty Satchel** (`_emptySatchel`) | All four lines fit. Missing REFERENCE preferred Map nudge for when the fix is "go to Map": *"An empty bag is a quiet path. Visit the map to find a stone worth carrying."* Add to pool or use as preferred when wiring empty-satchel → Map. |
| **Mountain Summit** (`_mountainSummit`) | All three lines fit; short and ritual. No change. |
| **Burn Streak** (`_burnStreak`) | All lines fit; days 2–6+ consistent. No change. |
| **Satchel Full** (`_satchelFull`) | Both lines fit and under 80 chars. No change. |
| **At Mountain Cap** (`_atMountainCap`) | First line slightly casual ("You've got three peaks"). REFERENCE uses "Archive one"; code uses "Chronicle one"—prefer "Chronicle" (fits peak/journal). Option: soften first line to "Three peaks at once. Chronicle one to open a new path." for consistency. |
| **Return After Idle** (`_returnAfterIdle`) | Current two lines fit. Missing REFERENCE line for Whetstone idle 30s: *"The stone stays blunt until the hand moves."* Add to pool. |
| **Streak Frozen** (`_streakFrozen`) | All three lines fit; no guilt, metaphor-rich. No change. |
| **First Pack** (`_firstPack`) | Single line fits. No change. |
| **Mark Done To Drop** (`_markDoneToDrop`) | All three lines use "task" (avoid). Replace with "stone" or rephrase ("Mark the stone as done" is already in line 1; lines 2–3 say "Complete the task", "mark that task done"). |
| **First Burn** (`_firstBurn`) | Fits. No change. |
| **Intro (5-beat)** | Beats 1–5, name confirmation, post-mountain, Whetstone, stow-the-map: tone and vocabulary fit. Code uses `\nthe mountains` (no "but") in Beat 1; REFERENCE/specs say "but"—code is intentionally updated per plan; no change. |
| **Sanctuary Home Intro** (Satchel / Path Ahead / Firepit) | Path Ahead line is 89 chars: *"These slots hold the stones for your current climb. Keep them close to your heart—and the fire."* Consider trimming to ~80 for bubble (e.g. "These slots hold the stones for your climb. Keep them close to your heart—and the fire." → 78 chars). |
| **First Land Quest** (`_firstLandQuestStep1`, `_firstLandQuestStep3`) | Step 1 uses "ascent", "bag"; Step 3 uses "finished works"—all fit. No change. |
| **Tending Slope Untouched** (`_tendingSlopeUntouched`) | Both lines fit; "stones remember" in code matches REFERENCE. No change. |
| **Cold Hearth** (`_coldHearth`) | Single line only; consider adding 1–2 variants for variety (see Optional new variants). |
| **On Tap** (`_onTap`) | All six lines fit; none over 80 chars; consistent guide tone. No change. |
| **On Movement** (`_onMovement`) | Overlap with _onTap (summit, patience, stone) is fine for variety. "The fire is glad to see you" is warm without cheerleading. No change. |
| **Climb Intent** (`_climbIntentPrompt`) | Three variants in code; REFERENCE lists five. Current three are short and clear. No vocabulary issues. No change unless expanding pool. |
| **Intent Cap Reached** (`_intentCapReached`) | Both lines fit. No change. |
| **Climb Identity** (`_climbIdentityPrompt`) | Five variants; one colloquial in _climbPeakPrompt ("Mighty fine one you've got your eyes set on")—see rewrites. |
| **Climb Logic** (`_climbLogicPrompt`) | First line 87 chars: *"How does this journey unfold? The Climb is step-by-step. The Survey is a collection of areas."* Consider splitting or trimming for bubble. |
| **Climb Peak** (`_climbPeakPrompt`) | "Mighty fine one you've got your eyes set on" is colloquial; others fit. |
| **Climb Landmarks** (`_climbLandmarksPrompt`) | All fit. No change. |
| **Heavy Satchel** / **Duplicate Landmark** | Fit. No change. |
| **Climb Pebbles / Pebble Added / Next Landmark / All Done** | All fit. Code "Stow the map" is more actionable than REFERENCE "Return when you are ready"; keep code. |
| **Hammer Prompt** (`_hammerPrompt`) | All four lines fit; one REFERENCE preferred line for Edit open is here ("Let us look closer at this weight. Where shall we strike?")—recommend adding to _openEdit (see Edit Flow). |
| **After Hammer Strike** (`_afterHammerStrike`) | Fit. No change. |
| **Edit Flow** (`_openEdit`, `_afterRename`, `_afterAddPebble`, `_afterDelete`) | REFERENCE lists Preferred Lines that deepen weight/ritual. Current code is shorter and consistent. Recommend adopting REFERENCE preferred as primary or adding them into rotation (see Missing pieces). |
| **Management Greetings** | "How can I help you today?" is slightly corporate; others ("What calls to you?", "Where shall we go from here?") fit. Optional: replace "How can I help you today?" with something like "What would you like to do?" (already in pool) or "What needs tending?" |
| **Sanctuary Period Greetings** | Dawn/midday/sunset/night all fit. No change. |
| **Whetstone entry / habit nudge / refine nudge** | All fit. No change. |
| **Habit Streak 7/30/100** | All fit. "Discipline" in 30-day line is borderline (productivity-adjacent) but "path knows your steps" / "peak bows" carries it. No change. |

---

## 2. Recommended rewrites

| Current line | Recommended rewrite | Reason |
|--------------|---------------------|--------|
| *A task completed is a debt paid to yourself.* (`_afterBurn`) | *A stone burned is a debt paid to yourself.* or *One stone burned. A debt paid to yourself.* | Avoid "task"; use "stone". |
| *These tasks are yours. See them through.* (`_afterPack`) | *These stones are yours. See them through.* or *Your stones are chosen. See them through.* | Avoid "tasks"; use "stones". |
| *Complete the task in your Satchel first. Then the stone is ready to burn.* (`_markDoneToDrop`) | *Mark the stone done in your Satchel first. Then it is ready to burn.* | Avoid "task"; keep "stone". |
| *Open your Satchel and mark that task done. Then you may drop it here.* (`_markDoneToDrop`) | *Open your Satchel and mark the stone done. Then you may drop it here.* | Avoid "task". |
| *These slots hold the stones for your current climb. Keep them close to your heart—and the fire.* (`sanctuaryHomeIntroPathAhead`) | *These slots hold the stones for your climb. Keep them close to your heart—and the fire.* | Trim to ~78 chars for bubble. |
| *How does this journey unfold? The Climb is step-by-step. The Survey is a collection of areas.* (`_climbLogicPrompt`) | *How does this journey unfold? Climb: step-by-step. Survey: areas to explore.* or split into two bubbles. | Shorten for ~80 chars or split. |
| *You've got three peaks. Finish one before you start another.* (`_atMountainCap`) | *Three peaks at once is the cap. Chronicle one to open a new path.* (use as single line) or keep both with first line: *Three peaks at once. Chronicle one to open a new path.* | Softer; align with second line; prefer "Chronicle" over "Archive" for world. |
| *Mighty fine one you've got your eyes set on. What do they call this peak?* (`_climbPeakPrompt`) | *A fine peak. What do they call it?* or *What shall we call this peak?* (already in pool). | Less colloquial; fits guide tone. |
| *How can I help you today, %s?* (`_managementGreetingsWithName`) | *What would you like to do, %s?* or *What calls to you, %s?* (both already in pool)—or add *What needs tending, %s?* | Slightly less corporate. |

---

## 3. Missing pieces

### 3.1 `saveFailed()`

- **Status:** Documented in REFERENCE for 404 / timeout / generic save error; not in `elias_dialogue.dart`.
- **Recommendation:** Add to Dart:
  - Private constant or single-line pool: *"The mountain mist is thick right now—let's try that choice again."*
  - Public accessor: `static String saveFailed() => _saveFailed;` (or `_pick(_saveFailed)` if you add variants).
- **Wire:** Call from save-error handling (e.g. after failed Supabase or local persist); show in Elias bubble or toast so recovery stays in-world.

### 3.2 `peakJournalArrival()`

- **Status:** Documented in REFERENCE and PEAK_JOURNAL_SPEC; not in `elias_dialogue.dart`.
- **Recommendation:** Add to Dart:
  - Fixed line: *"Welcome to the base of this peak. Let us look at the path you've carved."*
  - Public accessor: `static String peakJournalArrival() => _peakJournalArrival;`
- **Wire:** On Mountain Detail / Peak Journal when Hero Zoom transition completes (Elias appears from the side).

### 3.3 Return-after-idle new line (Whetstone overlay, 30s idle)

- **Status:** REFERENCE requests *"The stone stays blunt until the hand moves."*; currently only two lines in `_returnAfterIdle`.
- **Recommendation:** Add to `_returnAfterIdle` in `elias_dialogue.dart`:
  ```dart
  static const List<String> _returnAfterIdle = [
    "The fire's still here. Whenever you're ready.",
    'You returned. That is enough for now.',
    'The stone stays blunt until the hand moves.',
  ];
  ```
- **Wire:** Ensure Whetstone overlay uses `returnAfterIdle()` when user is idle ~30s so this line can appear.

### 3.4 Empty satchel → Map nudge

- **Status:** REFERENCE prefers *"An empty bag is a quiet path. Visit the map to find a stone worth carrying."* for when the fix is "go to Map"; not in current `_emptySatchel` pool.
- **Recommendation:** Add to `_emptySatchel`:
  ```dart
  'An empty bag is a quiet path. Visit the map to find a stone worth carrying.',
  ```
  So the pool has five variants and this one will rotate in when empty satchel is shown (including Whetstone overlay). If UX should *always* show this line when the CTA is "go to Map", use a dedicated accessor (e.g. `emptySatchelMapNudge()`) and wire that in the Whetstone empty-satchel path.

### 3.5 Edit Flow: REFERENCE Preferred vs code

- **REFERENCE Preferred:**  
  - Open modal: *"Let us look closer at this weight. Where shall we strike?"*  
  - Add pebble: *"A fine fragment. That is one less burden for the spirit."*  
  - Rename: *"A new name, a new path. It feels lighter already."*  
  - Delete: *"Let the dust return to the earth. We only carry what is useful."*

- **Code current:**  
  - Open: "What would you change?", "Refine the path.", "Speak the change."  
  - Add pebble: "Another stone on the path.", "Added. Break it down when you are ready.", "One more pebble."  
  - Rename: "Done. The path remembers.", "Renamed. As you will it.", "It is so."  
  - Delete: "Cleared. The path adjusts.", "It is gone. Move forward.", "Removed. The peak remains."

- **Recommendation:** Adopt REFERENCE preferred lines. They deepen the Hammer/weight metaphor and feel more ritual. Options:
  - **Option A:** Replace each pool with the single preferred line (fixed) so Edit flow always uses that line.
  - **Option B:** Add each preferred line as the first entry in the existing pool so it appears often but rotation remains.
  - **Option C:** Add a second pool or a "preferred" accessor for Edit flow and wire that in the Refine overlay; keep current pool for other edit contexts if any.

Suggested implementation: **Option B** — add REFERENCE preferred lines to the start of `_openEdit`, `_afterAddPebble`, `_afterRename`, `_afterDelete`. Then existing short lines remain as variety.

---

## 4. Optional new variants (high-traffic pools)

To deepen world/vibe and variety:

### 4.1 `_onTap`

- *The path waits. So do I.*  
- *Every return is a kind of burn.*  
- *You are here. That is the step that matters.*

### 4.2 `_afterBurn`

- *One less weight. The path remembers.*  
- *Ash to earth. The fire is fed.*

### 4.3 `_coldHearth`

- *The embers are whispering for more wood.* (keep)  
- *No stone on the fire yet. When you are ready.*  
- *The hearth is patient. Bring a stone when it serves you.*

---

## 5. Summary checklist

| Action | Where |
|--------|--------|
| Replace "task(s)" in _afterBurn, _afterPack, _markDoneToDrop | elias_dialogue.dart |
| Shorten sanctuaryHomeIntroPathAhead (optional) | elias_dialogue.dart |
| Shorten or split _climbLogicPrompt first line (optional) | elias_dialogue.dart |
| Soften _atMountainCap first line; prefer "Chronicle" | elias_dialogue.dart |
| Replace or remove colloquial _climbPeakPrompt line | elias_dialogue.dart |
| Add saveFailed() pool + accessor | elias_dialogue.dart |
| Add peakJournalArrival() fixed line + accessor | elias_dialogue.dart |
| Add "The stone stays blunt until the hand moves." to _returnAfterIdle | elias_dialogue.dart |
| Add empty-satchel Map nudge to _emptySatchel (or dedicated accessor) | elias_dialogue.dart |
| Add REFERENCE preferred Edit Flow lines to _openEdit, _afterAddPebble, _afterRename, _afterDelete | elias_dialogue.dart |
| Wire saveFailed(), peakJournalArrival() in UI | Screens/overlays |
| Optionally add 1–3 new variants to _onTap, _afterBurn, _coldHearth | elias_dialogue.dart |

---

**File:** `docs/ELIAS_DIALOGUE_AUDIT_RECOMMENDATIONS.md`  
**Sync:** After implementing, update [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md) so catalogue and code match.
