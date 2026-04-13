# Climb New Mountain — Full Specification

This document fully specifies the guided "Climb New Mountain" flow so it can be implemented end-to-end and you can move on to the next process. It replaces the current "Name This Mountain" dialog with a narrative, step-by-step experience led by Elias.

---

## 1. Goals

- User taps **"Climb New Mountain"** (or "Ascend a New Peak") and is guided through: **name peak → name 4 landmarks → break each landmark into pebbles with the hammer**, with Elias dialogue at each step.
- **Return to Map** is always available (Compass) so the user can exit at any time; partial progress is saved.
- The flow uses existing Supabase APIs (`mountains` + `nodes`); no schema change required.
- Feel like a **polished, guided game**: one step at a time, clear copy, tactile feedback (e.g. rock_break sound when adding a pebble).

---

## 2. Preconditions and Entry

**Where the flow is triggered**

- **Primary:** A button at the **bottom** of the Scroll/Map content area: **"Climb New Mountain"** (or "Ascend a New Peak"). Visible when the user has at least one mountain (so the Scroll has content) and **can** add another (active count &lt; 3).
- **Secondary:** When there are **no mountains**, the existing empty state already has "Open a New Path"; that action can open this same guided flow instead of the current dialog.
- **Optional:** The app bar **+** button (when `canAddMountainProvider` is true) can also open this flow instead of the current `_showAddMountainDialog`.

**Cap check**

- Before opening the flow, read `canAddMountainProvider`. If false (already 3 active mountains), show the existing SnackBar: "You are climbing 3 mountains. Archive one before opening a new path." and do **not** open the flow.

**Data used**

- `mountainActionsProvider` (create, rename)
- `nodeActionsProvider` (createBoulder, createPebble)
- `nodeListProvider(mountainId)` to refresh after creates
- `canAddMountainProvider` for gate

---

## 3. State Model for the Flow

Hold flow state in a **single stateful widget or a Riverpod notifier** so it survives rebuilds and can be passed to overlay children. Suggested fields:

| Field | Type | Purpose |
|-------|------|--------|
| `step` | enum or int | 1 = Peak, 2 = Landmarks, 3 = Pebbles (hammer) |
| `mountainId` | String? | Set after Step 1 confirm; null until then |
| `mountainName` | String | Peak name (for display and Elias tokens) |
| `boulderIds` | List<String> | IDs of the 4 boulders created in Step 2, in order |
| `landmarkNames` | List<String> | Titles of the 4 landmarks (for display) |
| `pebbleStepBoulderIndex` | int | In Step 3: which landmark (0–3) we are currently breaking into pebbles |
| `lastEliasKey` | String? | Optional: last dialogue key used, to avoid repeating the same line |

When the user taps **Return to Map**, close the overlay and **do not** reset the rest of the app; any created mountain/boulders/pebbles remain in the DB.

---

## 4. Step-by-Step Flow

### Step 1 — Name the Peak

**Screen**

- Full-screen overlay on top of the Scroll (dimmed campfire or semi-transparent dark overlay so the scene is still faintly visible).
- **Top-right:** Compass icon button. Label or tooltip: "Return to Map". Tapping it closes the overlay and returns to the Scroll; nothing is saved (no mountain created yet).
- **Center / upper-center:** Large Elias portrait (reuse `EliasWidget` with larger width/height, e.g. 140×210; no greeting text in this context, or a single dialogue line only).
- **Elias line:** One sentence from the **peak prompt** pool (see Dialogue section). Example: "Which peak has caught your eye today, traveler?" or "Mighty fine one you've got your eyes set on. What do they call this peak?"
- **Input:** Single text field (or "gold line" style: thin underline, wide letter-spacing). Placeholder or hint: e.g. "e.g. CPA Exam, Home Renovation"
- **Subtext (small, below input):** "This is your primary objective."
- **Buttons:**
  - **Primary:** "Continue" or "Set the Peak". On tap: validate non-empty trim; then call `mountainActionsProvider.create(name: trimmedName)`; on success set `mountainId` and `mountainName`, move to Step 2; on failure show SnackBar and stay.
  - **Secondary (optional):** "Return to Map" (same as Compass).

