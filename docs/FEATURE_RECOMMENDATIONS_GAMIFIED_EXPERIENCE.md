# Voyager Sanctuary — Feature Recommendations: Complete, Gamified, Polished Experience

**Role:** Dev & PM recommendations  
**Audience:** Product owner  
**Purpose:** A single doc of features and updates to make goal input, task breakdown, and completion feel **enjoyable**, **smooth**, and **optimal** — without feeling buggy or bumpy.  
**Context:** You already have the general framework (Mountains → Boulders → Pebbles → Shard, Satchel, Hearth, Whetstone, Elias, Climb/Edit specs). This doc extends that with gamification, UX polish, and process design.

**For Cursor / implementation:** This doc is written to be **instructional and implementation-ready**. Where applicable, sections include **Implementation notes**, **Acceptance criteria**, file/widget references, and explicit behavior (e.g. “keyboard must not dismiss,” “bubble tail points at X”). Use it as the single source of truth when implementing these features; follow the specified behavior and priorities.

---

## How to Use This Doc

- **Prioritize by phase:** Recommendations are grouped by theme; each section ends with a **Priority** (P0/P1/P2).
- **Cross-reference:** Items that depend on [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md), [VOYAGER_SANCTUARY_POLISH_PLAN.md](Completed/VOYAGER_SANCTUARY_POLISH_PLAN.md), or [MASTER_PLAN.md](MASTER_PLAN.md) are called out.
- **No scope creep:** Everything here fits the existing schema (mountains, nodes, whetstone, satchel). No new tables required unless explicitly noted.
- **Implementation notes:** Look for **Implementation** and **Acceptance criteria** sub-sections for Cursor-facing detail.

---
a
## Construction Audit for Cursor

When implementing this doc, get these **three construction details** right on the first pass. They are what prevent the app from feeling “bumpy” and keep the vision intact:

| Priority | What to verify | Why it matters | Where in doc |
|----------|----------------|----------------|--------------|
| **Midnight logic** | Streak “day” uses a 24h window from last activity **or** a user-defined end-of-day (e.g. 4:00 AM). Streak is **not** recalculated or reset while the user is in an active session across midnight. | Prevents the streak from resetting while the user is still in flow at 1:00 AM (e.g. late CPA prep). | §1.1 Grace Day — “Construction nuance — midnight transition” |
| **EaseOut curve (sparks)** | Campfire `emissionRate` (and/or height) is driven by **Curves.easeOut** (or similar) of streak count — e.g. `Curves.easeOut.transform(streak / 14)`. | Embers feel rewarding **immediately** (1→3 days) without becoming a visual mess after a two-week streak. | §1.2 Campfire/sparks — “Construction nuance (intensity curve)” |
| **GlobalKey bubble tail** | Whetstone choice overlay: speech bubble tail tip is anchored to the **computed center** of the Whetstone icon via **GlobalKey** + **RenderBox** (`localToGlobal` / position), not a static offset. | The UI feels **physically connected** to the user’s touch on every screen size (phone + tablet). | §3.5 — “Implementation nuance (responsive layout)” |

**Handoff rule:** Before marking any of these areas “done,” confirm the behavior in this table matches the implementation.

---

## 1. Gamification & Motivation

### 1.1 Streaks & continuity

- **Whetstone streaks:** Track consecutive days with at least one habit completed. Display on Whetstone screen (e.g. “7-day streak”) and optionally in Sanctuary (Elias line: “You’ve tended the stone seven days running.”).
- **Burn streaks:** Consecutive days with at least one pebble burned in the Hearth. Show in a small badge or Elias line after a burn (“Three days in a row you’ve fed the fire.”).
- **Mountain momentum (“Tending the Slope”):** For each mountain, show “X pebbles burned this week” or “Last burn: 2 days ago.” Surfaces progress without adding a full XP system. **P2 flavor:** Frame this in Vista/peak terms. If a mountain hasn’t been touched in a week, Elias might say: “The weeds are tall on that northern peak, but the earth is still good.” Fits the “tending the slope” aesthetic and encourages return without guilt.

