# Navigation Map

**Reference guide for app navigation flows.** Do not change these flows without explicit request/approval. When a flow is changed, update this document to reflect the new behavior.

---

## Governance

| Rule | Description |
|------|-------------|
| **No silent changes** | Navigation flows documented here are intentional. Changing them (e.g., redirect targets, modal vs. page, back behavior) requires approval. |
| **Update on change** | When a flow is modified, update this map in the same change. |
| **Update change log** | When a flow is modified, add an entry to the Change log section. |
| **Source of truth** | This doc is the reference. If code and this doc disagree, fix the code or update the doc with approval. |

---

## Universal Add Menu

All main pages (Home, Vault, Garden, Journal, Calendar) use the same **Universal Add Menu** when the FAB is tapped (when not in selection mode).

### Screen 1: What to add

| Option | Screen 2 / Behavior |
|--------|---------------------|
| **Add Seed Packet** | Opens QuickAddSeed (Manual / Photo / Link / Purchase Order) |
| **Add plant** | Screen 2: Manual Entry \| Start Seeds |
| **Add to shed** | Opens QuickAddSupply (Manual / Photo Import single / Import from Photos batch / Link / Purchase Order) |

**Add to shed (stay-in-place):** Choosing "Add to shed" never navigates or changes the URL/tab. The parent only closes the Universal Add Menu and opens the QuickAddSupply modal on the current page. On **Vault**, QuickAddSupply is rendered by the Shed wing regardless of the active tab (Grid, List, or Shed), so the modal is available from any Vault tab without switching views.

| **Add task** | Opens New Task modal on current page (no navigation). Calendar also supports `?openTask=1` URL param. |
| **Add journal** | Opens Quick Log modal (slide-over); no navigation. |

### Add plant – Screen 2

| Option | Behavior |
|--------|----------|
| **Manual Entry** | Open AddPlantModal (default type from context: seasonal on Active Garden, permanent on My Plants) |
| **Start Seeds** | Navigate to `/vault/plant?from=garden` (or from=calendar, from=vault, from=journal) |

### Selection mode

When in selection mode (Vault batch select, Garden batch select, Journal entries selected), FAB opens the **selection actions menu**, not the Universal Add Menu.

### FAB coordinate map (UniversalAdd ↔ Add to Supply)

**Purpose:** Exact "coordinate map" for FAB menu stacking so routing for Seed/Packet and Supply sides stay consistent. Do not change without approval.

#### 1. UniversalAddMenu internal state

| State | Type | Meaning |
|-------|------|---------|
| `screen` | `"main"` \| `"add-plant"` | Only **Add plant** uses a second screen inside the same modal. **Add to Supply does not** — it leaves the menu. |

- **Main screen:** Add Seed Packet, Add plant, Add to shed, Add task, Add journal, Cancel.
- **Add plant screen:** Back (→ `setScreen("main")`), Manual Entry, Start Seeds, optional Scan PO / Photo Import, Cancel.
- When `open` becomes true, `useEffect` resets `screen` to `"main"`.

#### 2. Transition: UniversalAdd → Add to Supply

| Step | Location | Action |
|------|----------|--------|
| User tap | UniversalAddMenu | "Add to shed" button |
| Handler | UniversalAddMenu | `onClose(); onAddToShed();` (no internal sub-screen) |
| Parent | Each page (Home, Vault, Garden, Journal, Calendar) | `setUniversalAddMenuOpen(false); setShedQuickAddOpen(true);` (or equivalent: Vault uses `setShedQuickAddOpen(true)` and Universal Add is already closed) |

So: **UniversalAdd closes, QuickAddSupply opens.** Two separate modals; no shared "stack" state inside UniversalAddMenu.

#### 3. Back from Add to Supply (QuickAddSupply choose screen)

