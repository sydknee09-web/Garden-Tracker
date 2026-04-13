# VOYAGER SANCTUARY — PROJECT PLAN
**Status:** Active  
**Date Initiated:** March 11, 2026  
**Stack:** Flutter · Supabase (LTREE) · Riverpod  
**Platform Target:** iOS + Android (mobile-first)

---

## DESIGN AESTHETIC — THE NORTH STAR

> **"Refined Architectural Luxury meets Hotel Executive."**

Marble. Aged leather. Boucle texture. Worn parchment. The app must feel like a high-end leather-bound planner, not a productivity tool. Every color, font, animation, and spacing decision is filtered through this lens. If it feels "app-like," rethink it. If it feels like a room you want to sit in, keep it.

---

## GUIDING PHILOSOPHY

> "Small verified chunks. Never build what you cannot test."

Every phase ends with a testable, shippable milestone. Nothing is merged to the next phase until the current phase's acceptance tests pass on a real device (or emulator). We build bottom-up: data models first, state layer second, UI last.

---

## PHASE 0 — ENVIRONMENT & REPO SETUP
**Goal:** Every dependency installed, app boots to a blank screen.

### Tasks
- [x] Install Flutter SDK (stable channel), verify `flutter doctor` clean
- [x] Install Supabase CLI
- [x] Create new Flutter project: `voyager_sanctuary`
- [x] Add dependencies to `pubspec.yaml`:
  - `supabase_flutter`
  - `flutter_riverpod` / `riverpod_annotation`
  - `riverpod_generator` (code gen)
  - `go_router` (navigation)
  - ~~`isar`~~ **(DEFERRED — online-only MVP. No local cache.)**
  - `flutter_animate` (hearth burn effect, stone animations)
  - `shared_preferences` (local time-of-day state)
  - `intl` (date/time formatting)
- [x] Configure `.env` / `--dart-define` for Supabase URL + anon key
- [x] Add `.gitignore` entries for secrets
- [x] Initialize git repository with `main` + `dev` branches
- [x] Confirm `flutter run` produces blank MaterialApp on device/emulator

**Exit Criteria:** `flutter run` boots clean. No errors in `flutter doctor`.

---

## PHASE 1 — SUPABASE SCHEMA & BACKEND
**Goal:** All tables exist. Row-Level Security enforced. LTREE hierarchy works.

### Tasks
- [x] Enable `ltree` extension in Supabase SQL editor
- [x] Create `users` profile table (extends Supabase auth)
- [x] Create `mountains` table
- [x] Create `nodes` table (Boulders + Pebbles via LTREE `path` column)
- [x] Create `whetstone_items` table (recurring habits/rituals)
- [x] Create `whetstone_completions` table (daily check-off records)
- [x] Create `satchel` table or view (top-6 query by priority) — *satchel_slots*
- [x] Write RLS policies for every table (user-scoped only)
- [ ] Write Supabase Edge Functions (if needed): midnight sweep, priority query
- [x] Validate LTREE ancestor/descendant queries work

**Exit Criteria:** Supabase Table Editor shows all tables. RLS policies active. Test queries return correct hierarchical data.

---

## PHASE 2 — DATA LAYER (REPOSITORIES)
**Goal:** Flutter can read/write every table. No UI yet.

### Tasks
- [x] Create `SupabaseService` singleton (initialized at app start)
- [x] Create `MountainRepository` (CRUD mountains)
- [x] Create `NodeRepository` (CRUD nodes, LTREE path management)
- [x] Create `SatchelRepository` (priority-ordered top-6 query)
- [x] Create `WhetstoneRepository` (habits CRUD + daily completions)
- [x] Write unit tests for priority sort: Due Date > Starred > FIFO
- [x] Write unit test for LTREE path generation on split/shatter
- [x] Write unit test for Whetstone midnight reset logic (date boundary)

**Exit Criteria:** All repository unit tests pass. `flutter test` green.

---

## PHASE 3 — STATE MANAGEMENT (RIVERPOD PROVIDERS)
**Goal:** App state wired. No UI yet.