**Grace Day mechanic (recommended for both Whetstone and burn streaks):**  
The app targets high-stress professionals (e.g. CPA-track users). A **hard reset to 0** on a missed day often triggers a “I failed, so I’ll stop using the app” spiral. Use a **Grace Day** mechanic instead of a strict reset:

- **Option A — Freeze:** One missed day **freezes** the streak (displayed value does not increase, but does not reset). The next day the user completes at least one habit/burn, the streak **resumes** from the frozen value. A second consecutive miss **then** resets to 0.
- **Option B — Drop by 2:** One missed day **reduces** the streak by 2 (minimum 0) instead of resetting to 0. So a 10-day streak becomes 8; user can “recover” by continuing. Two consecutive misses = reset to 0.

**Implementation:**

- Persist per user: `current_streak`, `last_activity_date`, and either `grace_used` (bool, for Option A) or derive from last two activity dates for Option B.
- On date boundary (e.g. midnight or first app open of new day): if `last_activity_date` is yesterday or earlier, apply Grace Day logic (freeze or -2); if two consecutive days missed, set `current_streak = 0`.
- **Construction nuance — midnight transition:** In high-stress use (e.g. Vista, late CPA prep), the user may still be “in session” past midnight. Avoid resetting the streak **while they’re actively using the app**. Either: (a) treat “streak day” as a **24-hour window from last activity** (e.g. activity at 1:00 AM counts for “yesterday” until 24h has passed), or (b) support a **user-defined “End of Day”** (e.g. 4:00 AM) so “today” doesn’t flip at local midnight. The logic that applies Grace Day / reset should use this same day boundary so the streak doesn’t drop mid-session.
- **Acceptance criteria:** (1) One missed day does not reset streak to 0 under Grace Day. (2) Two consecutive missed days reset streak to 0. (3) User can see current streak on Whetstone screen (and optionally after a burn in Sanctuary). (4) Streak is not recalculated or reset while the user is in an active session across midnight (per 24h window or configurable end-of-day).

**Why:** Grace Day reduces abandonment and keeps the app supportive under busy or chaotic periods.

**Priority:** P1 (high impact, moderate effort).

---

### 1.2 Light reward framing (no currency)

- **Elias lines as reward:** After burn, pack, or habit completion, rotate **progress-aware** lines (e.g. “That’s the third stone today.” / “The path is clearing.”). Already partially in place; extend pools and add simple counters (e.g. burns today, pebbles left on mountain).
- **Visual milestones:** When a mountain reaches 25%, 50%, 75%, 100% (pebble completion), show a one-time Elias line or a subtle badge (“Halfway up the peak.”). No popup spam — one line or small toast.
- **Campfire / environment reward (P2):** Instead of (or in addition to) a progress bar, tie the **visual reward** to the Hearth and the surrounding scene. Recommended approach:
  - **Sparks and embers:** Higher burn streak (or “burns this week”) drives **ember intensity**: more particles, or particles that rise higher / travel farther from the fire. The fire itself can stay the same size; the **sparks** become the feedback. This shows momentum without a numeric progress bar and fits the “Vista” / sanctuary sensibility (the environment responds subtly to the user’s consistency).
  - **Optional:** Very subtle growth or “aliveness” in the background (e.g. a few more visible ember particles in the scene, or a barely perceptible glow) as streak or recent activity increases. No UI numbers; purely atmospheric.

**Implementation:**

