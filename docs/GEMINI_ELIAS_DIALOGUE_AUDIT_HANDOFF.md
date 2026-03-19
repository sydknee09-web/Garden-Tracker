# Elias Dialogue Audit — Handoff for Gemini

**Purpose:** Audit all of Elias's dialogue for consistency with the app's world/vibe and recommend concrete updates (rewrites, additions, removals).  
**Output:** Save to `docs/ELIAS_DIALOGUE_AUDIT_RECOMMENDATIONS.md`.

---

## App world & vibe

- **Voyager Sanctuary** is a contemplative goal app. Japandi / Studio Ghibli–esque. Cozy, ritual-over-task-list. The Sanctuary is a place you return to—not a tool you open.
- **Elias** is the guide: wise, calm, welcoming. He speaks like someone who has walked the path and welcomes you to the fire. **Guide, not coach or cheerleader.** Warm, not saccharine. Short sentences. Metaphor-rich. No guilt.

---

## Voice rules (from ELIAS_VOICE_GUIDE.md)

| Do | Don't |
|----|-------|
| Warm, grounded | Saccharine, corporate |
| Short, declarative sentences | Long run-ons |
| Metaphor over literal instruction | Guilt or shame |
| Second person (you, your) | Cheerleading ("You got this!") |
| Ritual, place, arrival | Productivity, tasks, checklist |

**Vocabulary — Use:** stones, peaks, fire, path, satchel, Hearth, Hammer, Pebbles, markers, waypoints, climb, summit, burn, weight, earth, light.  
**Vocabulary — Avoid:** tasks, goals, productivity, achieve, success, complete, checklist, reminder.

**Sentence style:** Short. Ellipses (...) for soft pauses. ~80 chars max for speech bubbles when possible. Questions when guiding.

---

## Source of truth

- **Code:** `lib/core/content/elias_dialogue.dart` — all pools and accessors.
- **Catalogue:** `docs/ELIAS_DIALOGUE_REFERENCE.md` — context map, full catalogue, some "Preferred" lines that differ from code.
- **Voice bible:** `docs/ELIAS_VOICE_GUIDE.md`.

---

## Known gaps (REFERENCE vs code)

- **saveFailed()** — Documented in REFERENCE for 404/timeout/generic save error: *"The mountain mist is thick right now—let's try that choice again."* Not yet in `elias_dialogue.dart`.
- **peakJournalArrival()** — Documented in REFERENCE and PEAK_JOURNAL_SPEC: *"Welcome to the base of this peak. Let us look at the path you've carved."* Not yet in `elias_dialogue.dart`.
- **returnAfterIdle** — REFERENCE suggests adding: *"The stone stays blunt until the hand moves."* Code has two lines; that line is not in the current `_returnAfterIdle` pool.
- **Edit Flow** — REFERENCE lists "Preferred Lines" that differ from code (e.g. "Let us look closer at this weight. Where shall we strike?" for open modal; "A fine fragment. That is one less burden for the spirit." for add pebble). Code has different variants.
- **Empty satchel nudge to Map** — REFERENCE prefers: *"An empty bag is a quiet path. Visit the map to find a stone worth carrying."* Not in current `_emptySatchel` pool.

---

## Request for Gemini

1. **Audit** every dialogue pool in `elias_dialogue.dart` (and the REFERENCE doc) for:
   - **World/vibe fit** — Does it feel Japandi, cozy, ritual, guide-not-coach?
   - **Vocabulary** — Any "avoid" words (tasks, goals, productivity, achieve, success, complete, checklist, reminder)? Any missed opportunities for preferred vocabulary?
   - **Tone drift** — Saccharine, corporate, cheerleading, or guilt?
   - **Length** — Lines over ~80 chars that could be shortened for speech bubbles?
   - **Consistency** — Same context (e.g. after burn, on tap) consistent in register and metaphor?

2. **Recommendations** — For each pool or line that needs change:
   - Quote the current line (or pool name).
   - Give a concrete **recommended rewrite** or **add/remove**.
   - One-line reason (e.g. "Avoid 'task'; use 'stone'." or "Shorten for bubble.").

3. **Missing pieces** — Add recommendations for:
   - Implementing `saveFailed()` and `peakJournalArrival()` in Dart with the REFERENCE lines (or improved variants).
   - Adding "The stone stays blunt until the hand moves." to `_returnAfterIdle`.
   - Adding the preferred empty-satchel Map nudge to `_emptySatchel`.
   - Aligning Edit Flow with REFERENCE "Preferred Lines" or justifying keeping current code lines.

4. **Optional:** Suggest 1–3 new rotating variants for high-traffic pools (e.g. `_onTap`, `_afterBurn`, `_coldHearth`) that deepen the world/vibe.

Output format: one markdown document with sections **Audit by context** (or by pool), **Recommended rewrites** (table or list with current → recommended), **Missing pieces** (implementation notes), **Optional new variants**. Save to `docs/ELIAS_DIALOGUE_AUDIT_RECOMMENDATIONS.md`.