### Tasks
- [x] `TimeOfDayProvider` — watches device clock, emits `DayPeriod` enum (Dawn/Midday/Sunset/Night)
- [x] `AuthProvider` — Supabase auth state stream
- [x] `MountainListProvider` — live stream of user's mountains
- [x] `NodeProvider(mountainId)` — live stream of nodes for a mountain
- [x] `SatchelProvider` — state for 6-slot bag (including empty slot logic)
- [x] `WhetstoneProvider` — habits + completions for selected date
- [x] `ActiveDayProvider` — Yesterday / Today / Tomorrow selector state — *via WhetstoneState.selectedOffset*
- [x] Wire providers to repositories

**Exit Criteria:** `flutter test` on provider logic passes. No business logic in widget files.

---

## PHASE 4 — CORE SCREENS (SKELETON)
**Goal:** Every screen navigable with placeholder content.

### Tasks
- [x] `EntranceScreen` — time-of-day background (4 variants), boots to Sanctuary
- [x] `SanctuaryScreen` — static campsite layout (Elias, Hearth, Whetstone icon, Satchel icon, Scroll icon)
- [x] `ScrollMapScreen` — vertical list of mountains, `[+]` button
- [x] `SatchelScreen` — 6-slot grid view
- [x] `WhetstoneScreen` — checklist + Yesterday/Today/Tomorrow slider
- [x] `ManagementMenuSheet` — bottom sheet (Pack Satchel, Settings, Archive Recovery)
- [x] Set up `go_router` routes for all screens
- [x] Confirm back-nav and deep-link structure
- [x] Screen titles in app bar (e.g. "The Scroll", "Your Satchel", "Whetstone") so users know where they are
- [x] Breadcrumb trail for nested screens (e.g. Sanctuary > The Scroll) where depth warrants it

**Exit Criteria:** Every screen reachable by tapping. No crashes. Placeholder text visible. Navigation context clear (titles + breadcrumbs).

---

## PHASE 5 — THE MALLET TOOL (CORE INTERACTION)
**Goal:** Architect mode with drag-and-drop hierarchy building.

### The Hierarchy *(final)*
```
Mountain -> Boulder (Landmark) -> Pebble (Task) -> Shard (Visual note, never completable)
```
- **Shard is kept.** Visual-only breakdown under a Pebble — like sub-bullets. Never enters the Satchel, never burns in the Hearth, no `is_complete` state.
- When a parent Pebble burns, all its Shards are deleted automatically.
- Only **Pebbles** enter the Satchel and are burned in the Hearth.

### Mallet UX — Always visible
Architect (hammer) FAB is **always visible** on the Scroll screen — never hidden. Tapping it toggles active/inactive state only.