| Step | Location | Action |
|------|----------|--------|
| User tap | QuickAddSupply | Back arrow (only when `onBackToMenu` is provided and `screen === "choose"` and not edit mode) |
| Handler | QuickAddSupply | Calls `onBackToMenu()` — component does not close itself for Back |
| Parent | Each page | **Must:** close QuickAddSupply, then re-open Universal Add Menu. |

**Required parent pattern (do not break):**

```text
onBackToMenu={() => {
  setShedQuickAddOpen(false);   // or equivalent
  setUniversalAddMenuOpen(true);
}}
```

**Vault (Shed wing):** QuickAddSupply lives in `VaultShedWingModals`; it receives `onBackToMenu={() => { setShedQuickAddOpen(false); onOpenUniversalAddMenu?.(); }}`, and `VaultPageContent` passes `onOpenUniversalAddMenu={() => setUniversalAddMenuOpen(true)}` into the wing.

#### 4. Where state lives per page

| Page | Universal Add open | Supply modal open | Back-to-menu handler |
|------|--------------------|-------------------|----------------------|
| Home | `universalAddMenuOpen` | `shedQuickAddOpen` | `setShedQuickAddOpen(false); setUniversalAddMenuOpen(true)` |
| Vault | `universalAddMenuOpen` | `shedQuickAddOpen` (in VaultShedWing) | `setShedQuickAddOpen(false); onOpenUniversalAddMenu?.()` → `setUniversalAddMenuOpen(true)` |
| Garden | `fabMenuOpen` | `shedQuickAddOpen` | `setShedQuickAddOpen(false); setFabMenuOpen(true)` |
| Journal | `universalAddMenuOpen` | `shedQuickAddOpen` | `setShedQuickAddOpen(false); setUniversalAddMenuOpen(true)` |
| Calendar | `universalAddMenuOpen` | `shedQuickAddOpen` | `setShedQuickAddOpen(false); setUniversalAddMenuOpen(true)` |

QuickAddSupply internal screens: `"choose"` | `"link"` | `"form"`. Back from **choose** goes to FAB menu via `onBackToMenu`. Back from **link** goes to choose (`setScreen("choose")`). Back from **form** goes to choose (or Cancel when edit). These are internal to QuickAddSupply only.

---

## Garden

### Garden FAB (floating action button)

| View | Action | Destination / Behavior |
|------|--------|-------------------------|
| **Active Garden / My Plants** | FAB tap (no selection) | Opens Universal Add Menu |
| **Active Garden / My Plants** | FAB tap (when selections exist) | FAB shows orange >> icon; tap opens selection menu: Delete, End batch, Journal |

### Active Garden / My Plants – selection mode

| Action | Behavior |
|--------|----------|
| **Selecting bar** | Shows "Selecting (N)" only; actions via FAB >> menu |
| **FAB >> menu** | Delete (soft delete), End batch (archive), Journal (BatchLogSheet) |

### My Plants – planting cards

| Action | Behavior |
|--------|----------|
| **Short tap** | Navigate to `/vault/[id]?from=garden` |
| **Long-press (~500ms)** | Enter selection mode; select this planting. Support multi-select. |
| **Tap when selected** | Toggle selection |

---

## Journal

### Journal FAB

| Action | Destination / Behavior |
|--------|-------------------------|
| **FAB tap (no selection)** | Opens Universal Add Menu |
| **FAB tap (entries selected)** | Opens selection actions (e.g., bulk delete) |

### Journal – add entry flows (via Universal Add Menu → Add journal)

| Flow | Trigger | Destination |
|------|---------|--------------|
| **Add journal** | FAB → Add journal | Opens Quick Log modal (slide-over) on current page; full form remains at `/journal/new`. |

### Journal – entry cards

| Action | Behavior |
|--------|----------|
| **Plant pill tap** | Navigate to `/vault/[plant_profile_id]?tab=journal` (each pill links to its plant profile) |
| **Short tap** (card body, when not selecting) | Opens Edit Journal modal (note, photos; plants editable except for planting entries) |
| **Long-press (~500ms)** | Enter selection mode; select this entry |
| **Tap when selected** | Toggle selection |