- **Where:** `HearthWidget` (or the widget that renders the campfire/hearth in [lib/features/sanctuary/sanctuary_screen.dart](lib/features/sanctuary/sanctuary_screen.dart)). Read burn streak or “burns this week” from provider (e.g. `burnStreakProvider` or derived from completions).
- **Behavior:** Parameterize particle count, max height, or emission rate by streak (e.g. `min(7, streak)` or `burnsThisWeek.clamp(0, 10)`). Use the same ember/spark asset or shader; only scale the **intensity** so it stays on-theme (warm, refined) and never cartoonish.
- **Implementation nuance (low-cost):** If the campfire already uses a particle system, **adjust existing parameters** rather than adding new assets: e.g. reduce gravity (so particles float higher) or increase `emissionRate` as streak/burns increase. This delivers the “atmospheric reward” with minimal code and no new art.
- **Construction nuance (intensity curve):** Tie `emissionRate` (and/or gravity/height) to a **Curves.easeOut** (or similar) function of the streak count. The reward should feel **meaningful early** (e.g. going from 1 to 3 days) without becoming a blinding firestorm at 30 days. Example: `emissionRate = baseRate + (maxRate - baseRate) * Curves.easeOut.transform(streak / 14)` so intensity tapers after roughly two weeks. Tune the divisor and curve to taste.
- **Acceptance criteria:** (1) Higher streak or recent burns = visibly more or higher-rising sparks. (2) No new progress bar or numeric display for this reward. (3) Effect is subtle enough to feel like atmosphere, not a “level up” popup. (4) Spark intensity rises meaningfully at low streaks and tapers at high streaks (no visual overload).

**Why:** Users feel recognized without turning the app into a points shop. Sparks-as-reward stays aligned with “refined, quiet progress” and connects the reward to the physical scene.

**Priority:** P1 (Elias + milestones); P2 (campfire/sparks visual).

---

### 1.3 Celebrations on completion

- **Hearth burn:** Already have animation; add: (1) short, satisfying sound (e.g. ember crackle or soft “stone settled”); (2) haptic (already planned in Phase 12); (3) Elias line from pool (already in place). Ensure the sequence feels like a **moment** (animation completes before navigating or dismissing).
- **Mountain completed:** When the last pebble of a mountain is burned, trigger a **one-time celebration**: e.g. Elias line (“The peak is yours.”), optional confetti or particle burst (thematic: ember sparks, not cartoon confetti), and optional “Mountain summited” note in Scroll (badge or subtitle) so the user can look back.
- **Habit streak milestone:** At 7, 30, 100 days, one Elias line or toast (“Seven days. The stone is sharp.”). No modal; keep it brief.

**Why:** Completion should feel like an event, not a silent DB update. Reinforces the loop: input → do → complete → feel good → return.

**Priority:** P0 (burn feel); P1 (mountain completion, habit milestones).

---

### 1.4 Elias as coach, not decor

- **Context-aware lines:** Use existing `EliasDialogue` (and Climb/Edit pools) so Elias reflects **state**: e.g. “Your satchel is full. Burn a stone before you add more.” / “You’ve got three peaks. Finish one before you start another.” (when at cap). Reduces confusion and adds personality.
- **Encouragement, not guilt:** After a long idle period (e.g. no burn in 3+ days), first return: “The fire’s still here. Whenever you’re ready.” Avoid “You haven’t…” phrasing.
- **First-time nudges:** On first-ever Pack, first-ever Burn, first habit check: one short Elias line that explains the next step (“Drag a stone to the fire when it’s done.”). Dismissible; don’t repeat every time.

**Why:** Elias is the main narrative voice. Using him for guidance and encouragement makes the app feel cohesive and supportive.

**Priority:** P1.

---

## 2. Goal & Task Input — Enjoyable and Optimal

### 2.1 Complete the Climb flow (add goal)

- Implement [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md) end-to-end: **Climb New Mountain** → name peak → name four landmarks → break each landmark into pebbles with hammer + naming. Compass always visible; partial progress saved.
- **Suggested UX tweaks:** (1) One landmark at a time (“Landmark 1 of 4”) can feel less overwhelming on mobile than four fields at once. (2) Rock-break sound on pebble add (spec’d) — keep it. (3) After Step 3, one Elias line: “Your path is set. Open the Scroll to see it, or pack your satchel and begin.”

**Why:** Add-goal is the entry point for meaningful goals. A guided, narrative flow (Elias + steps) is more enjoyable and more likely to produce a well-structured mountain than a single “name this mountain” dialog.

**Priority:** P0 (already specified; implement as-is, then iterate).

---

### 2.2 Guided Edit flow (refine existing goal)