**Validation**

- If the user taps Continue with empty or whitespace-only name, show inline error or SnackBar: "Give the peak a name." Do not call create.

**API**

- `Mountain created = await ref.read(mountainActionsProvider).create(name: peakName)`  
- `MountainRepository.create` already returns the created `Mountain` (Supabase `.insert().select().single()`). Set `mountainId = created.id` and `mountainName = created.name`. Optionally `ref.refresh(mountainListProvider)`.

---

### Step 2 — Name the Four Landmarks

**Screen**

- Same overlay style. Compass again top-right.
- **Elias line:** From **landmarks prompt** pool. Example: "A mountain isn't conquered in a single stride. What are the four landmarks we'll need to reach to stand at the top?"
- **Subtext:** "Define the four major phases of this journey. You can add more later."
- **Content:** Four distinct "stones" or cards, each with a text field (or one at a time: "Landmark 1", "Landmark 2", …). Order is fixed (Landmark 1 … 4).
- **Buttons:**
  - **Primary:** "Continue" or "Clear the Path". On tap: for each of the four titles (non-empty), call `nodeActionsProvider.createBoulder(mountainId: mountainId, title: title)` and collect the returned node IDs into `boulderIds` and titles into `landmarkNames`. If any title is empty, show validation and do not proceed. On success move to Step 3.
  - **Return to Map:** Close overlay; mountain and any boulders already created remain.

**Validation**

- All four landmark names must be non-empty (trim). If not, show "Name all four landmarks." or per-field validation.

**API**

- Four calls: `createBoulder(mountainId: mountainId, title: landmarkName)` for each of the 4 names. Store the 4 returned `Node.id` values in `boulderIds` in order.

**Layout (Square of Four)**

- **Desktop:** The four landmark stones are laid out in a **2×2 grid** or a **diamond** (four corners). Keeps the "Square of Four" visually clear and structurally consistent.
- **Mobile:** The four stones use a **vertical zig-zag** (alternating left/right or stepped) so they fit narrow viewports without crowding.
- **Rationale:** Exactly four landmarks act as the **"corner posts"** of the climb — they give the UI structural integrity. The **pebbles** (the actual work) can vary in number and size per landmark; the four stones are the fixed frame.

**Optional variant**

- Instead of four fields on one screen, you can do "one landmark at a time": show one input, "Landmark 1 of 4", then on confirm create that boulder and show "Landmark 2 of 4", etc. Same API; different UX.

---

### Step 3 — Break Stones into Pebbles (Hammer)

**Screen**

- Same overlay. Compass top-right.
- **Elias line:** From **pebbles prompt** pool. Example: "Now let's clear a path. Pick a stone and break it into pebbles we can carry." Or: "Steady hands. Break this stone into pebbles."
- **Subtext:** "Break this phase into small, manageable tasks."
- **Visual:** Show the four landmarks as **tappable "stones"** (cards or circles). The **current** stone (index `pebbleStepBoulderIndex`) is the one we're adding pebbles to; it can be highlighted or labeled "Adding pebbles here" or similar. The user **taps** a stone to add a pebble under it (hammer metaphor: tap = strike).

**Strike animation (code-only, reuse mallet.png)**

- **Asset:** Reuse `assets/mallet/mallet.png`. No new frame or "strike" image; keeps the bundle light.
- **Swing:** Quick `Transform.rotate` from **-45° to 10°** so the mallet visibly swings toward the stone.
- **Impact:** On hit: **5ms haptic** vibration; **stone scale** up briefly to **1.05** then back to 1.0.
- **Exit:** **Fade the mallet out** immediately after impact (no lingering sprite).

This gives high-impact "juice" without a separate strike asset.

**Interaction**

