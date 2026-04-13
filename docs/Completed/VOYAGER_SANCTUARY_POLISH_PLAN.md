# Voyager Sanctuary — Polish Plan (Master)

This is the single master plan for turning Voyager Sanctuary into a polished, guided gamified experience. The **map/scroll add-goal process** ("Climb New Mountain") is fully specified in **[CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md)** so you can implement it end-to-end and move on to your next process.

---

## How to Use This Plan

- **Implement in order** by phase, or do Phase 1 + 2 in parallel, then Phase 3.
- **Phase 3 (Climb flow):** Implement strictly from [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md); it contains state model, steps, APIs, dialogue keys, edge cases, and definition of done.
- **Cursor** = Flutter/Dart, schema, UI. **Gemini** = copy/script, image-generation prompts, Elias line variants. **You** = scroll slice images and icons when ready.

---

## Phase 1: Sanctuary Visual Polish

### 1.1 Time-of-day color fade (4 stacked images)

- **Goal:** Keep the 4 period images (Dawn, Day, Dusk, Night) but cross-fade by **opacity** instead of swapping. Stack all four in one `Stack`; drive each layer’s `Opacity` from current time so the "incoming" period fades in over a transition window (e.g. 15–30 minutes).
- **Where:** [lib/features/sanctuary/sanctuary_screen.dart](lib/features/sanctuary/sanctuary_screen.dart) — replace `_Background`’s single `Image.asset` + `AnimatedSwitcher` with four `Positioned.fill` + `Image.asset` + `Opacity(opacity: _blendFor(period, index))`.
- **Logic:** Reuse [lib/providers/time_of_day_provider.dart](lib/providers/time_of_day_provider.dart). Add a value that interpolates between the two bounding periods (e.g. dawn→midday) so opacity sums to 1. Example: `blendDawnMidday = f(currentTime)` in 0..1; `opacityDawn = 1 - blendDawnMidday`, `opacityMidday = blendDawnMidday` during that window; similar for midday→sunset, sunset→night, night→dawn.
- **Campfire:** Leave the hearth as a separate layer on top so the fire stays crisp.

### 1.2 Fire up, Elias larger

- **Where:** Same file — `_HearthWidget` and `_EliasWidget` positioning.
- **Fire:** Increase `bottom` (e.g. from `0.18` to `0.26`–`0.28`) so the hearth sits higher.
- **Elias:** Increase size from 64×96 to e.g. 120×180 or 140×210; keep bottom-left placement; adjust `left`/`bottom` so he is visually **larger than the fire**. Optional: add a warm rim (e.g. `Container` with gradient or soft glow on his right side) so he feels lit by the fire.

### 1.3 Icon legibility

- **Where:** `_SanctuaryIconButton` (Whetstone, The Scroll). Increase icon size/weight or use a stronger color ([lib/core/constants/app_colors.dart](lib/core/constants/app_colors.dart) `sanctuaryIcon` / `gold`) for better contrast on the background.

---

## Phase 2: Scroll/Map Visual Polish

- **Typography:** Increase letter-spacing on "THE SCROLL" and section headers; use a lighter weight for sub-tasks where appropriate. Stay within [AppColors](lib/core/constants/app_colors.dart) (warm espresso, parchment, ember — no grey/red).
- **Progress bars:** In [lib/features/scroll_map/scroll_map_screen.dart](lib/features/scroll_map/scroll_map_screen.dart) `_ProgressBar` (lines 2267–2298): thinner (e.g. 2px), optional soft gradient or "gold thread" look (`LinearGradient` with ember/gold). Keep the percentage label.
- **Vertical connectors:** Slightly thicker (e.g. 2px), subtle glow or gradient; optional slight curve so the path feels less clinical. Connectors are in the trail column (around 1505–1543).
- **Cards:** Increase border radius and padding for mountain sections and inner content.
- **Empty state:** Keep "Open a New Path"; can relabel to "Climb New Mountain" and have it open the Phase 3 flow.

---

## Phase 3: Narrative "Climb New Mountain" Flow (Add Goal)

**Fully specified in [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md).**

Summary:

- **Entry:** "Climb New Mountain" button at bottom of Scroll (and/or app bar +, empty state). Gate: `canAddMountainProvider` (max 3 active mountains).
- **Step 1:** Elias + peak name input + subtext "This is your primary objective." → `mountainActionsProvider.create(name)` → store `mountainId`, `mountainName`.
- **Step 2:** Elias + four landmark names → four `createBoulder(mountainId, title)` → store `boulderIds` and `landmarkNames`.
- **Step 3:** Four tappable "stones" (landmarks); tap → create pebble → name it; optional rock_break sound. "Done with this landmark" / "Next stone" / "Return to Map." When all four landmarks are done, Elias says path is clear and user returns to map.
- **Return to Map (Compass):** Always visible; closes overlay; partial progress is saved.
- **Elias dialogue:** Extend [lib/core/content/elias_dialogue.dart](lib/core/content/elias_dialogue.dart) with climb-specific pools and "no repeat" logic.

Implement exactly per the spec so the add-goal process is complete and you can move on.

---

## Satchel Layout and Whetstone Choice

**Layout: Option B — All-in-One View.** Tapping the bag opens **one screen** (the Satchel screen). No multi-step "open bag then choose."

- **Top:** **Scroll** and **Whetstone** shown as **Tools** — slightly different background and/or larger scale than the slots below so they read as "tools" not "slots."
- **Below:** The **6 standard item slots** (existing satchel slots).