- Implement **Phase 4** of [VOYAGER_SANCTUARY_POLISH_PLAN.md](Completed/VOYAGER_SANCTUARY_POLISH_PLAN.md): Refine mode from Satchel (Whetstone choice) → tap node on Scroll → Edit overlay with Elias. Actions: Rename, Add pebble, Delete (with narrative copy). Refine mode stays on until user puts the whetstone away or leaves Scroll.
- **Consistency:** Same overlay pattern as Climb (dimmed background, Compass, Elias + dialogue). Reuse `mountainActionsProvider` / `nodeActionsProvider` and add edit-specific dialogue pools.

**Why:** Users will need to adjust peaks/landmarks/pebbles. A dedicated, narrative Edit flow avoids “bumpy” context menus and makes refinement a clear, intentional process.

**Priority:** P0 (after Climb).

---

### 2.3 Smart defaults and suggestions

- **Peak name:** Placeholder or examples in Climb Step 1: “e.g. CPA Exam, Home Renovation” (already in spec). Optional: suggest from recent archive names (“Re-climb ‘Fitness 2025’?”) when creating a new mountain.
- **Landmarks:** Optional “template” hints per mountain type (e.g. “Research → Plan → Execute → Review”) that user can replace. Not forced; just speeds up the “what are my four phases?” moment.
- **Pebble naming (Climb Step 3):** Placeholder “e.g. Research vendors, Draft outline.” An **“Add another”** (or equivalent) action must keep rapid entry smooth.

**Critical UX — keyboard and focus (Pebble naming):**  
When the user adds a pebble and then taps **“Add”** (or “Add another”) to create the next pebble, the **keyboard must NOT dismiss** and **focus must remain in the pebble naming text field**. The user should be able to type a name → Add → type next name → Add → … for 5–10 pebbles in a single flow-state. If the keyboard drops and re-appears on every “Add,” the flow feels **bumpy** and discourages batch entry.

**Implementation:**

- **Where:** Climb flow Step 3 overlay (e.g. `_ClimbStepPebbles` or equivalent in the Climb flow widget). See [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md) §4 Step 3.
- **Behavior:** (1) On “Add” / “Add another”: create the pebble (with current field value or empty), clear the text field, but **do not** call `FocusScope.of(context).unfocus()` or remove focus from the text field. (2) Keep the same `FocusNode` (or no explicit unfocus) so the keyboard stays up and the cursor remains in the field. (3) If the naming is inline (one field per pebble in a list), then “Add another” should append a new row and **move focus** to the new row’s text field so the user can type immediately without tapping again.
- **Acceptance criteria:** (1) Tapping “Add” or “Add another” does not dismiss the keyboard. (2) After add, user can type the next pebble name immediately. (3) Flow allows entering 5–10 pebbles in succession without re-opening the keyboard or losing flow.

**Why:** Reduces blank-page syndrome and keeps the flow moving without constraining the user. Keyboard retention is essential for a smooth, high-density task-entry experience.

**Priority:** P2 (templates/hints); P1 (placeholders and “add another” focus + **keyboard retention**).

---

### 2.4 Optimal breakdown hints (light touch)

- **Pebble count per landmark:** After Step 3, if a landmark has 0 or 1 pebble, optional Elias line: “You can add more pebbles later from the Scroll.” No blocking.
- **Satchel and “next action”:** When packing, consider (future) hint: “Pick stones you can do today.” No algorithm change; just copy that frames the Satchel as “today’s work” not “all my tasks.”

**Why:** Gently nudges toward actionable chunks without lecturing or blocking.

**Priority:** P2.

---

## 3. Smoothness & “No Bumpy” Experience

### 3.1 Loading and empty states

- **Every async screen:** Show a clear loading state (skeleton or spinner in theme colors). Never leave the user staring at a blank list while data loads.
- **Empty states with next action:** Scroll (no mountains) → “Climb New Mountain” / “Open a New Path” (already planned). Satchel (empty) → “Pack your satchel from the Scroll” + button to Pack or go to Scroll. Whetstone (no habits) → “Add a habit to sharpen each day” + Add button. Each empty state should answer “what do I do next?”
- **First-time user:** After signup, optional 1–2 step hint: “Start by opening the Scroll and climbing your first mountain,” with a single CTA to Scroll. Dismissible; do not show again.

**Why:** Empty and loading states are where users often drop off or think the app is broken. Clear copy and one clear action reduce confusion.

