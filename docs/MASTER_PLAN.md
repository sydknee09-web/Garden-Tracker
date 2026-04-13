# VOYAGER SANCTUARY — MASTER PLAN

**Status:** Active  
**Date:** March 2026  
**Stack:** Flutter · Supabase (LTREE) · Riverpod  
**Platform Target:** iOS + Android (mobile-first)

**Doc hierarchy:** This plan is canonical. For AI alignment (vision, who does what, when to ask), see [VISION_AND_AUTOMATION.md](VISION_AND_AUTOMATION.md). BUILD_ALIGNMENT_PLAN, HEALTH_AND_IMPROVEMENTS, and PROJECT_PLAN_REFINE_AND_POLISH are derived views; see [CONVENTIONS.md](CONVENTIONS.md) § Plan document hierarchy.

This document combines all project plans into one master list. Phases 1–3 (Schema, Data, State) are complete; Implementation P0–P2 and remaining work are consolidated here.

---

## Run All Migrations

**After running `docs/schema.sql`, apply all incremental migrations:**

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Create a **New query**
3. Paste the contents of [`docs/MIGRATE_LOGIC_LEAF.sql`](MIGRATE_LOGIC_LEAF.sql)
4. Click **Run**

This applies: ritual/archive, master ledger, Elias intro, streaks, appearance, Logic & Leaf trigger, `get_packable_candidates`, and `get_peak_progress`. Idempotent — safe to re-run.

---

## Table of Contents

