# Voyager Sanctuary — Features Expansion Doc

**Purpose:** A single, legible document of features we are *not* implementing in Phase 1. Each entry explains what the feature is, why it was deferred, and enough technical detail so Cursor can implement it later without losing context.

**Audience:** Product owner (readable, no jargon) and Cursor (implementation-ready when the time comes).

**Philosophy:** *"Refined Architectural Luxury"* — we choose clarity and structural integrity over feature bloat. Phase 1 builds the backbone: intent-driven creation, schema integrity, and the 6-step wizard. Visual flourishes and extra behaviors come after the foundation is solid.

**Related:** [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md) (Phase 1 spec), [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) (decisions log).

---

## How to Use This Doc

- **For you (product owner):** Skim the feature names and "Why we deferred" — you'll see what's coming later and why we held back.
- **For Cursor:** When implementing a feature, read the full entry. Use the "Technical notes" and "Source" to find the original spec and acceptance criteria.
- **Phase labels:** Phase 2 = next wave after Phase 1. Phase 3 = elite polish. "Future" = no phase assigned yet.

---

## Phase 1: What We *Are* Doing (Brief)

Phase 1 is **"The Backbone."** We are prioritizing:

1. **Intent-driven creation** — 6-step wizard: Intent → Identity → Appearance → Logic → Markers → Placing stones
2. **Schema updates** — `intent_statement`, `layout_type`, `pebble_logic` in the database
3. **New Journey from Elias** — Tap Elias → "New Journey" as the first option
4. **Dynamic markers** — 1–10 markers per peak (no more fixed 4)
5. **Bones view** — Tap peak title → see Intent, hierarchy, Rename/Archive/Delete
6. **Loop bug fix** — Adding a pebble no longer resets you to the first marker

Both Climb and Survey use the **same tree layout** in Phase 1. The difference is terminology only (Milestones vs Regions). The visual "Islands" layout for Survey comes in Phase 2.

**Phase 1 Creation Flow (Visual Logic):**

```
Intent → Identity → Logic → Markers → Placing stones
   │         │         │         │         │
   ▼         ▼         ▼         ▼         ▼
"Why?"   "Name"   Climb or   Milestone   Place
  (cap    the     Survey     or Region   pebbles
 1000)   peak     (term      (1–10)     per area
 chars)          only)
```

Each step is a gate. No pebble is placed until the journey is purposeful.

---

## Features Not in Phase 1

---

### 1. Survey "Islands" Layout (Phase 2)

**What it is:**  
For Survey-type peaks (collection of areas, not a step-by-step climb), the Map would show markers as **islands or constellation points** — spread out, no connecting lines. A sanctuary map, not a ladder.

**Why we deferred:**  
Data integrity comes first. Phase 1 ships the logic (`layout_type` in DB, Step 3 choice) and uses the same tree for both. The Islands layout requires a new visual engine. We build the backbone before the view.