- When the user taps a landmark stone:
  - Call `nodeActionsProvider.createPebble(mountainId: mountainId, boulderId: boulderIds[index], title: '')` to create an unnamed pebble (or open a small prompt first, see below).
  - Then show a **naming prompt** for that pebble (dialog or inline): "Name this pebble" / "e.g. Research vendors". On confirm call `nodeActionsProvider.updateTitle(id: pebbleNode.id, title: trimmedName)`.
  - Optional: play **rock_break** sound on create.
  - Refresh: `ref.refresh(nodeListProvider(mountainId))`.

**Two UX variants**

- **A — Tap stone → immediate name dialog:** Tap stone → create pebble with empty title → show "Name this pebble" dialog → on save, updateTitle. Then show Elias line: "Another? Tap the same stone again or choose another."
- **B — Tap stone → name first:** Tap stone → show "Name this pebble" dialog first → on confirm create pebble with that title (single createPebble with title). Then rock_break and refresh.

**After each pebble**

- Show short Elias line from **pebble added** pool (e.g. "One more strike." / "Label the next one."). Then either:
  - **Same stone:** User can tap the same stone again to add another pebble (repeat).
  - **Next stone:** User taps a different stone to add pebbles there.
  - **Done with this stone:** A button "Done with this landmark" or "Next landmark" advances `pebbleStepBoulderIndex` and updates Elias to "Break the next stone into pebbles?" or similar.
  - **Return to Map:** Close overlay; all created pebbles remain.

**Bottom actions**

- **"Done with this landmark"** or **"Next stone"**: Increment `pebbleStepBoulderIndex`. If now &gt;= 4, show Elias: "Path is clear. Return to your map when you're ready." and show a single **"Return to Map"** primary button that closes the overlay.
- **"Return to Map"** (always visible): Close overlay and return to Scroll.

**API**

- `createPebble(mountainId, boulderId, title)` for each pebble.
- `updateTitle(id, title)` if you create with empty title first.
- Optional: `ref.refresh(nodeListProvider(mountainId))` after each create so the main Scroll view could theoretically show live updates if you ever show the map behind the overlay.

---

## 5. Elias Dialogue Pools

Extend [lib/core/content/elias_dialogue.dart](lib/core/content/elias_dialogue.dart) (or add a Supabase table later) with the following **keys** and **3–5 variants each**. Use a `_pick` that avoids repeating the same variant twice in a row (e.g. store `lastEliasKey` or last index per step).

| Key | When used | Example variants |
|-----|-----------|-------------------|
| `climbPeakPrompt` | Step 1 | "Which peak has caught your eye today, traveler?" / "Mighty fine one you've got your eyes set on. What do they call this peak?" / "Another climb? What are we calling this one?" |
| `climbLandmarksPrompt` | Step 2 | "A mountain isn't conquered in a single stride. What are the four landmarks we'll need to reach to stand at the top?" / "Name the four great landmarks on the way up." |
| `climbPebblesPrompt` | Step 3 intro | "Now let's clear a path. Pick a stone and break it into pebbles we can carry." / "Steady hands. Break this stone into pebbles." / "Even the heaviest boulder is just a pile of dust waiting to happen. Strike it." |
| `climbPebbleAdded` | After each pebble | "One more strike." / "Label the next one." / "Clear the path, traveler." |
| `climbNextLandmark` | After "Done with this landmark" | "Break the next stone into pebbles?" / "Ready for the next landmark?" |
| `climbAllDone` | When all 4 landmarks have "done" | "Path is clear. Return to your map when you're ready." / "The way is set. Back to the fire when you are." |
| `climbReturnToMap` | When user taps Compass (optional) | "Resting for the night? Your path will be right where you left it." (can show as SnackBar or small tooltip) |

Optional: support a token `{goal_name}` in any string and replace with `mountainName`.

---

## 6. Edge Cases

- **Back button (Android):** Treat as "Return to Map" — pop the overlay and save nothing extra (partial data already saved step-by-step).
- **Empty peak name:** Block Continue and show validation message.
- **Empty landmark name:** Block Continue in Step 2 until all four are non-empty.
- **Network error on create:** Show SnackBar with error; stay on current step so user can retry or tap Return to Map.
- **Return to Map mid–Step 2:** Mountain exists; zero or more boulders may exist. No rollback; user can later add more boulders from the main Scroll (Architect mode) or re-open a future "Edit" flow.
- **Return to Map mid–Step 3:** Mountain + 4 boulders exist; zero or more pebbles. Same: no rollback.
- **3-mountain cap:** Enforced at entry; no need to re-check during the flow because we only create one mountain per run.