**Priority:** P0 (loading + empty states); P1 (first-time nudge).

---

### 3.2 Errors and offline

- **Network errors:** Friendly message (e.g. “Can’t reach the fire. Check your connection and try again.”) and retry. No raw exception text. Align with [MASTER_PLAN.md](MASTER_PLAN.md) Part G §2 item 6.
- **Conflict / failure on create/update:** SnackBar with actionable copy (“Couldn’t save. Try again.”) and, where possible, keep the user’s input so they can retry without re-typing.
- **Offline:** MVP is online-only. If you add offline later, show a clear “Offline — changes will sync when you’re back” banner and disable or queue writes.

**Why:** Errors should feel recoverable and human, not technical.

**Priority:** P0 (network/error copy); P2 (offline when/if added).

---

### 3.3 Haptics and feedback

- **Consistent haptics:** Burn (drop on Hearth), Pack (stone added to satchel), habit toggle, mallet strike (Climb Step 3), button confirm (e.g. Continue in Climb). Use light impact for toggles, slightly stronger for “commit” actions (burn, pack).
- **Button and tap feedback:** All primary actions should have immediate visual feedback (ripple, opacity, or scale) so the user never wonders “did that tap register?”

**Why:** Tactile and visual feedback make the app feel responsive and intentional.

**Priority:** P0 (burn, pack, key buttons); P1 (habit, mallet, Climb).

---

### 3.4 No dead ends

- **Compass / Return to Map:** Always available in Climb and Edit overlays; partial progress saved. Back button (Android) treated as Return to Map (per spec).
- **After Pack:** User lands back on Sanctuary or Satchel with clear “next step”: drag to Hearth or open Satchel to see stones.
- **After Burn:** Elias line + optional short celebration; user remains in Sanctuary. No modal that requires “OK” unless it’s a rare, important message.

**Why:** Every flow should have an obvious exit and next step. Avoid trapping the user in a dialog or blank screen.

**Priority:** P0 (already partly in spec; verify everywhere).

---

### 3.5 Thumb zone & Whetstone choice overlay (Elias bubble tail)

When the user taps the **Whetstone** from the Satchel, Elias appears in an overlay with a speech bubble offering **“Sharpen Habits”** only; Refine Path (Edit nodes) is on the Scroll/Map (Peak Detail) (per [VOYAGER_SANCTUARY_POLISH_PLAN.md](Completed/VOYAGER_SANCTUARY_POLISH_PLAN.md) — Satchel layout, Whetstone tap). The overlay is positioned for thumb-zone efficiency. To make the connection between the **character’s dialogue** and the **tool the user just touched** obvious, the speech bubble must have a **tail** (pointer) that clearly **points to the Whetstone icon**.

**Construction nuance — watercolor blur:** The Polish Plan specifies a **BackdropFilter** (e.g. watercolor-style blur) for the dimming layer, not a flat grey tint. When implementing the modal barrier behind Elias and the bubble, use **ImageFilter.blur** with **sigmaX: 5.0, sigmaY: 5.0** (or similar). A flat dimming layer looks “techy”; a blur looks “dreamy” and fits the refined, papeterie aesthetic.

**Implementation:**

- **Where:** The overlay shown when the user taps the Whetstone from the Satchel (e.g. in [lib/features/satchel/satchel_screen.dart](lib/features/satchel/satchel_screen.dart) or the shared overlay component used for Whetstone choice). Elias + parchment speech bubble are described in the Polish Plan (BackdropFilter dimming, Elias head/shoulders, bubble with Sharpen Habits + Close).
- **Behavior:** The speech bubble uses a **tail** (triangle or path that extends from the bubble toward the Whetstone). Position and rotate the tail so it **visually points at** the Whetstone icon (or the tap target that opened the overlay). This can be done with a `CustomPainter` for the tail, or a rotated `CustomPaint`/`ClipPath` triangle anchored to the bubble’s edge nearest the Whetstone. The tail should be the same parchment/paper color as the bubble.
- **Implementation nuance (responsive layout):** A **static** tail position can miss the icon on different screen sizes (e.g. tablet vs. phone). Use a **GlobalKey** (or similar) on the Whetstone icon widget and, when laying out the overlay, use **RenderBox** (e.g. `key.currentContext?.findRenderObject() as RenderBox`, then `localToGlobal` or `size`/`position`) to get the **exact center** (or anchor point) of the Whetstone icon. Anchor the **tip of the tail** to that computed position so the tail points at the icon on all form factors.
- **Acceptance criteria:** (1) When the Whetstone choice overlay is open, the bubble has a visible tail. (2) The tail points toward the Whetstone icon so the dialogue is unambiguously tied to that tool. (3) Tail tip aligns with the icon center across phone and tablet (or different layout constraints). (4) Styling matches the existing parchment/gold aesthetic (e.g. [lib/core/constants/app_colors.dart](lib/core/constants/app_colors.dart)).