---

## Journal New (`/journal/new`)

| Aspect | Behavior |
|--------|----------|
| **Entry** | Full form: note, photo, plant selection |
| **Back link** | If `?from=garden`: go to `/garden`. Else: go to `/journal` |
| **Cancel** | Same as back link |
| **Post-save redirect** | Same as back link |

---

## Vault

### Vault FAB

| View | Action | Destination / Behavior |
|------|--------|-------------------------|
| **Plant Profiles / Seed Vault / Shed** | FAB tap (no selection) | Opens Universal Add Menu |
| **Plant Profiles / Seed Vault** | FAB tap (batch select, items selected) | Opens selection actions |
| **Shed** | FAB tap (batch select, items selected) | Opens selection actions |

### Vault → Plant (`/vault/plant`)

| Query param | Behavior |
|-------------|----------|
| `from=garden` | "Back" returns to Garden; add-plant flow optimized for garden context |
| `from=calendar` | "Back" returns to Calendar |
| `from=vault` | "Back" returns to Vault |
| `from=journal` | "Back" returns to Journal |
| `ids=...` | Pre-select packets for batch plant |

### Vault profile (`/vault/[id]`)

| Query param | Behavior |
|-------------|----------|
| `from=garden` | "Back" returns to Garden (My Plants) |
| `from=calendar` | "Back" returns to Calendar (optionally with `date=YYYY-MM-DD` to preserve context) |
| `tab=journal` | Open Journal tab |

### Vault profile – Plantings tab

| Plant type | Tap plant card | Destination |
|------------|-----------------|-------------|
| **Permanent** (trees, perennials) | All plants | `/garden/grow/[grow_id]?from=profile` — Grow Instance page |
| **Seasonal** (active) | Active plantings only | `/garden/grow/[grow_id]?from=profile` — Grow Instance page |
| **Seasonal** (harvested/dead) | No link | Card displays only (no navigation) |

Add plant / Add planting: Removed from profile page. Users add plants via the Universal Add Menu (FAB) from Home, Vault, Garden, Journal, or Calendar.

---

## Grow Instance page (`/garden/grow/[id]`)

Dedicated page for one specific plant (one `grow_instance`). Shows age, status, next milestone, task history, last fertilized, and notes. Distinct from the Vault plant profile (variety page).

### Back behavior

| `from` + `gardenTab` | Destination |
|----------------------|-------------|
| `from=profile` | `/vault/[plant_profile_id]?tab=plantings` |
| `from=garden&gardenTab=active` | `/garden?tab=active` |
| `from=garden&gardenTab=plants` | `/garden?tab=plants` |
| No `from` (fallback) | `/garden` (or `/garden?tab=plants` for permanent plantings) |

### Entry points

| Source | Link |
|--------|------|
| Plant profile → Plantings tab (all types) | `/garden/grow/[id]?from=profile` |
| Garden (Active) — grid card tap | `/garden/grow/[id]?from=garden&gardenTab=active` |
| Garden (Active) — list card tap | `/garden/grow/[id]?from=garden&gardenTab=active` |
| Garden (My Plants) — card tap | `/garden/grow/[id]?from=garden&gardenTab=plants` |

### Actions within page

| Action | Behavior |
|--------|----------|
| **About variety** link (header) | Navigate to `/vault/[plant_profile_id]` |
| **Long-press** | Not applicable — no swipe-to-navigate on this page |
| **Red trash (archive)** | Confirm dialog → sets `status = archived`, `ended_at`, `end_reason = archived`. Plant stays in history. |
| **Edit location** | Inline tap on Location stat → text input, saves on Enter or ✓ button |
| **Add note** (Notes tab) | Opens QuickLogModal pre-scoped to this plant profile |

### Vault – selection mode