**Rationale:** In a game, "opening your bag" should feel like opening a menu, not starting a multi-step process. All inventory (tools + slots) in one place; cleaner and faster.

**Whetstone tap (from Satchel):** Do **not** use a standard system bottom sheet. Use an **overlay**: the rest of the Satchel **dims slightly**; **Elias** (head/shoulders) **pops up** with a small **parchment-textured speech bubble**. The two buttons (**"Sharpen Habits"** / **"Refine Path"**) sit **inside the bubble** near the original tap point — minimizes eye-travel and thumb movement so the transition feels snappy (thumb-zone efficiency). Parchment/gold styling for buttons.

**Modal barrier:** Use a **BackdropFilter** (e.g. watercolor-style blur) for the dimming, not just a flat grey tint. Keeps the papeterie texture consistent when the overlay is active.

**Bubble copy (pick one or rotate):** "Sharpen the tools, or sharpen the habits?" or the punchier variant for a small bubble: "Sharpen the tool, or the hand that holds it?"

**Wit & grit — entrance animation:** When the overlay appears, give Elias and the bubble a slight **pop/bounce** scale animation: e.g. **scale 0.95 → 1.05 → 1.0**. It makes the character feel like he's leaning into the conversation rather than appearing out of thin air.

- **"Refine path"** → Navigate **directly to the Scroll/Map** with **isRefineMode already set to true**. User lands on the map ready to tap a node and open the Edit overlay.
- **"Daily habits"** → Navigate to the existing WhetstoneScreen (daily habits checklist).

**Sanctuary:** Remove the two floating icon buttons (Whetstone, The Scroll); access to both is via the Satchel only.

---

## Phase 4: Guided "Edit" Flow (Existing Mountain)

- **Trigger:** User enters **Refine mode** by choosing "Refine path" from the Satchel (Whetstone choice). On the Scroll, tapping a node (peak, landmark, or pebble) opens the Edit overlay with Elias.
- **Refine mode stays on:** After the user completes an edit (rename, add pebble, delete), **do not** exit Refine mode. They can tap another node and edit again. **Exit only when:** User taps the Whetstone again ("put the tool away") or leaves the Scroll (e.g. back to Sanctuary/Satchel). **Tool logic:** You don't put the whetstone back after one stroke; you finish the whole job. **UX benefit:** Bulk edit (rename multiple pebbles, adjust landmarks) without reopening the Satchel every time.
- **Flow:** Same overlay pattern as Climb: Elias + "What needs a sharper edge?" (or similar). Context-aware actions: Rename peak/landmark/pebble, Add pebble under this landmark, or Delete (with narrative copy).
- **APIs:** Reuse `mountainActionsProvider.rename`, `nodeActionsProvider.updateTitle`, `createPebble`, `deleteSubtree`.
- **Copy:** Add edit-specific pools (openEdit, afterRename, afterAddPebble, afterDelete) with 2–3 variants. Reuse the same overlay component with `isEdit: true` and step type.

---

## Phase 5: Scroll Unfurl (After You Have Assets)

- **Assets (you provide):** Three PNGs — scroll-top (fixed cap), scroll-body (tileable vertical strip), scroll-bottom (traveling roll). Use Gemini’s prompts; green-screen for masking.
- **Mechanics:** Widget that stacks: (1) top cap fixed at top, (2) body animates height 0 → content height (`AnimatedSize` or `TweenAnimationBuilder`), (3) bottom roll pinned to body’s bottom. Easing: e.g. `Curves.easeOutCubic` or custom cubic `(0.22, 1, 0.36, 1)`. Content opacity 0 until ~80% then fade in. Parchment semi-transparent so campfire remains visible.
- **Where:** Replace or wrap current Scroll content in [lib/features/scroll_map/scroll_map_screen.dart](lib/features/scroll_map/scroll_map_screen.dart); existing `_ScrollRoller` uses scroll_top/scroll_bottom — extend to use the three slices once available.

---

## Phase 6: Assets and Copy

- **Scroll icon, Whetstone icon, isolated Satchel:** Generate per Gemini’s descriptions; add to assets and reference from sanctuary (and optionally from satchel).
- **Scroll slice prompts:** Use Gemini’s three prompts; generate on green/pink for keying; warm campfire lighting, espresso/brass (no red/grey). When PNGs are ready, add to project and implement unfurl per Phase 5.
- **Elias script:** Have Gemini draft 20+ lines for Peak, Landmarks, Pebble, Next/Return, Edit; add to `elias_dialogue.dart` or to a Supabase `elias_dialogue` table later.

---

## What Stays Unchanged

- **Whetstone** = daily "fueling" station (habits, daily reset). Not for editing mountains.
- **Schema:** Peak = mountain, Landmark = boulder, Pebble = pebble (existing `mountains` + `nodes`). Optional `elias_dialogue` table later. No legacy garden-app tables or logic.

---

## Suggested Order of Work

1. **Phase 1** — Time-of-day fade, fire position, Elias size, icon contrast.
2. **Phase 2** — Scroll typography, progress bars, connectors, cards.
3. **Phase 3** — Climb flow from [CLIMB_FLOW_SPEC.md](CLIMB_FLOW_SPEC.md) (fully built out).
4. **Phase 4** — Edit flow with Elias.
5. **Phase 6** — Icons and copy; scroll slices when ready.
6. **Phase 5** — Unfurl when the three scroll PNGs are in the project.

This keeps the app shippable after each phase and lets you move on to your next process once the Climb flow is done.