---

## 7. UI Layout and Styling

- **Overlay:** `Stack` with a `ModalBarrier` (dimmed) or a semi-transparent `Container` so the Scroll/campfire is still visible. Content in a centered card or padded column.
- **Compass:** `IconButton` with `Icons.explore` or custom asset, `positioned` top-right (e.g. 16 from top and right). On tap: `Navigator.of(context).pop()` or callback to close overlay.
- **Elias:** Reuse `EliasWidget` with `showGreeting: false` and larger size; below that, the dialogue line in a `Text` with `AppColors.parchment`, Georgia, comfortable font size.
- **Inputs:** Single underline or outlined field; `AppColors` for border/focus (ember/gold). Subtext in `AppColors.ashGrey`, smaller font.
- **Buttons:** Primary = filled ember/gold; secondary = outline or text "Return to Map". Use existing `AppColors` and avoid grey/red per project rules.

---

## 8. File and Class Structure (Suggested)

- **Flow state:** Either a `StatefulWidget` state (e.g. `_ClimbFlowOverlayState`) holding step, mountainId, boulderIds, etc., or a `StateNotifier`/`Notifier` (e.g. `ClimbFlowNotifier`) with `ClimbFlowState` and a provider so the overlay and its children can read/update.
- **Entry point:** From [scroll_map_screen.dart](lib/features/scroll_map/scroll_map_screen.dart): when "Climb New Mountain" (or app bar +) is tapped, call `showDialog` or `showGeneralDialog` with `barrierDismissible: false`, and child = your full-screen overlay widget (e.g. `ClimbFlowOverlay`). Alternatively use a full-screen route (e.g. `/scroll/climb`) so the Compass pops the route.
- **Widgets:** One widget per step (e.g. `_ClimbStepPeak`, `_ClimbStepLandmarks`, `_ClimbStepPebbles`) or one `_ClimbStepContent` that switches on `step` and renders the right form. Keep Compass and Elias in a shared layout.
- **Dialogue:** Add methods to `EliasDialogue` like `climbPeakPrompt()`, `climbLandmarksPrompt()`, etc., each returning `_pick(appropriateList)` with optional "no repeat" logic.

---

## 9. MountainRepository.create

`MountainRepository.create(name)` returns `Future<Mountain>` with the inserted row (see [mountain_repository.dart](lib/data/repositories/mountain_repository.dart)). Use `created.id` and `created.name` for flow state.

---

## 10. Definition of Done

- User can tap "Climb New Mountain" from the Scroll (and/or empty state / app bar +).
- Step 1: Elias asks for the peak name; user enters it; Continue creates the mountain and moves to Step 2.
- Step 2: Elias asks for four landmarks; user enters four names; Continue creates four boulders and moves to Step 3.
- Step 3: Four landmarks are shown as tappable stones; user taps one, adds one or more pebbles (with names); can move to "next landmark" or "Return to Map" at any time.
- Compass / "Return to Map" closes the overlay and returns to the Scroll; partial progress is kept.
- Elias dialogue varies (no same line twice in a row where applicable).
- Rock_break sound plays when a pebble is added (optional but recommended).
- No schema changes; all persistence via existing `mountainActionsProvider` and `nodeActionsProvider`.

---

## 11. Link to Broader Plan

This flow is **Phase 3** of the Voyager Sanctuary polish plan. After this is implemented:

- **Phase 4** adds the guided **Edit** flow (refine existing peak/landmark/pebble with Elias).
- **Phase 5** adds the scroll **unfurl** animation when you have the three slice assets.
- Phases 1–2 (time-of-day fade, fire/Elias layout, Scroll visual polish) can be done in parallel or before this.

Use this spec as the single source of truth for the add-goal process so you can move on to the next process with confidence.