| Element | Behavior |
|---------|----------|
| **Select / Cancel button** | Single button slot. Shows "Select" when not in selection mode; shows "Cancel" when in selection mode. Same position — user knows where to look. |
| **Select All** | Appears next to Cancel when in selection mode |
| **Vault quantity** | Displays **active** seed packet count only (excludes archived packets) |

### Garden (Active Garden) – bulk selection mode

| Element | Behavior |
|---------|----------|
| **Cancel button** | In the same row as Filter (next to Filter), like Vault. Exits bulk selection mode. |
| **Selecting (N) + Delete** | Shown in row below when items are selected |

### Garden (My Plants) – bulk selection mode

| Element | Behavior |
|---------|----------|
| **Cancel button** | In the same row as Filter (next to Filter), like Vault. Exits bulk selection mode. |
| **Selecting (N) + Delete** | Shown in row below when items are selected. Delete opens confirmation modal. |
| **FAB (pencil)** | When items selected, FAB shows pencil; tap opens BatchLogSheet for journal, quick care (water/fertilize/spray), end batch, delete. |

---

## Vault Tabs (Plant Profiles vs Seed Vault)

| Tab | Content | Filters |
|-----|---------|---------|
| **Plant Profiles** | List of plant profiles (aggregated by profile). Grid view. | Profile-level: status, tags, category, variety, vendor, sun, spacing, germination, maturity, packet count, sow (Plant this month). |
| **Seed Vault** | List of individual seed packets (one row per packet). | Packet-level: status, vendor, sort, search, sow (Plant this month). |

Each tab has its own filters; switching tabs preserves each tab's filters. No cross-tab application.

| Action | Behavior |
|--------|----------|
| **Tap packet row** (Seed Vault tab) | Navigate to `/vault/[plant_profile_id]` |
| **Tap profile card** (Plant Profiles tab) | Navigate to `/vault/[plant_profile_id]` |

### `/vault/packets` (legacy)

| Behavior |
|----------|
| Redirects to `/vault?tab=list` for backward compatibility. The Seed Vault tab is now integrated into the main vault page. |

---

## Filter reset on page change

When navigating between top-level sections (Vault, Garden, Journal, etc.), filters (search, status, refine-by, view mode) are cleared and reset. Filters do **not** carry over.

**Exception:** When selecting an active seasonal planting from a profile page and navigating to Active Garden, the grow filter (`?grow=` in the URL) stays applied. Back to My Plants and View plant in My Plants no longer apply a profile filter.

---

## Shopping List

### Access

| Location | Behavior |
|----------|----------|
| **Header** | Shopping list icon (cart) between Family/Personal pill and Settings — one tap to `/shopping-list` |
| **Dashboard** | Shopping list section with "View full list" and "Add item" when items exist |
| **Dashboard empty state** | "Add item" button opens Manual add modal |
| **Shopping List page empty state** | FAB (plus icon) opens menu: "Add item" |
| **Shopping List page** | FAB (plus icon) opens menu: "Add item" (Manual add modal), Cancel |
| **Back** | "← Back" uses browser history — returns to prior page (Home, Vault, Garden, etc.) |

### Item types and links

| Item type | Dashboard | Shopping List page |
|-----------|-----------|--------------------|
| **Plant** (out-of-stock) | Link to `/vault/[id]` | Plain text |
| **Supply** (running low) | Link to `/vault/shed/[id]` when not deleted; plain text when soft-deleted | Same |
| **Placeholder** (wishlist) | Checkmark and X icons (both remove from list) | Same |

### Add to shopping list

| Location | Behavior |
|----------|----------|
| **Plant profile** (`/vault/[id]`) | Cart icon in header — adds to list |
| **Shed supply** (`/vault/shed/[id]`) | "Add to Shopping List" button |

---

## Calendar

### Task list (Overdue, Upcoming, Completed)