1. [Design Aesthetic & Philosophy](#design-aesthetic--philosophy)
2. [App Entry Flow (Auth → Intro → Sanctuary)](#app-entry-flow-auth--intro--sanctuary)
3. [Conceptual UX Principles](#conceptual-ux-principles-moments-of-truth)
4. [Part A — Project Phases (0–14)](#part-a--project-phases-014)
5. [Part B — Implementation P0 (Foundation)](#part-b--implementation-p0-foundation)
6. [Part C — Implementation P1 (Gamification)](#part-c--implementation-p1-gamification)
7. [Part D — Implementation P2 (Elite Polish)](#part-d--implementation-p2-elite-polish)
8. [Part E — Audit Fixes](#part-e--audit-fixes)
9. [Part F — Refine & Polish](#part-f--refine--polish)
10. [Part G — Recommended Fixes & Release](#part-g--recommended-fixes--release)
11. [Audit — Resolved](#audit--resolved)
12. [Build Out](#build-out)
13. [Logic & Leaf Protocol](#logic--leaf-protocol-conceptual-spec)

---

## Design Aesthetic & Philosophy

### North Star

> **Cozy. Smooth. Gamified. Polished. Fun.**

A Studio Ghibli–esque retreat—tactile, whimsical, satisfying. The focus is on the *satisfaction of the movement* (burning a rune stone, packing a rune stone, striking with the hammer) rather than the status of the materials. *Rune = packable = burnable; rune boulder, rune pebble, rune shard.* The Sanctuary is a place you want to return to, not a productivity tool you open out of obligation.

### Sanctuary DNA

**Cozy, Smooth, Intent-focused.** Move from rigid list to malleable terrain. Structure supports clarity; clutter undermines it. Polish and gamification reward the ritual.

### Japandi

Minimal entry points. Calm over chaos. "Less is more." Avoid visual noise—animations, copy, and overlays should feel intentional, not busy. When in doubt, subtract.

### Tone

Ritual over task list. Metaphor-rich, warm, no guilt. Elias speaks like a guide, not a coach. The experience should feel like arriving at a place, not checking a box.

### Materials & Palette

Tactile, hand-crafted feel. Worn parchment, vellum for overlays and bubbles. Palette hints: Dark Walnut, Cream Parchment, warm orange accents (`#C26D2B`). Peak appearance styles: dark_walnut, navy, slate, charcoal, burgundy, forest. Prefer organic, muted tones—warm and inviting, not cold or corporate.

**Color rules:**
- **Grey:** Prefer not to use `#808080`. Use Charcoal Stone or Misty Navy instead.
- **White:** Prefer not to use `#FFFFFF`. Use Warm Parchment or Soft Linen instead.

### Living World

Elias, lore, and immersion over pure utility. The Sanctuary is a place you return to—not a tool you open. Transitions, dialogue, and feedback should reinforce that the world exists beyond the tap.

### The Forest Threshold (Cold Start)

Every app launch from cold start shows the **Forest Threshold**—a dense tree/forest image that fades to reveal the Sanctuary. No spinner. Cinematic, Ghibli-esque. Replaces the "Loading Sanctuary..." screen. Used every time the app initializes from a cold start. **Implementation:** `FadeTransition` or `AnimatedOpacity`—simpler than parting. **Animation speed:** Link to `has_seen_elias_intro`—first-time users: slower, more cinematic to build anticipation; returning users: quick, smooth "welcome back." See [ELIAS_INTRODUCTION_SPEC](ELIAS_INTRODUCTION_SPEC.md) Beat 1 and `bootstrap.dart`.

### What We Avoid

Clutter. Guilt-tripping. Cold or sterile UI. Corporate tracker feel. Flat grey dimming (use blur or parchment). Anything that makes the app feel like "productivity software" instead of a sanctuary.

**Evicted:** "Hotel Executive" / "high-end office" vibes. Status over satisfaction.

### Why This Framing

Shifts from a "duty-bound" executive tool to a "chosen" ritualistic experience. Japandi elements breathe like a quiet forest cabin rather than a cold boardroom. The "Accountant" side becomes "Keeper of the Ledger"—satisfying, not sterile.

### Guiding Philosophy (Build)

> "Small verified chunks. Never build what you cannot test."

Every phase ends with a testable, shippable milestone. Build bottom-up: data models first, state layer second, UI last.

### App Entry Flow (Auth → Intro → Sanctuary)

The app entry sequence is strictly ordered:

1. **Auth Gate** — If not signed in → **Auth Screen** (sign-in / sign-up). The Auth Screen must be built to fit the app aesthetic (Japandi, warm palette, Elias-adjacent tone).
2. **Post-Auth Check** — After successful auth, the app checks `has_seen_elias_intro` in the user's profile.
3. **Intro vs Sanctuary** — If `has_seen_elias_intro` is `false` → **Intro Sequence** (5-beat cinematic intro, New Journey Wizard, Whetstone setup). If `true` → **Sanctuary** (Campsite).

*Never* send a first-time user directly to Sanctuary. The Intro Sequence is the mandatory first impression. See [ELIAS_INTRODUCTION_SPEC](ELIAS_INTRODUCTION_SPEC.md) and Build Out 1.

---

### Conceptual UX Principles (Moments of Truth)

These principles govern the emotional weight of key flows. Implement with intent.

**1. The "First Impression" Velocity**  
The first 60 seconds are critical. Elias Introduction (Build Out 1) is a 5-beat cinematic intro—welcome, Satchel, Hammer, Hearth, then first mountain creation, then Whetstone setup (1–3 habits). The user shouldn't feel like they're "setting up an app." They should feel like they're *waking up in a new place*.

*Note:* Transitions between beats use parallax and warm glow. No spinner—cold start uses the Forest Threshold (forest image fades to reveal Sanctuary). See [§ The Forest Threshold](#the-forest-threshold-cold-start).

**2. The "Weight" of the Satchel**  
Capacity limit (6 slots) is locked in.

*Note:* Conceptually, the Satchel is the user's "Daily Horizon." Empty = quiet and expectant. Full = bustling. The "Rune stones flying into bag" animation is the payoff for planning—make it feel *heavy and satisfying*, like a job well started.

**3. The "Accountant's Ledger" vs. "Elias's Wisdom"**  
The Map (Vision) is separate from the Detail (Technical Ledger).

*Note:* MountainDetailScreen = "Accountant Mode." SanctuaryScreen (Campsite) = "Spirit Mode." Elias should be most active at the Campsite and most *silent* in the Detail Screen. Don't let the Guide distract the Accountant while they're organizing pebbles. **Balance:** Use Japandi materials (Dark Walnut, Roman Clay textures) to skin the Accountant screens—logic is rigid, but the texture remains cozy. Avoids feeling like two different products stapled together.

**4. The "4:00 AM Hearth" Ritual**  
The 4:00 AM boundary suits remote workers and non-traditional schedules.

*Note:* Conceptually, 00:00–04:00 is "The Blue Hour." If the user is active then: Hearth fire becomes the primary light source; dim the edges of the screen, focusing entirely on the warmth of the fire and the Satchel. Campfire embers glow brighter; Elias's greeting is a whisper. Acknowledge the night owl without making it feel like a bug.

**5. Managing the LTREE Complexity**  
LTREE for Boulders, Pebbles, and Shards is elegant but can feel messy if not visualized.

*Note:* Always keep the "bones" of the hierarchy visible in the Peak Journal. If a user Shatters a Boulder into Pebbles, the relationship should be visually obvious (nesting, connecting lines) so they never feel lost in their own data.

**6. The Campsite → Satchel → Map Loop**  
Three pillars form the user's home base:

- **Campsite:** Where you talk to Elias and burn stones at the Hearth.
- **Satchel:** Your "workbench"—6 stones, the Hammer, and access to the Map.
- **Map:** Long-term vision; tucked inside the Satchel view or accessed through it. *"You can access it anytime from your satchel here at our campsite."*

---

## Part A — Project Phases (0–14)

### PHASE 0 — ENVIRONMENT & REPO SETUP
- [x] Install Flutter SDK (stable channel), verify `flutter doctor` clean
- [x] Install Supabase CLI
- [x] Create new Flutter project: `voyager_sanctuary`
- [x] Add dependencies to `pubspec.yaml`
- [x] Configure `.env` / `--dart-define` for Supabase URL + anon key
- [x] Add `.gitignore` entries for secrets
- [x] Initialize git repository with `main` + `dev` branches
- [x] Confirm `flutter run` produces blank MaterialApp on device/emulator

### PHASE 1 — SUPABASE SCHEMA & BACKEND
- [x] Enable `ltree` extension in Supabase SQL editor
- [x] Create `profiles` table
- [x] Create `mountains` table
- [x] Create `nodes` table (Boulders + Pebbles via LTREE `path` column)
- [x] Create `whetstone_items` table
- [x] Create `whetstone_completions` table
- [x] Create `satchel_slots` table/view
- [x] Write RLS policies for every table
- [x] ~~Write Supabase Edge Functions~~ — **Deferred.** See Build Out 4 for architecture if you decide to implement.
- [x] Validate LTREE ancestor/descendant queries work

### PHASE 2 — DATA LAYER (REPOSITORIES)
- [x] Create `SupabaseService` singleton
- [x] Create `MountainRepository`
- [x] Create `NodeRepository` (CRUD nodes, LTREE path management)
- [x] Create `SatchelRepository`
- [x] Create `WhetstoneRepository`
- [x] Write unit tests for priority sort: Due Date > Starred > FIFO
- [x] Write unit test for LTREE path generation on split/shatter
- [x] Write unit test for Whetstone midnight reset logic

### PHASE 3 — STATE MANAGEMENT (RIVERPOD PROVIDERS)
- [x] `TimeOfDayProvider` — watches device clock, emits `DayPeriod` enum
- [x] `AuthProvider` — Supabase auth state stream
- [x] `MountainListProvider`
- [x] `NodeProvider(mountainId)`
- [x] `SatchelProvider`
- [x] `WhetstoneProvider`
- [x] Wire providers to repositories

### PHASE 4 — CORE SCREENS (SKELETON)
- [x] `EntranceScreen` — time-of-day background (4 variants)
- [x] `SanctuaryScreen` — static campsite layout
- [x] `ScrollMapScreen` — The Map (vertical list of peaks)
- [ ] `MountainDetailScreen` — Peak Journal (`/scroll/:mountainId`); tap peak on Map → detail. *Route not yet in app.*
- [x] `SatchelScreen` — 6-slot grid view + Hammer trailing icon per stone
- [x] `WhetstoneScreen` — checklist + Yesterday/Today/Tomorrow slider
- [x] `ManagementMenuSheet` — bottom sheet
- [x] Set up `go_router` routes for all screens *(add `/scroll/:mountainId` when implementing)*
- [x] Screen titles in app bar; breadcrumb trail where warranted

### PHASE 5 — THE MALLET TOOL (CORE INTERACTION)
- [x] Implement "Architect mode" toggle (FAB always visible)
- [x] Mallet on Mountain path creates Boulder
- [x] Mallet on Boulder creates Pebble
- [x] Mallet on Pebble creates Shard (visual note). *Logic & Leaf: Shards become actionable; pebble with shards = container.*
- [x] Mallet on Shard splits into 2 Shards, clones metadata
- [x] Metadata clone rule: `is_starred` + `due_date` always cloned
- [x] Architect mode stays on until user taps Architect FAB again
- [x] Verify star/due-date inheritance on split
- [x] Write integration test for full Mallet flow

### PHASE 6 — THE SATCHEL SYSTEM
- [x] Implement Satchel slot UI (6 fixed slots)
- [x] Implement "Pack Satchel" flow from Elias tap
- [x] Enforce capacity: NO auto-refill after burn
- [x] Priority queue: Due Date -> Starred -> FIFO. *Logic & Leaf: Validity Filter (leaf-only, sequential lock) applies before priority.*
- [x] Check-off flow: mark Done, drag to Hearth to complete
- [x] Pack fills slots 1-6; swipe left = remove, swipe right = done
- [x] Verify starred pebble jumps to slot #1 on pack
- [x] Verify burned slot stays empty

### PHASE 7 — THE HEARTH (COMPLETION)
- [x] Implement `HearthWidget` as `DragTarget`
- [x] On stone drop: trigger burn/shatter animation
- [x] On animation complete: delete node, increment mountain progress
- [x] Clear satchel slot (do NOT auto-refill)
- [x] Update mountain progress bar in Scroll Map

### PHASE 8 — THE WHETSTONE SYSTEM
- [x] Implement `WhetstoneScreen` with vertical checklist
- [x] Implement Yesterday/Today/Tomorrow slider
- [x] Implement `WhetstoneCompletionRepository` upsert by `(user_id, item_id, date)`
- [x] Add/remove/edit habits; swipe right = mark done, swipe left = remove
- [x] Midnight timer in `WhetstoneNotifier` refreshes completions at local midnight
- [x] `AppLifecycleState.resumed` wired in root `app.dart`
- [x] Verify midnight sweep (Test #5 from First Five)

### PHASE 9 — TIME-OF-DAY ENGINE & ELIAS
- [x] `ScenePeriod` enum: Dawn (5-10), Midday (10-17), Sunset (17-20), Night (20-5)
- [x] `TimeOfDayProvider` polls system clock
- [x] Background gradients per period
- [x] Elias silhouette painter — period-aware glow
- [x] Elias greeting: randomized pool of warm messages per period
- [x] Wire real background `Image.asset()` once files in `assets/backgrounds/`
- [x] Wire real Elias `Image.asset()` once files in `assets/elias/`
- [x] Verify Dawn to Midday transition (Test #1 from First Five)

### PHASE 10 — MOUNTAIN (PEAK) MANAGEMENT
- [x] `[+]` button creates new peak (via New Journey wizard)
- [x] Cap enforcement: max 3 active peaks
- [x] Long-press peak, context menu (Rename / Archive)
- [x] Archive: soft-delete (`is_archived = true`)
- [x] Archive Recovery in Management Menu
- [x] Peak progress bar: `(burned_pebbles / total_pebbles) * 100`
- [x] Peak path visual — `_MountainTrailBody` renders boulders/pebbles/shards
- [ ] Map → Detail flow: tap peak on Map → `MountainDetailScreen` (Peak Journal). *Requires route + refactor.*

### PHASE 11 — AUTHENTICATION
- [x] Supabase Auth: email/password sign-in and sign-up
- [x] `AuthScreen` — combined sign-in / create-account with mode toggle
- [x] Auth guard on all app routes
- [x] `AuthProvider` state drives go_router redirect
- [x] Settings screen — shows signed-in email, Sign Out with confirmation
- [ ] **Auth Screen fit** — Build Auth Screen to match app aesthetic (Japandi, warm palette, Sanctuary tone). See [§ App Entry Flow](#app-entry-flow-auth--intro--sanctuary).
- [ ] **Post-auth redirect** — After auth, check `has_seen_elias_intro`. If `false` → Intro Sequence (not Sanctuary). If `true` → Sanctuary.
- [ ] Confirm RLS: two separate test accounts cannot see each other's data

### PHASE 12 — POLISH & ANIMATIONS
- [x] Elias speech bubbles / conversation — `EliasDialogue` + `eliasMessageProvider`
- [x] Wire real background `Image.asset()`
- [x] Wire real Elias `Image.asset()`
- [x] Hearth burn/shatter animation tuned
- [x] Haptics on key interactions (burn, pack)
- [ ] Satchel pack animation (stones flying into bag)
- [ ] The Map: peak path visual polish
- [ ] Mallet cursor/drag shadow (Architect mode)
- [ ] Elias idle animation (breathing or blinking loop)
- [ ] Background parallax or ambient particle effect
- [ ] Forest Threshold cold-start loading — Replace "Loading Sanctuary..." in `bootstrap.dart` with forest image fade to reveal Sanctuary. See [§ The Forest Threshold](#the-forest-threshold-cold-start).
- [ ] Typography and color system formalized

### PHASE 13 — OFFLINE SUPPORT & SYNC *(Post-Launch)*
*Scheduled for final wrap-up after MVP. Not excluded—just after core loop is validated.*

- [ ] Add Isar as local embedded DB
- [ ] Mirror Supabase tables locally
- [ ] Optimistic updates on all writes
- [ ] Conflict resolution strategy
- [ ] "Offline mode" banner in UI

### PHASE 14 — QA & RELEASE PREP
- [ ] Full First Five test suite passes on physical device (iOS + Android)
- [ ] Edge cases documented and tested
- [ ] Performance audit: 60fps on mid-range device
- [ ] App icons, splash screen, store assets
- [ ] `flutter build appbundle` and `flutter build ipa` clean
- [ ] Submit to TestFlight and Google Play Internal Testing

---

## Part B — Implementation P0 (Foundation)

**Scope:** New Journey (6-step wizard), Edit (Refine) flow, loading/empty/error states, haptics, no dead ends.  
**Definition of done:** User can add a goal (New Journey) and refine it (Edit) in a guided way; every screen has loading/empty states and friendly errors; burn/pack/primary buttons have haptics; Compass/Return and Back never trap the user.

### 1. New Journey flow (6-step wizard)

Per [PEAK_PLANTING_WIZARD_SPEC](PEAK_PLANTING_WIZARD_SPEC.md) and [ALIGNMENT_OUTCOME_SPEC](ALIGNMENT_OUTCOME_SPEC.md). Entry: Elias → "New Journey" (first) or Map FAB. Gate: `canAddMountainProvider`. AutoDispose provider for fresh slate on reopen. (Wizard spec filename remains PEAK_PLANTING for historical reference; flow is Peak Creation.)

- [ ] 1.0 **Step 0 — Intent** — Multi-line input. Elias: *"Before we look to the horizon, look within. Why does this journey matter to your spirit?"* 1000-char cap. Continue / Return to Map
- [ ] 1.1 **Step 1 — Identity** — Single-line input. Elias: *"A noble cause. Now, what name shall we give this peak on your map?"* Placeholder: "e.g., Master Bath Remodel"
- [ ] 1.2 **Step 2 — Appearance** — Icon/Style Picker. Save to `mountains.appearance_style`. Migration `20250319000000_add_appearance_style.sql`.
- [ ] 1.3 **Step 3 — Logic** — Toggle: "Long-term" vs "Sprint" (maps to Climb/Survey). Labels: Milestone (Climb) or Region (Survey)
- [ ] 1.4 **Step 4 — Markers** — Dynamic list 1–10. "+ Add" / "- Remove". All must be named before Continue. 11th add = Elias "Heavy Satchel" warning
- [ ] 1.5 **Step 5 — Placing stones** — **Marker Chips only** (manual selection). User taps chip to add pebbles to that marker. No "Next Stone" auto-advance. **Place Pebble** (primary) + **Place & Next Area** (ghost). **"Pack this Journey"** to finalize. Return to Map always visible. Mallet animation on pebble create; rock_break + haptic

**Cancel vs Save:** Save after Step 1 defaults to "Untitled Peak." Must reach Identity phase to commit to Map.

### 2. Edit (Refine) flow — The Hammer

- [ ] 2.1 **Hammer in Satchel** — Trailing icon on each Rune stone (or container) in "Your Satchel". Tap → opens Refine modal where user splits a container (Rune Boulder or Rune Pebble) into Pebbles or Shards. Elias: *"A heavy stone is just a collection of pebbles waiting for a strike."*
- [ ] 2.2 **Refine modal** — Rename, Add pebble, Delete; Elias pools for openEdit, afterRename, afterAddPebble, afterDelete

### 3. Loading and empty states
- [ ] 3.1 Loading states — Skeleton or spinner on Scroll, Satchel, Whetstone; never blank list
- [ ] 3.2 Empty states — One clear next action per screen; Scroll: "New Journey"; Satchel: Pack or go to Scroll; Whetstone: Add habit

### 4. Error handling
- [ ] 4.1 Friendly error copy — No raw exceptions; network/save errors with retry or retained input

### 5. Haptics
- [ ] 5.1 Haptic on burn, pack, and primary Climb/Edit buttons

### 6. No dead ends
- [ ] 6.1 Compass/Return always visible; Android Back = Return to Map; Step 5 Back = silent save; Steps 0–4 unsaved = SnackBar then close

---

## Part C — Implementation P1 (Gamification)

**Scope:** Burn celebration, mountain summit, streaks (Grace Day + 4:00 AM boundary), Elias context-aware, New Journey Step 5 keyboard retention, Whetstone overlay with bubble tail.

### 1. Burn celebration and mountain completion
- [ ] 1.1 Burn moment — Sound (stub OK), haptic, Elias `afterBurn()` line
- [ ] 1.2 Mountain summit — Last pebble of mountain: Elias line + ember particle burst over Hearth; optional Scroll badge

### 2. Streaks (Whetstone + burn) with Grace Day
- [ ] 2.1 Streak data model — 4:00 AM day boundary; Grace Day: one miss = freeze, two = reset
- [ ] 2.2 Whetstone streak display — "X-day streak" on Whetstone screen
- [ ] 2.3 Burn streak display — After burn, Elias line when streak >= 2

### 3. Elias context-aware and first-run lines
- [ ] 3.1 Context-aware — satchel full, at peak cap, return after idle; `lastSeen` throttle (~2s)
- [ ] 3.2 First-run nudges — First Pack, first Burn (once per account)
- [ ] 3.3 First peak nudge (optional) — "Begin your first journey?" for new users with 0 peaks

### 4. New Journey Step 5 (Placing stones) — keyboard retention
- [ ] 4.1 "Place Pebble" / "Add another" keeps focus; keyboard does not dismiss

### 5. Whetstone choice overlay
- [ ] 5.1 Overlay entry — Tap Whetstone tile in Satchel → Elias + "Sharpen Habits" / "Refine Path"; BackdropFilter blur (sigma 8)
- [ ] 5.2 Speech bubble tail — GlobalKey-anchored to Whetstone icon center; `addPostFrameCallback` for layout timing

---

## Part D — Implementation P2 (Elite Polish)

**Scope:** Campfire sparks, mountain momentum, landmark templates, habit milestones, micro-interactions, night-shift, offline banner.

### 1. Campfire sparks
- [ ] 1.1 Sparks driven by burn streak — `Curves.easeOut.transform(streak / 14)`; CustomPainter layer; gold pixels, upward drift, fade

### 2. Mountain momentum / Tending the Slope
- [ ] 2.1 Momentum stats — "X pebbles burned this week" or "Last burn: X days ago" per mountain
- [ ] 2.2 "Tending the Slope" Elias — Mountain untouched 7+ days: "The weeds are tall on that northern peak, but the earth is still good."

### 3. Marker templates and habit milestones
- [ ] 3.1 Marker template hints — Optional "Use template" in New Journey Step 4 (e.g. Research/Plan/Execute/Review)
- [ ] 3.2 Habit streak milestones — 7, 30, 100 days: one-time Elias line or toast

### 4. Micro-interactions
- [ ] 4.1 Breathable UI — Serif headers: letter-spacing 0.0 → 1.5 over 800ms on entry
- [ ] 4.2 Contextual haptic weight — Pebble = light; last of landmark = medium double-tap; last of mountain = heavy/long pulse
- [ ] 4.3 Night-shift aesthetics — Night period: amber tint on Whetstone overlay and Refine parchment

### 5. Offline banner
- [x] 5.1 Offline banner — **Post-Launch** (Phase 13); implement when offline support added

---

## Part E — Audit Fixes

**Source:** [DEEP_AUDIT_DEBUG_REPORT.md](DEEP_AUDIT_DEBUG_REPORT.md)

### Phase 1: Critical — Node Stream & Security
- [ ] 1.1 Add `mountain_id` filter to node realtime stream — `.eq('mountain_id', mountainId)` in `node_repository.dart`
- [x] 1.2 Add `user_id` filter — **SKIPPED** (RLS enforces)

### Phase 2: Friction — Loop Bug & UX
- [ ] 2.1 Prevent climb flow provider disposal — `ref.keepAlive(climbFlowProvider)` in initState; `ref.invalidate` in dispose
- [ ] 2.2 Fix Elias line cache staleness — Clear cache on step/index change; FadeTransition when new line

### Phase 3: Debt — Performance & Cleanup
- [ ] 3.1 Narrow `_saveTitle` invalidation — Pass `mountainId`; invalidate only that mountain's node list
- [ ] 3.2 Reduce `_Step5Pebbles` rebuilds — **Defer** unless profiling shows impact

### Phase 4: Optional Cleanup
- [ ] 4.1 Merge `setState` in edit flow overlay
- [ ] 4.2 Add `.cursor/rules` entry for Loop Bug (Preservation of Intent)

### Phase 5: UI/UX Audit — Button & Layout Polish

**Source:** [VOYAGER_SANCTUARY_UI_AUDIT.md](VOYAGER_SANCTUARY_UI_AUDIT.md)

*What's working:* Storybook aesthetic, Dark Walnut theme, Elias and parchment cards, character scaling.

**Critical (do first):**
- [ ] 5.1 Place Pebble row overflow — Shorten "Place & Next Area" → "Place & Next"; wrap in `Flexible` in `_NamePebbleCard`
- [ ] 5.2 Return to Sanctuary wrapping — `FittedBox` or `minWidth` so label stays on one/two clean lines (all wizard steps)
- [ ] 5.3 Step 5 button labels — Use fixed short labels ("Next Marker", "Pack Journey") instead of `EliasDialogue.climbNextLandmark()` random strings
- [ ] 5.4 Step 4 spacing — Increase vertical padding (24→32–40px) between Add/Remove and Continue; optional `Divider`

**Polish:**
- [ ] 5.5 Improve step descriptions — Step 4: explain what a phase/marker is; Step 5: "Tap a marker to add pebbles"; Identity: "This name appears on your map"
- [ ] 5.6 Extract `_WizardNavRow` — Shared widget for Back | Return | Primary across all steps; consistent `Flexible`/`Expanded`

**Design tokens (formalize):** Nav row spacing 12px; min touch target 44×44; secondary font 12 on mobile; primary button min width 100px.

---

## Part F — Refine & Polish

**Core principle:** Fix once, apply everywhere.

### Universal Patterns (Golden Rules)
- **Keyboard:** `SingleChildScrollView` + `MediaQuery.viewInsets.bottom` padding
- **Loading:** Never blank screen; skeleton or spinner in theme colors
- **Empty state:** One clear next action
- **Elias speech bubble:** Only on tap; after closing popup, not when opening
- **Text:** Georgia font; proper line height
- **Buttons:** Cancel + Save (Save allows empty name)

### Phase 0 — P0 Friction
- [ ] F.0.1 Keyboard overlays text input — Wrap all screens with input in scroll + padding
- [ ] F.0.2 Elias & Fire lag (1st drop) — Pre-load assets; Elias must not scale with fire; stable Key
- [ ] F.0.3 Save/Skip → Cancel and Save — Replace "Skip" with "Cancel"
- [ ] F.0.4 Duplicate "New Journey" buttons — Both (Elias + Map FAB) must open same New Journey wizard
- [ ] F.0.5 Lock terminology — Satchel: "Lock" → "Stow" or "Return to Map"; Step 5: **"Pack this Journey"**

### Phase 1 — Gamification & Lore
- [ ] F.1.1 Elias Introduction (first login) — 5-beat cinematic intro (tap-to-advance) → New Journey Wizard → closing line → Whetstone setup (1–3 habits, no skip) → final line. Forest Threshold (fade) for cold start. See [ELIAS_INTRODUCTION_SPEC](ELIAS_INTRODUCTION_SPEC.md).
- [ ] F.1.2 Step-by-step Elias (wizard) — State-based reveal: Phase A (prompt) → Phase B (input). Typewriter effect. See [PEAK_PLANTING_WIZARD_SPEC](PEAK_PLANTING_WIZARD_SPEC.md) (Peak Creation Wizard).
- [ ] F.1.3 Rotate "What Would You Like to Do?" — Pool of Management greetings
- [ ] F.1.4 Speech bubble — Only when tap, after popup close

### Phase 2 — UX Polish
- [ ] F.2.1 Move stones up — Smooth animation (AnimatedList)
- [ ] F.2.2 Blank row when no stone — Show empty row with hint
- [ ] F.2.3 Seek Guidance order — Reorder: New Journey, Pack, Seek Guidance, Archive, Settings
- [ ] F.2.4 Text readability — EliasTypography, letterSpacing, line height

---

## Part G — Recommended Fixes & Release

### High priority (before release)
- [x] Initialize Git
- [ ] Run First Five tests; mark pass/fail in this plan
- [ ] Verify RLS with two test accounts
- [ ] Confirm satchel slots for new users (6 slots pre-loaded)

### Recommended (robustness & UX)
- [ ] Deep link for password reset (`voyagersanctuary://`)
- [ ] Network failure docs in README/SUPABASE_SETUP
- [ ] E2E tests: Auth → Sanctuary; Map + Architect; Satchel Pack → Hearth burn
- [ ] Mallet integration test
- [ ] Mark Phase 9/12 asset tasks done (if wired)

### Polish & Phase 12 (optional)
- [ ] Hearth burn/shatter animation tuning
- [ ] Satchel pack animation (stones flying into bag)
- [ ] The Map path polish, mallet cursor/shadow
- [ ] Elias idle (breathing/blink)
- [ ] Parallax / particles
- [ ] Typography & color formalized

### Release path (Phase 14)
- [ ] Full TESTING_CHECKLIST on physical device
- [ ] Edge cases documented
- [ ] 60fps on mid-range device
- [ ] App icons, splash screen, store assets
- [ ] `flutter build appbundle` and `flutter build ipa`
- [ ] Submit to TestFlight and Google Play Internal Testing

---

## Audit — Resolved

*Last audit: March 2026. All previously open items resolved.*

**Locked decisions** (now fully specified in Completed Build Outs):

| Decision | Resolution | Spec |
|----------|------------|------|
| MountainDetailScreen | Keep. Route `/scroll/:mountainId`. Map stays clean; Detail = Journal. | [PEAK_JOURNAL_SPEC.md](PEAK_JOURNAL_SPEC.md) |
| User-facing copy | "The Map" (not "The Scroll"). Internal code may use "Scroll." | — |
| Hammer | Trailing icon on each Stone in Satchel. Tap → Refine overlay. Map = vision; Satchel = workbench. | [HAMMER_REFINE_MODAL_SPEC.md](HAMMER_REFINE_MODAL_SPEC.md) |
| Whetstone overlay entry | Tap Whetstone from Satchel → bubble tail overlay. | [WHETSTONE_CHOICE_OVERLAY_SPEC.md](WHETSTONE_CHOICE_OVERLAY_SPEC.md) |

**Historical notes:** PHASE 4 + 10 — MountainDetailScreen; Map → Detail flow; terminology (Peak, The Map); NAVIGATION_MAP `/login` → `/auth`.

---

## Completed Build Outs

Resolved items with specs and locked decisions. Full detail in linked specs.

| # | Item | Resolution |
|---|------|------------|
| 1 | **Elias Introduction** | [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md). 5-beat cinematic intro (welcome, Satchel, Hammer, Hearth) → New Journey Wizard → closing line → Whetstone setup (1–3 habits, no skip) → final line → `/sanctuary`. Forest Threshold (fade) for cold start. Migration `20250317000000_add_has_seen_elias_intro.sql`. **Entry gate:** Shown only when `has_seen_elias_intro` is `false`; never bypassed. Post-auth flow: Auth → check `has_seen_elias_intro` → Intro (if false) or Sanctuary (if true). |
| 2 | **Whetstone Setup** | Merged into Build Out 1. Runs after New Journey Wizard; Elias: *"Before you go—every climber needs a sharp edge. What small ritual keeps you steady?"* |
| 3 | **Peak Creation Wizard** | [PEAK_PLANTING_WIZARD_SPEC.md](PEAK_PLANTING_WIZARD_SPEC.md). 6-step flow (Intent → Identity → Appearance → Logic → Markers → Placing stones). State-based reveal, typewriter. |
| 4 | **Edge Functions** | **Deferred.** Client-side WhetstoneNotifier + Pack Satchel priority. If you build later: Midnight Sweep (CRON 4:00 AM), Priority Query (`/functions/v1/prioritize-satchel`), pg_cron, Deno/TS, Service Role. |
| 5 | **Grace Day Streak** | [GRACE_DAY_STREAK_SPEC.md](GRACE_DAY_STREAK_SPEC.md). Option A (Freeze). `user_streaks` table. Migration `20250318000000_add_user_streaks.sql`. |
| 6 | **Satchel Pack Animation** | [SATCHEL_PACK_ANIMATION_SPEC.md](SATCHEL_PACK_ANIMATION_SPEC.md). Rune stones arc from Markers → Satchel. 500ms, stagger 150ms. SnackBar after animation. |
| 7 | **RLS Verification** | [RLS_VERIFICATION.md](RLS_VERIFICATION.md). Full procedure: Account A/B isolation, poison-record test. Tables: `mountains`, `nodes`, `whetstone_items`, `whetstone_completions`, `satchel_slots`, `user_streaks`. |
| 8 | **Whetstone Choice Overlay** | [WHETSTONE_CHOICE_OVERLAY_SPEC.md](WHETSTONE_CHOICE_OVERLAY_SPEC.md). Tap Whetstone in Satchel → BackdropFilter sigma 8, bubble tail anchored via GlobalKey + addPostFrameCallback. "Sharpen Habits" / "Refine Path." Idle 30s → returnAfterIdle. Empty Satchel → emptySatchel. |
| 9 | **Hammer (Refine modal)** | [HAMMER_REFINE_MODAL_SPEC.md](HAMMER_REFINE_MODAL_SPEC.md). Trailing hammer icon (Aged Bronze), Shatter layout (boulder + pebble inputs), Strike → createPebble batch. Stone crack + particle on Add. Edit Flow pools. |
| 10 | **Peak Journal (Mountain Detail)** | [PEAK_JOURNAL_SPEC.md](PEAK_JOURNAL_SPEC.md). Route `/scroll/:mountainId` (sibling). Map = summary cards; Detail = Intent, Progress, collapsible tree, Sacred Actions. Hero Zoom transition. Elias: "Welcome to the base of this peak." |

---

## Build Out

All Build Outs 1–10 are resolved. See Completed Build Outs table and linked specs for implementation detail.

---

## Logic & Leaf Protocol (Conceptual Spec)

*Planned. Not yet implemented. Captures the nested logic system for decision-fatigue reduction.*

### Core Rules

| Rule | Description |
|------|-------------|
| **Leaf-only packing** | Only nodes with no children are packable. Boulder without pebbles = packable. Pebble without shards = packable. |
| **Containers** | Nodes with children are "landmarks" — not packable. Complete when all children are complete. |
| **Shards as actionable** | Shards become burnable tasks. Pebble with shards = container; shards are the packable leaves. |

### The "Landmark" Packability Rule

Elias only packs **Leaves** (the smallest actionable tasks). Containers (Boulders, Pebbles with children) are landmarks—not packable.

**Example:** "Organize House" → Bathroom → Clean Closet → Donate Shoes  
Only **"Donate Shoes"** flies into the Satchel. "Clean Closet" and "Bathroom" are landmarks—complete when all children are done. **Hammer payoff:** When packing is restricted to leaves, the Hammer shatter animation must feel high-impact and rewarding—it's the moment the user "unlocks" new packable runes.

### Hierarchy & Logic

- **Sub-boulders** — Boulders can have child boulders. Mixed logic (sequential vs freeform) achieved via nesting. Each sub-boulder has its own `logic_type` / `pebble_logic`. **Depth cap:** 3 levels max (Peak → Boulder → Sub-Boulder → Pebble). UI limits nesting to keep tree manageable.
- **Logic on pebbles** — Pebbles with shards have logic for their shards (sequential vs freeform).
- **Recursive logic** — Climb (sequential) or Survey (freeform) at every level: peak, boulder, pebble-with-shards.

### Satchel Integration

- **Validity Filter** — Pack logic respects sequentiality. For Climb parents, only the first incomplete child is packable. **Implementation:** Postgres RPC (not client-side). DB returns only packable node IDs. Single source of truth; avoids round-trip death with 500+ shards.
- **Next-In-Line Promotion** — Burn X → next sibling becomes packable. No user decision required.
- **UI for locked steps** — Grey or hide locked steps in Climb parents.

### Terminology

- **The Grove (Survey)** — All children available; pick any when ready.
- **The Staircase (Climb)** — Children locked; only first incomplete is packable.

### Rune Terminology & Visualization

*Planned. Reinforces the fire ritual: packable = burnable = rune.*

| Node | Has children? | User-facing term | Visual |
|------|---------------|------------------|--------|
| Boulder | No pebbles | **Rune Boulder** | Rune stone style |
| Boulder | Has pebbles | Boulder (container) | Non-rune / landmark |
| Pebble | No shards | **Rune Pebble** | Rune stone style |
| Pebble | Has shards | Pebble (container) | Non-rune / landmark |
| Shard | (always leaf) | **Rune Shard** | Rune stone style |

**Purpose:** Rune = packable = burnable. Distinct rune visualization lets users connect "this goes in the Satchel" and "this fuels the fire." Containers (landmarks) use a different visual so they're clearly not packable.

**The "Awakening" moment:** When the Hammer shatters a Landmark (container) into its final leaves, the visual should shift from "Dull Stone" to "Glowing Rune." Immediate feedback: "This is now actionable." **Feasibility cheat:** Dull = 40% opacity, greyscale. Rune = 100% opacity, subtle outer glow (Shadow), pulse. No 50 custom assets.

**Landmark visual:** Containers should look like ancestry or structural elements—etched into the base of the mountain path, weathered monoliths that stay fixed. Only Runes lift off the screen into the Satchel.

**Elias / copy:** When referring to packable/burnable items, use "rune stone," "rune pebble," etc. to reinforce the theme.

**Technical guardrail:** `NodeRepository` (or equivalent) must have `isPackable(node)` that strictly checks `child_count == 0`. Prevents Landmarks from ever ending up in the Satchel.

### Feasibility Refinements (Golden Path MVP)

*Locked decisions to keep implementation manageable and preserve "smooth and gamified" feel.*

| Refinement | Decision | Rationale |
|------------|----------|-----------|
| **Validity Filter** | **Postgres RPC**, not client-side. DB returns only packable node IDs. | 500 shards across 10 boulders = round-trips kill the vibe. Single source of truth; Flutter stays clean. |
| **Depth cap** | **3 levels max:** Peak → Boulder → (Sub-Boulder) → Pebble. UI limits nesting even if LTREE allows more. | Prevents "cozy app" from becoming Jira. Tree rendering manageable; user never lost in their mountain. |
| **Rune visuals** | **Opacity/glow trick** — no 50 hand-drawn assets. Dull Stone: 40% opacity, greyscale. Rune: 100% opacity, subtle outer glow (Shadow), pulse. | Achieves "Awakening" without custom asset explosion. |
| **Hammer shatter** | **High-impact** — when packing is restricted to leaves, the Hammer animation for shattering a container must feel rewarding. | Leaf-only packing is the secret sauce; shattering is the payoff. |
| **Demo mode** | **Repository pattern** — UI talks to `DataRepository`. `SupabaseRepository` vs `MockLocalRepository` = simple toggle. | Avoids maintaining two implementations; Demo is a swap, not a rewrite. |

**Refined MVP scope:** Fixed 3-level hierarchy (Peak → Boulder → Pebble, with optional Sub-Boulder). Leaf-only packing. Basic glow/opacity for Rune status. Postgres RPC for packable candidates.

### Sanctuary Priority Map (Pre-Flight)

*Implementation order for Logic & Leaf. See [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md) for full detail.*

| Gap | Urgency | Fix Strategy |
|-----|---------|--------------|
| **RPC Spec** | 🔴 Critical | Write the SQL function logic. It's the engine. [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md) |
| **Shard Schema** | 🔴 Critical | Run migration for shard completion behavior + trigger. Schema has columns; add trigger. |
| **Repository Audit** | 🟡 Medium | Find every `Supabase.instance` call; wrap in provider. Repository pattern for Demo. |
| **Progress Calc** | 🟡 Medium | Use Generated Column, View, or Function in Postgres. Don't calculate on device. |

### Planned Refactor: Climb "First Blockage" Rule

*Documentation only. Not yet implemented. See [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md) § First Blockage.*

**Problem:** The current `get_packable_candidates` RPC gates Climb layout on the *first incomplete top-level boulder* (`nlevel = 2`). If "Organize House" has Office (complete) and Kitchen (incomplete), but Kitchen has sub-boulders (Clean Fridge, Organize Pantry), the system won't "peek" into those sub-boulders. Finishing the last pebble of Office leaves the user stuck—Kitchen's leaves under sub-boulders never become packable.

**Solution: The "First Blockage" Rule.** In a Climb, the user should only see leaves belonging to the **First Blockage** in the journey.

| Concept | Definition |
|---------|-------------|
| **Highest Incomplete Ancestor** | The node with lowest depth and lowest `order_index` that is `is_complete = false`. |
| **First-Child-First Traversal** | Start at root; take first child by `order_index`; recurse until an incomplete node is found. That node is the **Gatekeeper**. |
| **Root for unlocked CTE** | The Gatekeeper becomes the root. Recursion starts at `Gatekeeper.path` and descends to leaves. |

**Visual Flow:**

| Level | Node | Status | Result |
|-------|------|--------|--------|
| Depth 2 | Office | Complete | Skip to next sibling. |
| Depth 2 | Kitchen | Incomplete | Gatekeeper found. |
| Depth 3 | Clean Fridge | Complete | Skip to next sibling. |
| Depth 3 | Organize Pantry | Incomplete | New sub-gatekeeper. |
| Leaf | Toss Expired Flour | Incomplete | **PACKABLE CANDIDATE.** |

**Technical Implications:**

- **Ordering:** Strict depth-first. A child's `order_index` matters only relative to its siblings.
- **Performance:** Use LTREE index; once gatekeeper is identified, `path <@ gatekeeper.path` grabs the subtree.
- **Survey exception:** This refactor applies **only to Climb**. Survey remains unchanged—every incomplete top-level boulder is a root; all branches wide open.

**Implementation Strategy:** Build the "Highest Incomplete" logic as a standalone CTE first. Ensure Survey is never accidentally "Climb-ified."

---

## Related Docs

**Project Stack (construction orders):**
- [GRACE_DAY_STREAK_SPEC.md](GRACE_DAY_STREAK_SPEC.md) — Grace Day Streak (Option A Freeze)
- [SATCHEL_PACK_ANIMATION_SPEC.md](SATCHEL_PACK_ANIMATION_SPEC.md) — Stones arc into Satchel
- [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md) — Technical fixes, schema, terminology
- [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) — Pre-implementation audit, locked decisions

**Blueprint & specs:**
- [ALIGNMENT_OUTCOME_SPEC.md](ALIGNMENT_OUTCOME_SPEC.md) — Target experience (authoritative)
- [NAVIGATION_MAP.md](NAVIGATION_MAP.md) — Routes, screens, user-facing terminology (blueprint)
- [PEAK_PLANTING_WIZARD_SPEC.md](PEAK_PLANTING_WIZARD_SPEC.md) — New Journey wizard (state-based reveal, animations)
- [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md) — 5-beat cinematic intro (Forest Threshold fade, Satchel, Hammer, Hearth → Map Bridge → Wizard)
- [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md) — **Elias dialogue hub.** Quick map, full catalogue, tone, `elias_dialogue.dart`. Includes **Map Bridge** (consult the map / path is set) and **Sanctuary Home Intro** (first-run Satchel → Path Ahead → Firepit); wire those flows from this doc.
- [ELIAS_VOICE_GUIDE.md](ELIAS_VOICE_GUIDE.md) — **Elias voice bible.** AI dialogue generation, tone rules, `scripts/generate_elias_dialogue.py`
- [WHETSTONE_CHOICE_OVERLAY_SPEC.md](WHETSTONE_CHOICE_OVERLAY_SPEC.md) — Whetstone bubble tail overlay (Sharpen Habits / Refine Path)
- [HAMMER_REFINE_MODAL_SPEC.md](HAMMER_REFINE_MODAL_SPEC.md) — Hammer (Refine modal) — shatter boulders into pebbles
- [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md) — Validity Filter RPC, Shard Burn, Hammer context, Mallet menu, Forest Threshold
- [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md) — `get_packable_candidates` SQL spec
- [PROGRESS_CALC_SPEC.md](PROGRESS_CALC_SPEC.md) — `get_peak_progress` (completed_leaves, total_leaves)
- [DEMO_MODE_LOGIC_LEAF.md](DEMO_MODE_LOGIC_LEAF.md) — Demo pack heuristic (leaf-only; Layout/Sequential = Sanctuary-only)
- [PEAK_JOURNAL_SPEC.md](PEAK_JOURNAL_SPEC.md) — Peak Journal (Mountain Detail) — technical ledger, Hero Zoom, Map refactor

**Other:**
- **Logic & Leaf Protocol** — See [§ Logic & Leaf Protocol](#logic--leaf-protocol-conceptual-spec) above. Sub-boulders, shards as tasks, Validity Filter, leaf-only packing, Rune terminology.
- [LOGIC_LEAF_PROTOCOL_AUDIT.md](LOGIC_LEAF_PROTOCOL_AUDIT.md) — Full audit of docs for Logic & Leaf consistency
- [RUNE_TERMINOLOGY_AUDIT.md](RUNE_TERMINOLOGY_AUDIT.md) — Rune = packable = burnable; questions, concerns, doc updates
- [FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md](FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE.md) — P0/P1/P2 feature spec
- [PROJECT_PLAN_REFINE_AND_POLISH.md](PROJECT_PLAN_REFINE_AND_POLISH.md) — Refine & Polish decisions
- [SMOKE_TEST_ISSUES_AND_FIXES.md](SMOKE_TEST_ISSUES_AND_FIXES.md) — Issue log and constraints
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) — Manual test steps
- [RLS_VERIFICATION.md](RLS_VERIFICATION.md) — RLS test procedure
- [MASTER_PLAN_AUDIT_REPORT.md](MASTER_PLAN_AUDIT_REPORT.md) — Full audit (inconsistencies, recommendations)
- [VOYAGER_SANCTUARY_UI_AUDIT.md](VOYAGER_SANCTUARY_UI_AUDIT.md) — **UI/UX audit.** Button overflow, Return to Sanctuary wrapping, Step 5 labels, descriptions, wizard nav pattern.
- [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md) — **Legacy** (4 landmarks). Superseded by ALIGNMENT_OUTCOME_SPEC.

---

**End of Master Plan.**