### Tasks
- [x] Implement "Architect mode" toggle (FAB always visible; tap activates/deactivates)
- [x] In architect mode: Mallet on Mountain path creates Boulder, naming dialog opens
- [x] In architect mode: Mallet on Boulder creates Pebble, naming dialog opens
- [x] In architect mode: Mallet on Pebble creates Shard (visual note), naming dialog opens
- [x] Mallet on Shard splits into 2 Shards, clones metadata
- [x] Metadata clone rule: `is_starred` + `due_date` always cloned. New node title = empty.
- [x] Architect mode stays on until user taps Architect FAB again
- [x] Verify star/due-date inheritance on split (Test #2 from First Five)
- [x] Write integration test for full Mallet flow

**Exit Criteria:** Architect mode toggle works. Full Mallet flow works end-to-end. Split always inherits metadata.

---

## PHASE 6 — THE SATCHEL SYSTEM
**Goal:** 6-slot bag works with manual refill and correct priority ordering.

### Tasks
- [x] Implement Satchel slot UI (6 fixed slots, empty slot visual)
- [x] Implement "Pack Satchel" flow from Elias tap, query, fill slots
- [x] Enforce capacity: NO auto-refill after burn
- [x] Priority queue implementation: Due Date -> Starred -> FIFO
- [x] Check-off flow: mark Done in Satchel, stone becomes draggable in Sanctuary, drop in Hearth to complete
- [x] Pack fills slots 1-6 in order; remove/confirm dialog; swipe left = remove, swipe right = done
- [x] Verify starred pebble jumps to slot #1 on pack (Test #3)
- [x] Verify burned slot stays empty (Test #4)

**Exit Criteria:** Tests #3 and #4 from First Five pass.

---

## PHASE 7 — THE HEARTH (COMPLETION)
**Goal:** Drop-zone works. Task burned and slot goes empty.

### Tasks
- [x] Implement `HearthWidget` as `DragTarget`
- [x] On stone drop: trigger burn/shatter animation (`flutter_animate`)
- [x] On animation complete: delete node from Supabase, increment mountain progress
- [x] Clear satchel slot (do NOT auto-refill)
- [x] Update mountain progress bar in Scroll Map

**Exit Criteria:** Drag-to-hearth removes task, slot stays empty, progress bar increments.

---

## PHASE 8 — THE WHETSTONE SYSTEM
**Goal:** Habits checklist with midnight reset fully working.

### Tasks
- [x] Implement `WhetstoneScreen` with vertical checklist
- [x] Implement Yesterday/Today/Tomorrow slider
- [x] Implement `WhetstoneCompletionRepository` upsert by `(user_id, item_id, date)`
- [x] Add/remove/edit habits; swipe right = mark done, swipe left = remove (with confirm)
- [x] Midnight timer in `WhetstoneNotifier` refreshes completions at local midnight
- [x] `AppLifecycleState.resumed` wired in root `app.dart` via `onAppResume()`
- [x] Verify midnight sweep (Test #5 from First Five)

**Exit Criteria:** Test #5 from First Five passes.

---

## PHASE 9 — TIME-OF-DAY ENGINE & ELIAS
**Goal:** Entrance screen, backgrounds, and Elias pose all update with device clock.

### Asset drop locations *(owner provides; folders exist in `assets/`)*
| Location | Filename | Time window / description |
|----------|----------|---------------------------|
| `assets/backgrounds/` | `dawn.png` | 5 am - 10 am |
| | `midday.png` | 10 am - 5 pm |
| | `sunset.png` | 5 pm - 8 pm |
| | `night.png` | 8 pm - 5 am |
| `assets/elias/` | `elias_dawn.png` | Standing, looking at horizon |
| | `elias_midday.png` | Upright, alert |
| | `elias_sunset.png` | Seated, contemplative, watching fire |
| | `elias_night.png` | Seated by fire, quiet presence |

PNG with transparency preferred. Any resolution — Flutter scales. Wire `Image.asset()` once files are in place.

### Tasks
- [x] `ScenePeriod` enum: Dawn (5-10), Midday (10-17), Sunset (17-20), Night (20-5)
- [x] `TimeOfDayProvider` polls system clock, emits `ScenePeriod` per minute
- [x] Background gradients per period (placeholder until real assets dropped in)
- [x] Elias silhouette painter — period-aware glow (placeholder until real sprites dropped in)
- [x] Elias greeting: randomized pool of warm messages per period
- [x] Wire real background `Image.asset()` once owner drops files into `assets/backgrounds/`
- [x] Wire real Elias `Image.asset()` once owner drops files into `assets/elias/`
- [x] Verify Dawn to Midday transition (Test #1 from First Five)

**Note:** Full **Elias speech bubbles / conversation** (text only, contextual messages) is built in **Phase 12**.

**Exit Criteria:** Test #1 from First Five passes.

---

## PHASE 10 — MOUNTAIN MANAGEMENT
**Goal:** Add, rename, archive mountains from the Scroll Map. Cap enforced at 3 active.

### Tasks
- [x] `[+]` button creates new mountain (name input dialog)
- [x] Cap enforcement: before creating, count active mountains. If >= 3, disable `[+]` and show cap message.
- [x] Long-press mountain, context menu (Rename / Archive) — implemented as more_vert icon + bottom sheet
- [x] Archive: soft-delete (`is_archived = true`), hidden from active Scroll Map
- [x] Archive Recovery in Management Menu (restore sets `is_archived = false`)
- [x] Mountain progress bar: `(burned_pebbles / total_pebbles) * 100` — Pebbles only
- [x] **Mountain path visual** — `_MountainTrailBody` renders boulders as circle waypoints on a vertical trail line; pebbles as smaller branch dots; shards as indented sub-bullets. Replaces the flat card/list layout.

**Exit Criteria:** Full mountain lifecycle works. Archive/restore confirmed. Cap blocks 4th mountain.

---

## PHASE 11 — AUTHENTICATION
**Goal:** User accounts, login, logout.

### Tasks
- [x] Supabase Auth: email/password sign-in and sign-up
- [x] `AuthScreen` — combined sign-in / create-account with mode toggle
- [x] Auth guard on all app routes (redirect to auth if unauthenticated)
- [x] `AuthProvider` state drives go_router redirect
- [x] Settings screen — shows signed-in email, Sign Out with confirmation dialog
- [ ] Confirm RLS: two separate test accounts cannot see each other's data (steps: [docs/RLS_VERIFICATION.md](docs/RLS_VERIFICATION.md))

**Exit Criteria:** Two separate test accounts cannot see each other's data.

---

## PHASE 12 — POLISH & ANIMATIONS
**Goal:** App feels alive and intentional.

### Tasks
- [x] **Elias speech bubbles / conversation** — `EliasDialogue` content module + `eliasMessageProvider` (StateProvider). `_EliasBubble` + `_SpeechBubble` in SanctuaryScreen; auto-dismisses after 4 s. Triggers: tap Elias → `onTap()`; burn stone → `afterBurn()`; pack satchel → `afterPack()`.
- [x] Wire real background `Image.asset()` (see Phase 9 asset table)
- [x] Wire real Elias `Image.asset()` (see Phase 9 asset table)
- [x] Hearth burn/shatter animation tuned
- [ ] Satchel pack animation (stones flying into bag)
- [ ] Scroll Map: mountain path visual polish (Phase 10 builds function; Phase 12 polishes)
- [ ] Mallet cursor/drag shadow
- [ ] Elias idle animation (subtle breathing or blinking loop)
- [ ] Background parallax or ambient particle effect (campfire smoke, etc.)
- [ ] Typography and color system formalized
- [x] Haptics on key interactions (burn, pack)

---

## PHASE 13 — OFFLINE SUPPORT & SYNC *(Post-v1 — Deferred)*
**Goal:** App usable without network. Syncs when back online.
**Status:** DEFERRED. MVP is online-only. This phase activates after v1 launch.

### Tasks (when activated)
- [ ] Add Isar as local embedded DB
- [ ] Mirror Supabase tables locally (mountains, nodes, satchel_slots, whetstone)
- [ ] Optimistic updates on all writes
- [ ] Conflict resolution strategy (last-write-wins for MVP)
- [ ] "Offline mode" banner in UI

---

## PHASE 14 — QA & RELEASE PREP
**Goal:** App store submission ready.

### Tasks
- [ ] Full First Five test suite passes on physical device (iOS + Android)
- [ ] Edge cases documented and tested (empty satchel, 0 mountains, etc.)
- [ ] Performance audit: 60fps on mid-range device
- [ ] App icons, splash screen, store assets
- [ ] `flutter build appbundle` and `flutter build ipa` clean
- [ ] Submit to TestFlight and Google Play Internal Testing

---

## OPEN QUESTIONS — RESOLVED

1. **Auth at launch or optional?** -> **Login required.** No guest mode. Implemented.
2. **Asset style / do you have assets?** -> **Owner has assets — will provide.** Drop into `assets/backgrounds/` and `assets/elias/` (see Phase 9 table). PNG with transparency preferred.
3. **Elias appearance?** -> **Owner has the art.** See Phase 9 asset table. Silhouette painter auto-replaced when real images land.
4. **Mountain metaphor depth?** -> **Literal mountain-path visual.** Build `MountainPathWidget` in Phase 10 — boulders/pebbles as waypoints on a trail. Current flat bar is interim.
5. **Offline-first priority?** -> **Post-launch.** Phase 13 deferred. MVP is online-only.
6. **Whetstone items — fixed or editable?** -> **Fully editable: add / remove / edit.** Implemented.
7. **Push notifications?** -> **Not in MVP.** Deferred.
8. **Multi-device sync?** -> **Not a concern.** Supabase persists server-side; second-device login sees same data. Real-time cross-device sync not required Day 1.
9. **The Mallet — always visible?** -> **Always visible.** Architect FAB permanently present on Scroll; only active/inactive state.
10. **Node depth limit — can a Pebble be split?** -> **Shard is kept.** Mallet on Pebble creates Shards (visual-only notes). Shards never enter the Satchel or Hearth. Burning a Pebble auto-deletes its Shards. Final hierarchy: Mountain -> Boulder -> Pebble -> Shard.