**Why:** A tail that points at the Whetstone reinforces cause-and-effect (“I tapped this → Elias is talking about this”) and keeps the UI legible without extra copy.

**Priority:** P1 (polish for Satchel/Whetstone entry).

---

### 3.6 Micro-interaction polish (P2) — “Invisible” elite layer

These features support the **transition from “active work”** (e.g. CPA prep, accounting) **back into the “Sanctuary” headspace**. They are subtle, non-blocking, and make the app feel world-class without adding visible chrome.

**1. Breathable UI (dynamic letter-spacing)**  
As the user spends more time on the Scroll (Map) or in the Climb flow, the UI should subtly signal “you are here now; take a breath.”  
- **Behavior:** On screen entry, serif headers (e.g. “THE SCROLL,” section titles like landmark/peak names) use a **letter-spacing animation**: start slightly condensed (e.g. `0.0`) and expand to a comfortable reading value (e.g. `1.5`) over **800ms**. Easing: `Curves.easeOutCubic` or similar.  
- **The vibe:** Mimics a lung expanding. It tells the user, “You are here now. Take a breath.”  
- **Where:** Scroll Map screen, Climb flow overlay headers. Apply only to the primary serif headers (not body text or buttons). Use `TweenAnimationBuilder` or `flutter_animate` with a letter-spacing `Tween`; ensure the font supports letter-spacing (e.g. `letterSpacing` on `TextStyle`).  
- **Acceptance criteria:** (1) On opening Scroll or Climb step, serif headers animate letter-spacing from condensed to expanded over ~800ms. (2) Animation runs once per screen entry; no loop. (3) Effect is subtle (not distracting).

**2. Contextual haptic “weight”**  
Haptics become **informational** — the user can “feel” the significance of what they completed without looking.  
- **Behavior:** Scale haptic intensity and pattern by **node type** (or completion scope):  
  - **Pebble burn:** Light, single tap (like a small stone hitting water). Use `HapticFeedback.lightImpact()` or platform equivalent.  
  - **Landmark completion** (last pebble of a boulder): Medium, **double-tap** (thump–thump). Two medium impacts with short delay (~80–120ms).  
  - **Mountain summit** (last pebble of the mountain): **Heavy**, long pulse (the feeling of a heavy door closing). Use `HapticFeedback.heavyImpact()` or a sustained pattern if the platform supports it.  
- **The vibe:** The user feels the weight of the milestone. Pebble = quick acknowledgment; mountain = a moment of closure.  
- **Where:** Hearth drop handler (or wherever burn/completion is triggered). Pass the completed node and its hierarchy (pebble vs. last-in-boulder vs. last-in-mountain) to choose the haptic.  
- **Acceptance criteria:** (1) Pebble-only burn = light single tap. (2) Last pebble of a landmark = medium double-tap. (3) Last pebble of a mountain = heavy/long pulse. (4) No haptic for non-burn actions in this flow (or keep existing light feedback for pack/habit).

**3. Night-shift aesthetics (“Sunset Lock” / evening planning mode)**  
For users working late (e.g. Vista, CPA prep), the app should acknowledge evening strain and reduce blue-light harshness.  
- **Behavior:** When **time-of-day** is **Night** (or “Late Night” if you split the period), apply a **warmer, amber-tinted** treatment to:  
  - **Whetstone choice overlay:** Elias speech bubble and backdrop get a **soft glow** (e.g. subtle amber `ColorFilter` or overlay with low-opacity warm color).  
  - **Refine mode parchment:** The Scroll/Edit overlay parchment (and any Refine-mode panels) use a slightly **warmer, amber-tinted** hue (simulating candlelight) instead of neutral parchment.  