| Section | Content |
|---------|---------|
| **Overdue** | Tasks past due, not done. Collapsible. |
| **Upcoming** | Tasks from today onward, grouped by date. Collapsible. |
| **Completed** | Recently completed tasks. Collapsible. Hidden when empty. When no date selected: last 50. When a date is selected (prior or today): completed tasks for that date. |

### Calendar FAB

| Action | Destination / Behavior |
|--------|-------------------------|
| **FAB tap** | Opens Universal Add Menu |
| **Add task** (from menu) | Opens New Task form inline |
| **?openTask=1** | Navigate to `/calendar?openTask=1` auto-opens New Task form |

---

## Other routes

| Route | Purpose |
|-------|---------|
| `/` | Home / dashboard |
| `/vault` | Seed vault (Plant Profiles + Seed Vault tabs) |
| `/garden` | Garden (Active / My Plants) |
| `/journal` | Journal list |
| `/journal/new` | New journal entry (full form) |
| `/calendar` | Calendar / tasks |
| `/shed` | Supplies |
| `/shopping-list` | Shopping list |
| `/settings/*` | Settings |

---

## Change log

| Date | Change |
|------|--------|
| (initial) | Created navigation map. Documented Garden FAB, My Plants quick-add + multi-select (approved), Journal flows (current + planned). |
| (update) | Added Vault: Select/Cancel same-slot behavior, vault quantity = active packets only. |
| 2025-02-22 | Journal FAB goes directly to /journal/new (Quick log modal removed). Garden My Plants: quick-add modal, long-press multi-select. Journal New: ?from=garden → back/cancel/save return to /garden. |
| 2025-02-22 | Both maps (Navigation Map + Navigation Issues Log) now include change logs; both will be updated when flows change or issues are logged/fixed. |
| 2025-02-22 | Garden: Always show toolbar (search, filter, view toggle) even when list is empty. Vault profile Add planting: pass from=garden when opened from garden so redirect returns to garden. |
| 2025-02-22 | Garden My Plants: ?profile=xxx URL param pre-filters to that plant when navigating from vault profile (Back to My Plants). Permanent plants only. Clear filters removes profile param. |
| 2025-02-22 | Garden: Visible "Showing"/"Viewing" chips with Cancel (×) when profile or grow param applied. User can clear filter/view to return to full list. Grow param no longer auto-clears. |
| 2025-02-22 | Garden: When grow=xxx, Active Garden filters to single batch (visible filter). Empty states for profile/grow filters. Preserve params when switching tabs. Escape clears filter. Loading/not-found chip labels. |
| 2025-02-22 | My Plants batch selection: FAB shows pencil when items selected; tap opens BatchLogSheet. Selecting bar with Delete. Renamed "profile cards" to "planting cards" (grow_instances). |
| 2025-02-22 | My Plants FAB menu: removed "Add journal entry" option. Active Garden FAB still offers "Add journal entry" for bulk journal mode. |
| 2025-02-24 | Seed Vault Packets Refactor: Plant Profiles tab = plant profiles (grid); Seed Vault tab = individual seed packets (one row per packet). Each tab has separate filters (including sow). Tap packet row → `/vault/[plant_profile_id]`. `/vault/packets` redirects to `/vault?tab=list`. |
| 2025-02-24 | Filter reset: Filters clear when navigating between sections (Vault, Garden, Journal). Exception: profile → garden with plant filter stays. Vault profile Plantings: permanent plant tap → My Plants with profile filter; seasonal active → Active Garden with grow filter. |
| 2025-02-24 | Developer: API Usage moved to dedicated page `/settings/developer/usage`. Developer page shows link card "View usage →" instead of inline stats. |
| 2025-02-26 | Shopping List: Supply items on dashboard + full page; header icon; empty state (Add from Shed, Add from Vault); placeholder checkmark/X icons; Add to shopping list on plant profile. |
| 2025-02-26 | Shopping List Phase 2: Manual add modal (Add item by name); empty state + Add item button when list has items; dashboard and Shopping List page. |
| 2025-02-27 | Removed profile filter from Back to My Plants and View plant in My Plants links. Both now navigate to full My Plants list. |
| 2025-02-27 | Plant profile tabs: Added Care tab between About and PKT. Care templates/schedules moved from About into Care tab. Tab order: About, Care, Pkts, Plants, Journal. Counts only on Pkts and Plants; Journal shows no count. |
| 2025-02-28 | Journal entry cards: Only plant pill tap navigates to plant profile. Card body short tap no longer navigates. |
| 2025-02-28 | Universal Add Menu: Vault, Garden, Journal, Calendar FABs all open same menu (Add Seed Packet, Add plant, Add to shed, Add task, Add journal). Add plant has Manual Entry \| Start Seeds. Selection mode unchanged (FAB opens selection menu). Removed Garden "Add journal entry" bulk mode; Add journal → Detailed navigates to /journal/new. Label revisions: "Add seed" → "Add Seed Packet"; "From Vault" → "Start Seeds". |
| 2025-02-28 | Home: Added plus FAB with Universal Add Menu (same options as Vault, Garden, Journal, Calendar). |
| 2025-02-28 | Add Plant modal: Standardized fields — Link to existing has Notes + Photos; Create new has Vendor/Nursery, no Qty. Removed Add plant button from vault profile Plantings tab. |
| 2025-02-28 | Add journal: Removed Snapshot/Quick note/Detailed sub-screen; FAB → Add journal now navigates directly to `/journal/new`. |
| 2025-02-28 | Create flow standardization: Required/optional labels, canonical field order, Source URL + Notes in QuickAddSeed manual, Photos after identity fields. See docs/CREATE_FLOW_CONVENTIONS.md. |
| 2025-03-02 | Calendar: Added Overdue section at top showing tasks with due_date < today and completed_at = null. Collapsible, amber styling. |
| 2025-03-02 | Home: Planting calendars (zone charts, SDSC, Farmers' Almanac) moved to /resources. Planting Schedule section stays on home with link to Resources. Settings: Added Resources link. |
| 2025-03-02 | Journal: Short tap on entry (when not selecting) opens Edit Journal modal. Editable: note, photos; plants editable except for planting entries (read-only). Respects canEditPage for household view. |
| 2025-03-03 | Add to shed: Added "Import from Photos (batch)" option. User can add multiple photos, extract each via AI, then review all at /shed/review-import before saving. Single-photo import retained. SupplyReviewItem extended with primary_image_path for batch-extracted photos. |
| 2025-03-05 | Calendar: Added Completed section (collapsible). Shows last 50 when no date selected; shows completed for selected date when viewing prior or today. All tasks redate to today on completion. |
| 2025-03-06 | Calendar: Dots (colored and grey) stay visible on calendar grid when a date is selected. Tap selected date again to deselect and return to full (outstanding + current + future) view. |
| 2025-03-10 | Add journal: FAB opens Quick Log modal (slide-over) on Home, Vault, Garden, Journal, Calendar; date picker persists to created_at (noon UTC); full form at /journal/new unchanged. |
| 2025-03-10 | FAB coordinate map: Added section documenting UniversalAdd → Add to Supply transition and Back handling (state, parent pattern, per-page wiring). |
| 2025-03-11 | Phase 0 (Universal Add audit): **Stay + Refresh** for all FAB add paths. **Only** intentional redirect: when user creates a **new plant profile** (new variety) → redirect to `/vault/[id]`. QuickAddSeed passes `newProfileId` in `onSuccess` when a new profile is created (manual "Save for later"); AddPlantModal redirects when `createdProfileId && !stayInGarden`. All other adds (packet to existing, supply, task, journal, grow instance on existing profile) stay on page and refresh. |
| 2025-03-10 | Add to shed: Documented stay-in-place behavior (no navigation/URL change; modal overlay only). QuickAddSupply on Vault is globally available from any tab (Grid, List, Shed) via VaultShedWingModals. |