**Technical notes for Cursor:**
- Store `layout_type` in DB now (Phase 1). When `layout_type == 'survey'`, Phase 2 renders a different layout.
- Source: [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md) §5b, [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §9.
- Phase 1: Show tree for both. Phase 2: Add Island/Constellation widget for Survey peaks.

---

### 2. Promote to Marker (Same Peak) — Phase 2

**What it is:**  
Turn a pebble into a **sibling landmark** under the same peak. Example: "Buy Roses" (pebble under Backyard) becomes its own Region next to Backyard, without creating a new peak.

**Why we deferred:**  
Phase 1 keeps "Promote to Peak" only. Same-peak promote adds UI complexity (picker, reorder). We ship the simpler path first.

**Technical notes for Cursor:**
- Phase 1: Promote = pebble → new Peak only.
- Phase 2: Add "Promote to Region/Milestone" — pebble becomes new marker, same peak. Requires: create boulder, move pebble's children, delete old pebble.
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §14b.

---

### 3. Demote Landmark to Pebble — Phase 2

**What it is:**  
Turn a landmark (region/milestone) into a pebble under another landmark. Example: "Backyard" becomes a single pebble under "Outdoor Work."

**Why we deferred:**  
Complex UI: user must pick a target landmark, move pebbles, convert structure. Not required for MVP. User can delete and recreate if needed.

**Technical notes for Cursor:**
- Phase 2: Add "Demote to Pebble" or "Merge into…" — pick target landmark; this marker's pebbles move there; this marker becomes a pebble (or is deleted).
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §14c.

---

### 4. Pebble Logic Toggle (Per Marker) — Phase 2

**What it is:**  
Each region/milestone can have its own rule: pebbles are **sequential** (step-by-step) or **freeform** (any order). Example: Survey goal, but "Backyard" has step-by-step pebbles.

**Why we deferred:**  
We store `pebble_logic` in the DB in Phase 1 (default `freeform`). The UI toggle would add complexity to Bones or the Edit overlay. We ship the schema first; UI later.

**Technical notes for Cursor:**
- DB: `nodes.pebble_logic` — `sequential` | `freeform`, default `freeform`. Migration in Phase 1.
- Phase 2: Add toggle in Bones or Edit overlay: "This region's pebbles: Sequential / Any order."
- **Logic & Leaf:** Same. Also logic on pebbles for their shards. Sub-boulders achieve mixed logic. Validity Filter in pack.
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §14d, [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md) §2, [MASTER_PLAN.md](MASTER_PLAN.md) § Logic & Leaf Protocol.

---

### 5. Interactive Hierarchy in Bones View — Not Planned

**What it is:**  
Editing markers and pebbles *inside* the Bones view — rename, reorder, add pebble from there.

**Why we deferred:**  
Bones is a high-level "Command & Control" center. Editing individual nodes stays on the Map (Edit overlay, inline tap-to-edit). Keeping Bones read-only for the hierarchy avoids scope creep and keeps the screen focused.

**Technical notes for Cursor:**
- Bones middle section = **non-interactive** tree. Visual overview only.
- Map = where you edit markers/pebbles (Edit overlay, inline).
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §14a.

---

### 6. Archive at Marker Level — Not Planned

**What it is:**  
A soft "archive this region" that hides it in a collapsed section, recoverable later — separate from delete.

**Why we deferred:**  
"Move to General" already serves as a soft hide (pebbles go to Miscellaneous). "Scatter" is the hard delete. Adding a third option (archive) would complicate the mental model. Delete is enough for now.

**Technical notes for Cursor:**
- Move to General = soft. Scatter = hard delete. No separate marker-level archive.
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §14e.

---

### 7. Streaks (Whetstone + Burn) with Grace Day — Phase 2

**What it is:**  
Track consecutive days: Whetstone habits completed, pebbles burned. Show "7-day streak" on Whetstone; after a burn, Elias might say "Three days in a row you've fed the fire." **Grace Day:** One missed day freezes (or -2) instead of resetting to 0; two consecutive misses = reset. Uses a 4:00 AM "day" boundary so late-night sessions don't break the streak.

**Why we deferred:**  
Phase 1 is about creation flow and schema. Streaks are motivation polish. We build the backbone first.

**Technical notes for Cursor:**
- Persist: `current_streak`, `last_activity_date`, `grace_used` (or derive from last two dates).
- 4:00 AM boundary: normalize timestamps by subtracting 4 hours before computing "day."
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §1.1, [Completed/PHASE_2_IMPLEMENTATION_PLAN.md](Completed/PHASE_2_IMPLEMENTATION_PLAN.md) §2.

---

### 8. Burn Celebration (Sound, Haptic, Elias) + Mountain Summit — Phase 2

**What it is:**  
When you drop a pebble on the Hearth: short sound (ember crackle), haptic, Elias line. When it's the **last pebble of a mountain**: one-time "Mountain summited" moment — Elias ("The peak is yours."), optional ember burst over the Hearth, optional badge on the Map.

**Why we deferred:**  
Phase 1 focuses on creation and structure. Celebration polish comes after the flows are solid.

**Technical notes for Cursor:**
- Hearth `onAcceptWithDetails`: after burn, trigger sound, haptic, Elias from `afterBurn()` pool.
- Last pebble of mountain: detect via node list; show summit Elias + OverlayEntry ember burst (gold, upward, fade). No heavy particle engine.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §1.3, [Completed/PHASE_2_IMPLEMENTATION_PLAN.md](Completed/PHASE_2_IMPLEMENTATION_PLAN.md) §1.

---

### 9. Elias Context-Aware + First-Run Lines — Phase 2

**What it is:**  
Elias reflects state: "Your satchel is full. Burn a stone before you add more." / "You've got three peaks. Finish one before you start another." First Pack, first Burn, first habit: one short line explaining the next step. Return after idle: "The fire's still here. Whenever you're ready." (No guilt.)

**Why we deferred:**  
Phase 1 gets Elias to open the Management sheet and "New Journey." Context-aware and first-run lines are polish.

**Technical notes for Cursor:**
- Add pools: `satchelFull`, `atMountainCap`, `firstPack`, `firstBurn`, `returnAfterIdle`.
- Track "last seen" per context to avoid repetition within ~2 seconds.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §1.4, §4, [Completed/PHASE_2_IMPLEMENTATION_PLAN.md](Completed/PHASE_2_IMPLEMENTATION_PLAN.md) §3.

---

### 10. Whetstone Choice Overlay (Bubble Tail + Watercolor Blur) — Phase 2

**What it is:**  
When you tap the Whetstone from the Satchel, Elias appears with a speech bubble. **Single choice:** Sharpen Habits. Refine/Edit is on the Map (Peak Detail). The bubble has a **tail** that points at the Whetstone icon (so it's clear what you tapped). The dimming layer uses a **watercolor-style blur** (BackdropFilter), not flat grey.

**Why we deferred:**  
Phase 1 does not change the Satchel/Whetstone entry flow. This is visual polish for the choice overlay.

**Technical notes for Cursor:**
- Bubble tail: use GlobalKey on Whetstone icon; RenderBox `localToGlobal` to get icon center; anchor tail tip to that position. Use `addPostFrameCallback` so layout is stable.
- Blur: `ImageFilter.blur(sigmaX: 5.0, sigmaY: 5.0)` or similar on the barrier.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §3.5, [Completed/PHASE_2_IMPLEMENTATION_PLAN.md](Completed/PHASE_2_IMPLEMENTATION_PLAN.md) §5, [VOYAGER_SANCTUARY_POLISH_PLAN.md](Completed/VOYAGER_SANCTUARY_POLISH_PLAN.md).

---

### 11. Climb Step 3 Keyboard Retention — Phase 2

**What it is:**  
When adding pebbles in the creation wizard, tapping "Add" or "Add another" should **not** dismiss the keyboard. Focus stays in the text field so you can type the next pebble name immediately — flow-state entry for 5–10 pebbles in a row.

**Why we deferred:**  
Phase 1 rebuilds the wizard (6 steps, dynamic markers). We'll fix the loop bug and structure first. Keyboard retention is a UX polish for the new Step 5 (Placing stones).

**Technical notes for Cursor:**
- On "Add" / "Place Pebble": create pebble, clear field, but **do not** call `unfocus()`. Keep FocusNode so keyboard stays up.
- If inline list: "Add another" appends row and moves focus to the new field.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §2.3, [Completed/PHASE_2_IMPLEMENTATION_PLAN.md](Completed/PHASE_2_IMPLEMENTATION_PLAN.md) §4.

---

### 12. Campfire Sparks (Atmospheric Reward) — Phase 3

**What it is:**  
Higher burn streak = more sparks (or sparks that rise higher) from the Hearth. No progress bar — purely atmospheric. Uses an **EaseOut curve** so the effect rises meaningfully at low streaks (1→3 days) and tapers at high streaks (no firestorm at 30 days).

**Why we deferred:**  
Requires Phase 2 streak provider. Phase 3 is elite polish.

**Technical notes for Cursor:**
- `emissionRate = baseRate + (maxRate - baseRate) * Curves.easeOut.transform(streak / 14)`.
- Lightweight CustomPainter; no heavy particle package. Gold pixels, upward drift, fade.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §1.2, [Completed/PHASE_3_IMPLEMENTATION_PLAN.md](Completed/PHASE_3_IMPLEMENTATION_PLAN.md) §1.

---

### 13. Mountain Momentum / "Tending the Slope" — Phase 3

**What it is:**  
On the Map, each peak shows "X pebbles burned this week" or "Last burn: 2 days ago." When a peak hasn't been touched in 7+ days, Elias says: "The weeds are tall on that northern peak, but the earth is still good." Encourages return without guilt.

**Why we deferred:**  
Requires burn/completion data per mountain. Phase 3 polish.

**Technical notes for Cursor:**
- Compute from node deletions or completion timestamps. Display as subtitle on mountain card.
- Elias pool: `tendingSlopeUntouched()`. Trigger when mountain focused or Scroll viewed; once per session.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §1.1, [Completed/PHASE_3_IMPLEMENTATION_PLAN.md](Completed/PHASE_3_IMPLEMENTATION_PLAN.md) §2.

---

### 14. Landmark Templates (Climb Step 2/4) — Phase 3

**What it is:**  
Optional "Use template" button that prefills marker names, e.g. "Research → Plan → Execute → Review" or "Discover → Design → Do → Review." User can edit or clear. Speeds up the "what are my phases?" moment.

**Why we deferred:**  
Phase 1 makes markers dynamic (1–10). Templates would need to adapt. We ship the structure first; templates are a convenience layer.

**Technical notes for Cursor:**
- In Step 4 (Markers): add "Use template" button; on tap, set text fields to template values. Store 1–2 templates locally. No backend.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §2.3, [Completed/PHASE_3_IMPLEMENTATION_PLAN.md](Completed/PHASE_3_IMPLEMENTATION_PLAN.md) §3.1.

---

### 15. Habit Streak Milestones (7 / 30 / 100 days) — Phase 3

**What it is:**  
When Whetstone streak hits 7, 30, or 100 days, show a one-time Elias line or toast: "Seven days. The stone is sharp." No modal; brief. Track "last milestone shown" so we don't repeat.

**Why we deferred:**  
Requires Phase 2 Whetstone streak. Phase 3 polish.

**Technical notes for Cursor:**
- When streak is 7, 30, or 100 and that milestone not yet shown: show Elias/SnackBar once; set flag in SharedPreferences or profile.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §1.3, [Completed/PHASE_3_IMPLEMENTATION_PLAN.md](Completed/PHASE_3_IMPLEMENTATION_PLAN.md) §3.2.

---

### 16. Micro-Interactions: Breathable UI, Haptic Weight, Night-Shift — Phase 3

**What it is:**  
- **Breathable UI:** Serif headers animate letter-spacing (0.0 → 1.5) over 800ms on screen entry. "Take a breath."
- **Haptic weight:** Pebble burn = light tap. Last pebble of landmark = medium double-tap. Last pebble of mountain = heavy long pulse.
- **Night-shift:** In Night period (8pm–5am), Whetstone choice overlay and Refine parchment get a warm amber "candlelight" tint. Reduces blue-light strain.

**Why we deferred:**  
Elite polish. Phase 3, after core flows and streaks are solid.

**Technical notes for Cursor:**
- Letter-spacing: TweenAnimationBuilder, 800ms, Curves.easeOutCubic. Apply to Scroll/Climb headers only.
- Haptics: pass node + hierarchy to burn handler; choose light/medium/heavy by scope.
- Night: read TimeOfDayProvider; when Night, apply ColorFiltered with amber soft blend to overlays.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §3.6, [Completed/PHASE_3_IMPLEMENTATION_PLAN.md](Completed/PHASE_3_IMPLEMENTATION_PLAN.md) §4.

---

### 17. Offline Banner — Future (When Offline Support Exists)

**What it is:**  
When the app is offline, show a persistent banner: "Offline — changes will sync when you're back." Disable or queue writes.

**Why we deferred:**  
MVP is online-only. No connectivity provider in scope. Defer until offline support is added.

**Technical notes for Cursor:**
- If offline/connectivity provider exists: watch it; show Banner or SnackBar when offline.
- Source: [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) §3.2, [Completed/PHASE_3_IMPLEMENTATION_PLAN.md](Completed/PHASE_3_IMPLEMENTATION_PLAN.md) §5.

---

### 18. "Open Map" Direct from Sanctuary — Not in Phase 1 Checklist

**What it is:**  
A direct "Open Map" button or icon from the Sanctuary screen (e.g. near Elias or in the tray), so users don't have to go through Satchel to reach the Map.

**Why we deferred:**  
Master Ledger mentions it as a target, but it's not on the Phase 1 technical checklist. We're prioritizing "New Journey" from Elias. Can add when polishing navigation.

**Technical notes for Cursor:**
- Add small icon or button on Sanctuary; navigates to `/scroll`. See [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md) §5.

---

### 19. Elias Tap: Dialogue + Sheet (Both at Once) — Low Priority

**What it is:**  
When you tap Elias, the app does two things: (1) shows a random Elias line in the dialogue bubble, and (2) opens the Management sheet. So you see both at once.

**Why we deferred:**  
Low priority. Options: (A) Keep both — Elias speaks while the menu appears. (B) Don't set the message when opening the sheet. (C) Set the message when the sheet *closes* — Elias responds to their choice. Test and adjust.

**Technical notes for Cursor:**
- Current: `eliasMessageProvider` set + Management sheet shown. If it feels cluttered, try (B).
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §8.

---

### 20. Place Pebble Accessibility Label — Low Priority

**What it is:**  
Add a semantic label for screen readers: `Semantics(label: 'Add pebble to [marker name]')` so "Place Pebble" is clear to users who don't infer the metaphor.

**Why we deferred:**  
Good practice but low priority. Implementation task when polishing accessibility.

**Technical notes for Cursor:**
- Wrap "Place Pebble" button with Semantics. Visible label stays "Place Pebble"; screen reader gets the descriptive label.
- Source: [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) §13.

---

### 21. Satchel (Untitled) Pebbles — Future Satchel Polish

**What it is:**  
When a pebble has no name, Satchel shows "(untitled)" or "(Unnamed task)." Optionally prompt for a name when packing.

**Why we deferred:**  
BUGS_DEFERRED notes this. Revisit when polishing Satchel.

**Technical notes for Cursor:**
- Display: show "(Unnamed task)" or "(untitled)" when `title` is empty.
- Source: [BUGS_DEFERRED_TO_PHASE.md](BUGS_DEFERRED_TO_PHASE.md), [MASTER_PLAN.md](MASTER_PLAN.md) Part G §4.

---

### 22. Deep Link for Password Reset — Optional

**What it is:**  
Password reset link opens the app (via `voyagersanctuary://`) instead of the browser, so the user can complete the flow in-app.

**Why we deferred:**  
Requires `app_links` (or equivalent) and `recoverSession`. Optional for release.

**Technical notes for Cursor:**
- Add `app_links`; handle `voyagersanctuary://`; call `SupabaseService.client.auth.recoverSession(url)`.
- Source: [MASTER_PLAN.md](MASTER_PLAN.md) Part G §2.

---

### 23. Cross-Client Cache Invalidation — Future

**What it is:**  
When data changes on another device (e.g. web), the cache on this device is cleared so the user sees fresh data.

**Why we deferred:**  
For a solo-user app, eventual consistency is acceptable. Defer until multi-device support is a requirement.

**Technical notes for Cursor:**
- Would need Supabase Realtime or similar to invalidate cache when remote changes occur.
- Source: [MASTER_PLAN.md](MASTER_PLAN.md) Part G §6.

---

### 24. Polish Plan — Sanctuary Visual, Scroll Unfurl, etc.

**What it is:**  
Time-of-day color fade (4 stacked images), fire position, Elias size, Scroll typography, Scroll unfurl (scroll-top/body/bottom assets), mallet cursor/shadow, Elias idle (breathing/blink), parallax/particles.

**Why we deferred:**  
Phase 1 is about creation flow and schema. Visual polish is in [VOYAGER_SANCTUARY_POLISH_PLAN.md](Completed/VOYAGER_SANCTUARY_POLISH_PLAN.md) and [MASTER_PLAN.md](MASTER_PLAN.md) Part G — implement when time allows.

**Technical notes for Cursor:**
- See [VOYAGER_SANCTUARY_POLISH_PLAN.md](Completed/VOYAGER_SANCTUARY_POLISH_PLAN.md) — Phase 1 (Sanctuary visual), Phase 2 (Scroll typography), Phase 5 (Scroll unfurl), Phase 6 (assets).

---

## Summary Table

| # | Feature | Phase | Reason |
|:--|:--------|:------|:-------|
| 1 | Survey Islands layout | 2 | Data integrity first; new layout engine |
| 2 | Promote to Marker (same peak) | 2 | UI complexity; ship Promote to Peak only |
| 3 | Demote landmark to pebble | 2 | Complex UI; not required for MVP |
| 4 | Pebble logic toggle UI | 2 | Store in DB; UI later |
| 5 | Interactive hierarchy in Bones | — | Bones = read-only; edit on Map |
| 6 | Archive at marker level | — | Move to General = soft; Scatter = delete |
| 7 | Streaks + Grace Day | 2 | Creation flow first |
| 8 | Burn celebration + summit | 2 | Polish after flows |
| 9 | Elias context-aware | 2 | Polish after flows |
| 10 | Whetstone bubble tail + blur | 2 | Visual polish |
| 11 | Keyboard retention (Step 5) | 2 | UX polish for new wizard |
| 12 | Campfire sparks | 3 | Elite polish |
| 13–16 | Mountain momentum, templates, milestones, micro-interactions | 3 | Elite polish |
| 17 | Offline banner | Future | No offline support yet |
| 18 | Open Map from Sanctuary | — | Not on Phase 1 checklist |
| 19 | Elias tap (dialogue + sheet) | Low | Test and adjust |
| 20 | Place Pebble accessibility | Low | Good practice |
| 21–24 | Satchel untitled, deep link, cache, Polish Plan | Future/Optional | When time allows |

---

**End of Features Expansion Doc.**