- **The vibe:** Reduces blue-light strain and makes refinement feel like a cozy late-night study session in a library rather than a bright digital chore.  
- **Where:** Read `TimeOfDayProvider` or `currentTimeForBackgroundProvider` (or equivalent in [lib/providers/time_of_day_provider.dart](lib/providers/time_of_day_provider.dart)). When period is Night (e.g. 8pm–5am or your defined window), wrap or tint the Whetstone choice overlay and the Refine-mode Scroll overlay with a warm filter (e.g. `ColorFiltered` with `ColorFilter.mode(amberTint, BlendMode.softLight)` and low opacity, or adjust background `Color` toward amber). Use [lib/core/constants/app_colors.dart](lib/core/constants/app_colors.dart) for a dedicated `candlelightTint` or `nightParchment` if desired.  
- **Acceptance criteria:** (1) In Night period, Whetstone choice overlay has a visible warm/amber soft glow. (2) In Night period, Refine mode parchment is warmer than in Day. (3) Day/Midday/Sunset remain unchanged. (4) Tint is subtle (accessibility: text contrast still meets WCAG).

**Why:** Together, these “invisible” details ease the shift from high-focus work back into Sanctuary and make late-night use feel considered rather than default-bright.

**Priority:** P2 (elite polish; implement after P0/P1 smoothness and gamification are solid).

---

## 4. Onboarding & First-Run

### 4.1 First mountain

- **Trigger:** After first login, if mountain count is 0, show a single prompt (Elias or small card): “Every journey starts with a peak. Climb your first mountain?” → opens Climb flow. Skip if user already has mountains (e.g. restored from another device).
- **No long tutorial:** Prefer one sentence + one CTA over multi-screen walkthrough. The Climb flow itself is the “tutorial” for goal creation.

**Priority:** P1.

---

### 4.2 First Pack and first Burn

- **First Pack:** When user taps Pack for the first time (and slots fill), optional Elias line: “Your satchel is packed. Drag a stone to the fire when it’s done.” Show once, then never again (e.g. flag in local storage or profile).
- **First Burn:** After first successful drop on Hearth, optional line: “One stone burned. The path opens.” Same: once per account.

**Why:** Teaches the core loop (Pack → work → Burn) in context, without a separate tutorial.

**Priority:** P1.

---

## 5. Completion & Reward Loops (Summary)

| Moment | What to do | Priority |
|--------|------------|----------|
| Pebble burned in Hearth | Animation + sound + haptic + Elias line; optional “burns today” in line | P0 |
| Last pebble of a mountain burned | One-time “Mountain summited” + Elias + optional subtle celebration | P1 |
| Satchel packed | Elias line (existing) + optional “stones packed” confirmation | P0/P1 |
| Habit checked (Whetstone) | Quick feedback (checkmark, haptic); streak updated | P1 |
| Habit streak 7 / 30 / 100 | One-time Elias or toast | P2 |
| Burn streak (consecutive days) | Badge or Elias line after burn | P1 |
| Return after idle | Encouraging Elias line, no guilt | P1 |
| Whetstone choice (from Satchel) | Elias overlay with speech bubble **tail pointing at Whetstone icon** | P1 |
| Serif headers on Scroll/Climb entry | **Breathable UI:** letter-spacing 0.0→1.5 over 800ms (“take a breath”) | P2 |
| Pebble / Landmark / Mountain burn | **Haptic weight:** Light (pebble), Medium double-tap (landmark), Heavy long-pulse (mountain) | P2 |
| Night period: Whetstone & Refine overlays | **Night-shift:** Amber “candlelight” tint + soft glow; cozy late-night study vibe | P2 |

---

## 6. Recommendations by Priority

### P0 — Do first (foundation for enjoyment and trust)

- Complete **Climb New Mountain** flow per [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md).
- Complete **Edit (Refine)** flow per Phase 4 of Polish Plan.
- **Loading and empty states** on every relevant screen; **one clear next action** per empty state.
- **Error handling:** friendly network/retry copy; no raw exceptions.
- **Haptics** on burn, pack, and primary Climb/Edit buttons.
- **No dead ends:** Compass/Return always available; Back = Return to Map; clear next step after Pack and Burn.

### P1 — High impact (gamification and polish)

- **Whetstone streaks** (consecutive days) and display on Whetstone screen; **Grace Day** mechanic (freeze or -2 on one miss, reset only on two consecutive misses).
- **Burn streaks** (consecutive days with ≥1 burn) and optional Elias line; same **Grace Day** logic.
- **Elias context-aware lines** (satchel full, at mountain cap, first Pack, first Burn, return after idle).
- **Mountain completion celebration** (last pebble → “Mountain summited” + Elias).
- **First-run nudges** (first mountain, first Pack, first Burn) — one line each, dismissible, once per account.
- **Placeholders and “add another” focus** in Climb Step 3 for pebble naming; **keyboard must not dismiss** on “Add another” (focus stays in field for flow-state entry).
- **Whetstone choice overlay:** Elias speech bubble has a **tail/pointer** that points at the Whetstone icon (see §3.5).

### P2 — When time allows

- **Campfire/sparks visual** (P2): higher burn streak = embers fly higher / more sparks from Hearth; optional subtle background “aliveness.” No progress bar; atmospheric only (see §1.2).
- **Landmark templates / hints** (e.g. Research → Plan → Execute → Review).
- **Habit streak milestones** (7 / 30 / 100 days) with one-time toast or Elias line.
- **“Mountain momentum” / “Tending the Slope”** (pebbles burned this week, last burn date) on Scroll; when a mountain is untouched for a week, Elias line: “The weeds are tall on that northern peak, but the earth is still good.” (Vista/sanctuary aesthetic.)
- **Micro-interaction polish (§3.6):** Breathable UI (serif header letter-spacing animation on entry); contextual haptic weight (Pebble = light, Landmark = medium double-tap, Mountain = heavy long-pulse); Night-shift aesthetics (amber candlelight tint on Whetstone choice + Refine parchment in Night period).
- **Offline banner** when/if offline support is added.

---

## 7. Suggested Implementation Order

1. **Climb flow** (CLIMB_FLOW_SPEC) + **Edit flow** (Polish Plan Phase 4) — so goal input and refinement are complete and enjoyable.
2. **Loading/empty/error** and **haptics** — so the app feels responsive and trustworthy.
3. **Burn celebration** (sound + haptic + Elias) and **mountain completion** moment — so completion feels rewarding.
4. **Streaks** (Whetstone, then burn) and **Elias context-aware + first-run lines** — so motivation and guidance are in place.
5. **First-run nudges** and **P2 items** as polish.

---

## 8. What Stays Unchanged

- **Schema:** No new tables required for P0/P1 except optional `user_streaks` or similar for streak persistence (or derive from existing completion data).
- **Whetstone** = daily habits; **Satchel** = task bag; **Hearth** = completion. No mixing of metaphors.
- **Elias** = narrative companion and coach, not a points system or store.
- **Max 3 active mountains** and **6 satchel slots**; no auto-refill after burn. These constraints are part of the design.

---

## 9. Definition of “Complete and Enjoyable”

- **Input:** User can add a goal (Climb flow) and refine it (Edit flow) in a guided, narrative way without hitting confusing dialogs or dead ends.
- **Breakdown:** Four landmarks and pebbles per landmark are created with clear steps, optional sound/haptic, and sensible placeholders.
- **Motivation:** Streaks and Elias lines reward consistency; celebrations mark completions; copy encourages without guilting.
- **Smoothness:** Every screen has loading and empty states; errors are friendly and retryable; haptics and feedback are consistent; no dead ends.

This doc is the single reference for making Voyager Sanctuary a **complete, gamified, polished, and enjoyable** experience for setting goals, breaking them into tasks, and staying motivated to finish them — while keeping the app stable and the processes optimal.
