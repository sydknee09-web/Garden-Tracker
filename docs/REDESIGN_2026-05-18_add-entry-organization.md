# Redesign — Add-entry + Organization (2026-05-18)

## 1. Context

Today (2026-05-18), six read-only audits ran on Garden Tracker:

- FAB add-entry
- Photo + Journal
- Edit Plant Profile
- Plant Again
- Tasks Lifecycle v2
- Calendar UI

Together they surfaced **11 bugs, ~25 friction items, and ~25 open product decisions**. The findings led to a substantial product redesign conversation between Syd (product owner) and Claude (Dispatch). This doc captures the locked decisions and the open questions that remain.

---

## 2. Vocabulary — locked

- **Plant profile** — the encyclopedia entry. One per variety. Lives in the **Vault**. Holds variety reference info (name, growing instructions, canonical hero photo, pooled photos, days to maturity, planting window, sun/water/spacing, companion plants). DB: `plant_profiles` row.
- **Planting instance** (or just **planting**) — a specific `grow_instance`. Lives in **Zones** (the user-defined location tabs). Holds this specific planting's location, stage, dates, photos, journal entries.
- **Card** — a UI element of either type (plant profile card or planting instance card).
- **Zone** — a user-defined location tab. The primary navigation in the new design. Replaces today's Active Garden / My Plants split.

One profile → many instances. Example: 10 zinnias in planter bed + 10 zinnias in front yard = 2 planting instances pointing to the same Vault profile.

---

## 3. Locked design decisions

### 3.1 — FAB structure

Top-level FAB rows (5, same count as today, partially reorganized):

1. **Add Seed Packet** — inventory action for seed packets. Distinct top-level row; *"Seed packets are inventory, not lifecycle"* per Syd.
2. **Add Plant** — opens subcategory chooser (see 3.2)
3. **Add Supply** — unchanged (today's "Add to shed")
4. **Add Task** — unchanged
5. **Add Journal** — unchanged

### 3.2 — Add Plant subcategories

Two-option chooser on Add Plant tap (MVP):

- **Start from seed** — sowing event. Opens form with sow method chips.
- **Add already-grown** — anything already alive when acquired. Captures: variety, source, acquisition date, location.

Indoor-start-to-transplant case is captured via an optional *"started indoors on [date]"* field inside Start-from-seed, not a separate option.

**"Add already-grown" source — locked 5-value enum:**

- **Nursery** — bought as a started plant (nursery / garden center / Home Depot)
- **Gift** — someone gave you a started plant
- **Propagation** — division / cutting / layering / grafting from an existing plant (yours or another gardener's). Propagation is the broader term — merges the earlier "Division" recommendation.
- **Transplanted in** — moved from another bed or another yard you have
- **Other** — free text for edge cases

### 3.3 — Sow method chips

Inside the "Start from seed" form, four chip options. **Locked order: Direct sow → Indoor start → Greenhouse start → Outdoor start.** Direct first so it's not mingled in with the tray-starts; trays sequenced indoor → outdoor.

- **Direct sow** — sowing IS the planting event. One date, one location.
- **Indoor start** — started inside, transplant later. Two events (start + transplant).
- **Greenhouse start** — started in greenhouse, transplant later. Two events.
- **Outdoor start** — started in trays/pots outside, transplant later. Two events.

Schema already supports this — `grow_instances.sow_method` exists (currently unpopulated, audit `T-J`). Task categories include `start_seed`, `transplant`, `direct_sow` alongside `sow` and `harvest`. **UX surfacing problem, not data-model problem.**

Form fields branch by chip:

- Direct sow → 1 date + 1 location
- Started elsewhere → start date + start location + (optional) planned/actual transplant date + final location

Auto-task generation adapts:

- Direct sow → germination check + harvest task
- Started elsewhere → germination check + hardening-off task + transplant task + harvest task

### 3.4 — Zones (location-based navigation)

**Zones replace today's Active Garden / My Plants tabs.**

- User-defined location tabs (e.g. "Planter bed," "Front," "Greenhouse," "Orchard")
- Drag-reorder
- Soft cap: **10 zones, 15-char names**
- Tab creation entry points:
  1. **At add-plant time** — location field autocomplete; typing a new zone name creates it inline ("+ Create 'Greenhouse'")
  2. **From the tab bar** — "+" button at end of tab row creates an empty zone (user names it)
  3. **From Manage Zones** — for bulk operations
- Tab deletion: **only from Manage Zones** (avoids accidental tab-bar swipes-into-oblivion)
- Rename / reorder / delete: all from Manage Zones screen (not long-press on tab bar — avoids conflict with long-press-to-select on plant cards)

**System default "Garden" zone — smart show/hide:** (locked: default name is **"Garden"**, matches the auto-created zone for migrated existing users in §3.10)

- Brand new user (no plants, no zones): no tabs visible. Empty-state copy: *"Add a plant or set up a garden zone to get started."*
- User adds first plant without picking/creating a zone: "Garden" materializes as a real zone and the plant lands there
- User creates own zones AND no plants remain in "Garden": "Garden" auto-hides
- If user later adds a plant without specifying location: "Garden" reappears

**On the word "Zones":** chosen over "Locations," "Areas," "Spots," "Beds," or generic "Tabs." Garden-domain flavor. Mild concern: conflicts with USDA hardiness zones (Zone 10b, Zone 7). Mitigation: empty-state and onboarding copy clarifies *"garden zones — your labeled areas like Planter bed or Greenhouse"* to head off the hardiness confusion.

### 3.5 — Logging IS state management

**Stage and location are derived, not declared.** User keeps logging actions (Sow / Sprout / Pot Up / Plant Out / Transplant / Harvest / etc.); the app derives current stage and updates the planting instance's location automatically.

Lifecycle stages: **seed → seedling → up-pot → transplanted → maturing → harvestable → ended (with reason)**.

The only explicit choice is at **initial add** (one decision: "this is a seed I'm starting" / "this is a plant my sister gave me as a seedling" / "this is a tree I just bought"). After that, every transition comes from logs the user is already doing.

#### Stage as data vs UI — important distinction

- **Stage as data** is locked: each `grow_instance` has a derived current stage from logs. Drives Calendar context, filters, Compare tab, lifecycle-aware task generation.
- **Stage as UI** is NOT locked. **Deferred to Phase 2 design pending coordination with family-mode rework.** Syd flagged real concerns about visual clutter and competition with existing family-mode badges on the planting instance card.

UI options to consider when Phase 2 design happens:

- Subtle inline text (one-word label in small grey text)
- Color-coded chip/pill — **NOT recommended** — competes with family-mode badges, adds clutter
- Icon-only with tooltip
- Contextual only (no badge on card; surfaces on Calendar task rows + stage filters)

**"Must pass" criteria for any visual element added to the plant card.** Any badge / pill / chip / icon proposed for the card must clear all three before earning its spot:

1. **Tells the user something they'd otherwise dig for** (information density justified)
2. **Actionable** (gates a real next step or filter, not decorative)
3. **Glance-able** (readable in <1s without expanding the card)

If it fails any of the three, it doesn't ship to the card.

### 3.6 — DTM (days to maturity) — context-aware

DTM only displays for plants where *"matures on day N"* is meaningful. Continuous-pick crops (oregano, herbs, lettuce, beans) stay in "Harvestable" stage indefinitely with no false "mature-and-done" lie. Driven by the `lifecycle_pattern` enum on the plant profile (§3.13): only `annual` shows DTM; `perennial-single-harvest` shows fruit-bearing season; `perennial-continuous-pick` shows neither; `biennial` shows a 2-year flow.

### 3.7 — Split-on-partial-count

**Every log action that has a count makes the count optional. Partial count auto-splits the `grow_instance`.**

- "Transplant 10 of these to planter bed" → original 20-plant record becomes 10 still in old zone + 10 new record transplanted to planter bed
- "Plant out 5 direct sow" → 15 stay, 5 new direct-sown record
- "Harvest 3 of these" → no split needed, just partial harvest log

Schema: each `grow_instance` gets a nullable `split_from` FK pointer. App walks the chain backward for comparison views ("of the 20 started 3/14, the 10 in pots produced X, the 10 in ground produced Y").

Side benefit: enables Maya-persona cross-method / cross-location comparison naturally.

### 3.8 — Move pathways (two intents)

- **"I moved this plant" (real action)** → log Transplant or Move action on the plant card. The log IS the move: location auto-updates, gets timestamped, goes into history. Consistent with logging is state management.
- **"I miscategorized this" (data fix)** → tap plant → Edit → change location field. Quiet correction, no log entry.

Batch (e.g. transplanted 10 zinnias all at once): long-press select → batch log Transplant. **No separate "Move" verb in the FAB.**

### 3.9 — End lifecycle

End-lifecycle is a stage transition (terminal). Standalone log action available on any planting:

- "End lifecycle — Died (frost)"
- "End lifecycle — Harvested out"
- "End lifecycle — Cleared bed"
- "End lifecycle — Other (with note)"

Also triggered as a bulk option when deleting a Zone with plants in it. Tab-delete-with-plants flow has 4 options:

- **Move plants** → pick another zone
- **End lifecycle** → with optional reason (Died / Harvested out / Cleared bed / Other)
- **Delete permanently** → destructive removal (loses history; should be rare)
- **Cancel**

Ended plantings:

- Leave active Zone views
- **DO** remain in Vault profile's Plantings tab (history toggle)
- **DO** remain in journal history
- **DO** remain in year-over-year comparison views
- **DO** appear in the new Compare tab on profile (see 3.11)

### 3.10 — Migration plan (existing users)

- Auto-create **"Garden"** zone → assign all existing seasonal `grow_instances`
- Auto-create **"Permanent"** zone → assign all existing permanent `grow_instances`
- Existing ended/inactive `grow_instances` → enter the new "ended" lifecycle state with reason "Migrated"
- Existing users can rename / reorganize / delete the auto-created zones after migration
- One-time onboarding tooltip on first login post-migration: *"Your garden was reorganized into Garden + Permanent zones. You can rename or add new zones anytime."*

### 3.11 — Compare tab (analytics)

New **"Compare" tab on Plant Profile** (alongside About / Plantings / Journal / Photos). Shows YoY and season-over-season comparison for THIS variety.

MVP view: **table default, chart toggle.** Table is denser, sortable, more precise for 2-3 plantings (most users). Chart toggle for 5+ plantings or users who prefer visuals.

MVP comparison metrics (all derivable from existing logs):

- Plant date
- Location
- Sow method
- Days to first harvest (if applicable)
- Days to end (if ended)
- End reason
- # of journal entries (engagement signal)
- # of harvest logs (yield proxy)

Future / not MVP: estimated yield (if user captures weights), pest/disease incidents (if categorized), cost basis vs yield.

**Cross-variety analytics** (e.g. Cherokee Purple vs Brandywine across seasons): standalone "Insights" / "Data" section, Maya-persona feature, **NOT MVP**.

### 3.12 — App voice (locked rule)

**Garden Tracker UI copy: plain, action-oriented, noun/verb-led labels. NOT conversational, NOT chatty, NOT AI-helper Q&A framing.** No *"Do you want to...?"* / *"Would you like to...?"* UI prompts. Lead with the action or noun.

Cross-reference: this is consistent with the §3.12 #5 ship's verb-led empty-state frame ("Add a {noun}" CTAs).

### 3.13 — Lifecycle taxonomy (replaces Permanent / Seasonal entirely)

**Lifecycle is variety-level metadata, not per-planting metadata.** A tomato is ALWAYS an annual; a crepe myrtle is ALWAYS a perennial. The user shouldn't declare per-planting.

**Locked: `lifecycle_pattern` enum on `plant_profiles` — 4 values:**

- **`annual`** — completes lifecycle in one season (tomato, basil, lettuce). Has meaningful DTM.
- **`perennial-single-harvest`** — comes back year after year, yield in a discrete harvest window (fruit trees, berries, asparagus, garlic). Has fruit-bearing season, **not** DTM.
- **`perennial-continuous-pick`** — comes back year after year, harvestable continuously once started (oregano, chives, rhubarb, mint). Stays in "Harvestable" stage indefinitely after first harvest log. **No DTM, no false "matured" state.**
- **`biennial`** — 2-year lifecycle (carrots if seed-saving, parsley, beets if seed-saving). Has 2-year flow with harvest in year 1 OR year 2 depending on purpose.

**Behavior:**

- Auto-populated from variety enrichment for known varieties
- Editable on the plant profile if wrong (one place to fix)
- Default to **`annual`** for unknown/niche varieties (safe fallback)
- `grow_instances` inherit lifecycle from their profile — no user decision at plant time
- `is_permanent_planting` on `grow_instance` becomes derived/redundant; migrate out in Phase 2
- Backend logic (auto-task generation, care template copy, end-of-season prompts) reads from `profile.lifecycle_pattern` instead of `grow_instance.is_permanent_planting`
- Filter: *"show me my perennials for fall care"* becomes a real query

**Drives:**

- DTM field display — `annual` only
- Harvest-bearing-season field display — `perennial-single-harvest` only
- Auto-task generation per pattern:
  - `annual` → sow + harvest
  - `perennial-single-harvest` → fertilize + winterize + harvest-window
  - `perennial-continuous-pick` → stays in harvestable; no terminal harvest task
  - `biennial` → flows over 2 years

**Downstream simplifications this unlocks (now dissolved, not questions):**

- `F2` (Permanent/Seasonal asked twice in FAB) → **dissolved; never asked**
- `F-F` (Plant Again silently forces permanent) → **dissolved structurally; nothing to force.** (Ship 1a still patches the immediate bug; Ship 5 structurally removes the toggle.)
- `Q18` (Permanent vs Seasonal type lock) → **dissolved.** Replaced by editable `lifecycle_pattern` on the profile.
- Add Plant form gets simpler (one fewer decision)

**Edge case to flag.** Some varieties shift annual ↔ perennial by climate zone (peppers in zone 10 are perennial). **MVP: default from enrichment, user can edit on profile. Don't try to be zone-aware in MVP.**

**Ship vehicle:** Phase 1 — Ship 5 (plant profile redesign). Schema migration + UI removal of Permanent/Seasonal toggle from Add Plant + auto-derive `grow_instance` behavior.

### 3.14 — Plant profile redesign principles + field set (Ship 5)

**Three locked design rules for the redesigned plant profile:**

1. **Variety-type-aware fields** — chill hours only show for fruit trees; rootstock only for grafted plants; pollination requirements only where relevant. Driven by `lifecycle_pattern` + a category/type tag on the profile.
2. **Collapsible groups** — Identity / Key Attributes / Variety-type details / Care / Notes. **Collapsed by default, expand on tap.** Mitigates audit `E7` (17-field scroll fatigue) without losing density for power users.
3. **Optional, never required** — Sam-persona can ignore new fields entirely. **No new field gates submit.**

#### Field set — derived from review of 5 vendor product pages

Reference vendor pages reviewed by Syd: Ambrosia Pomegranate, Burpee Cilantro, Burpee Blueberry, Variegated Pink Lemon, Heirloom Tomato. Field set consolidated below. Variety-type-aware (irrelevant fields hidden); collapsible groups; **optional unless noted**.

**Identity tier (all plants):**

- **Botanical / Latin name** — already in schema as `scientific_name`. Currently silently captured, never displayed. **Surface it** in the redesign.
- Common name
- Variety name (already in schema)
- Form / category tags — **multi-tag** (Vegetable, Fruit, Heirloom, Tree, Shrub, Herb, Flower, etc.)
- Photo / hero

**Key Attributes (icon-tagged top summary, all plants):**

- Mature height (already in schema)
- **Mature spread** — already in schema, never displayed. **Surface it.**
- Light requirement (Full Sun / Part Sun / Part Shade / Shade)
- Zones / hardiness zone range
- Days to maturity — **`annual` only** (driven by `lifecycle_pattern`, §3.13)
- Fruit-bearing season — **`perennial-single-harvest` only**
- Sow method (Direct / Indoor / Both)
- Growth habit (Bush / Vine / Tree / Indeterminate / Determinate)

**Variety-type-aware fields (only shown when relevant):**

- *Fruit trees / berries:* chill hours, pollination (self-fruitful vs needs partner), cold hardiness (e.g. *"Hardy to 10°F"*), fruit-bearing season (Early / Mid / Late), fruit characteristics (size / color / flavor), bloom description (color / season), climate type (inland / coastal / both)
- *Edibles:* flavor profile, yield estimate, culinary uses
- *All:* foliage description

**Care guidance (collapsible sub-sections, variety-aware):**

- Sunlight / Soil / Watering / Fertilization / Pruning / Pest control / Growth rate / Container growing / Fruit production (fruit-bearing only)

**Cross-references:**

- Dissolves `Q16` (17-field collapse) — locked here as collapsible groups
- Surfaces `scientific_name` + `mature_height` + `mature_width` — partly resolves audit `E2` silent-capture finding (see §7 note)

### 3.15 — "When You Grow" zone-aware timing section + drop zone10b hardcode

**Add to Ship 5 scope: a zone-aware section on the plant profile** that calculates and displays, based on the user's actual zone:

- Average last frost / Average first frost
- **From Seed Indoors:** start date + transplant date
- **From Seed Outdoors:** start date
- **From Plant:** timing window
- Fall planting (where applicable)

**Drop the zone10b hardcoded default everywhere.** Today the app defaults all users to zone10b (per `CAL-7` audit note + Syd's confirmation: *"I did that when I was setting up the app for ease"*). Replace with the user's actual zone:

- Capture user's zone at signup or in Settings — **per-user, simplest MVP**
- **Future enhancement:** per-profile zone for multi-microclimate gardens (Maya in Vista)
- **Frost-date data source TBD** — three options to choose from at implementation time (carried as `Q26` in §4):
  - NWS API (US-only, accurate, requires lookup)
  - OpenWeather (global, paid tier may be needed)
  - Built-in zone-to-frost-dates dataset (offline-friendly, USDA reference data)

Once user's actual zone is captured, the Calendar's *"Plantable this month"* banner (today `CAL-7`: reads from user's `plant_profiles.planting_window` free-text) can also drive from **real zone data + variety reference**.

### 3.16 — Seed count per packet — optional + auto-scrub

**Locked behavior for the `seed_packets.seed_count` field:**

- **Optional, never required.** Manual entry is tough for users (Syd's call: *"it can be hard to add in"*). Does not gate any flow.
- When user uses **Photo Import** or **Scan Purchase Order**, AI enrichment attempts to **auto-extract seed count** from the packet image or receipt line item (seed count is often stamped on the packet or itemized on the receipt).
- **Blank-and-fine when not detected.** No error, no nag.

### 3.17 — Packet decrement on plant — tier decrement

**Locked rule: tier decrement, not full archive.** Each plant from a packet decrements the packet by one tier:

- **Full → Partial → Low → Empty**

Matches the existing volume-pill widget in the app. Removes today's silent data-loss behavior where the entire packet is archived on a single plant action (audit `F-I`).

**Resolves `Q17` (packet decrement rule). Unblocks `F-I` bug fix.**

### 3.18 — Calendar polish — task-row identity, /schedule link, frost overlay

Three locked Calendar improvements that ship in Phase 1 (Ship 2 cohesion pass) rather than waiting for the Phase 2 redesign:

- **Plant-instance identity in task rows** (`CAL-3` fix, resolves `Q10`/`CQ5`). When multiple plantings of the same variety exist, task rows display the `grow_instance` location: `"Water Tomato (Bed 2)"`. Fall back to sown-date when location is missing (`"Water Tomato (sown 4/15)"`).
- **`/schedule` cross-link from Calendar** (resolves `Q9`/`CQ4`). Add a header link or *"View planting calendar"* affordance from the Calendar surface to `/schedule` (the zone-aware reference page). Once §3.15 lands, `/schedule` is data-driven from the user's actual zone instead of the `zone10b` hardcode.
- **Weather + frost overlay on Calendar grid** (resolves `Q8`/`CQ2`). Surface frost-date overlay on Calendar grid cells using existing Home forecast data. Tooltip on tasks for those days: *"Protect tender plants — frost forecast."*

### 3.19 — Recurring task edit gap — "Manage schedule" deep-link (`CAL-F7` fix shape)

**Locked fix shape (resolves `Q7`):** keep `NewTaskModal` edit mode simple — title / date / category only. Add a **"Manage schedule"** button in the Calendar task detail popup that deep-links to the plant profile's **Care tab**, where the full schedule editor lives. Power-user schedule changes route to the canonical Care tab surface; the Calendar modal stays uncluttered.

---

## 4. Open questions still pending Syd's decision

Originally numbered 1-26 below. This list now annotates each with status: **OPEN** / **RESOLVED** / **DISSOLVED**. Resolved items reference their locking section; open items carry forward.

1. **Per-instance card layout** — **OPEN.** The planting instance card is underdeveloped today. Need to sketch what the new card contains (stage badge + location + dates + journal thread + photos) and how info ranks visually. Both mobile and desktop layouts.
2. ~~**"Add already-grown" source options**~~ — **RESOLVED by §3.2.** Locked 5-value enum: Nursery / Gift / Propagation / Transplanted in / Other.
3. ~~**Sow method chip count**~~ — **RESOLVED by §3.3.** Keep all 4 in locked order: Direct sow → Indoor start → Greenhouse start → Outdoor start.
4. ~~**Default zone name**~~ — **RESOLVED by §3.4.** Locked: **"Garden"** (matches the auto-created migration zone in §3.10).
5. ~~**Onboarding tooltip on post-migration first login**~~ — **RESOLVED by §3.10.** Yes, include the one-time tooltip.
6. ~~**Notification engine** (`TQ2`/`CQ1`)~~ — **RESOLVED by §6 Phase 3.** Push notifications are Phase 3+, NOT MVP. Rationale: see actual usage patterns first; Phase 2 is higher value per token; notifications become the standout Phase 3 ship.
7. ~~**Recurring task interval editability** (`CAL-F7`)~~ — **RESOLVED by §3.19.** Locked option (b): keep `NewTaskModal` edit mode simple, add "Manage schedule" deep-link from Calendar task popup to plant profile's Care tab.
8. ~~**Weather + calendar join** (`CQ2`)~~ — **RESOLVED by §3.18.** Yes — frost overlay on Calendar grid cells using existing Home forecast data; tooltip on tasks for those days.
9. ~~**`/schedule` cross-link from Calendar** (`CQ4`)~~ — **RESOLVED by §3.18.** Yes — header link / *"View planting calendar"* affordance.
10. ~~**Plant-instance identity in calendar task rows** (`CQ5`/`CAL-3`)~~ — **RESOLVED by §3.18.** Show `grow_instance` location: `"Water Tomato (Bed 2)"`. Fall back to sown-date when location missing.
11. **Edit Plant Profile structured fields** — **OPEN** (also `EQ1`). Sun / Water / Spacing / Sowing Method → enum selects with "Other" fallback, or stay free-text?
12. ~~**`profile_type` editability**~~ — **DISSOLVED by §3.13** (also `EQ2`). Lifecycle now lives at `plant_profile` level as `lifecycle_pattern` and is editable on the profile; the per-grow toggle is removed.
13. **Growing Notes catch-all** — **OPEN** (also `EQ3`). Keep as free-text or promote common content (location, health, amendments) to structured fields?
14. **`purchase_vendor` display** — **OPEN** (also `EQ4`). Exposed somewhere on read-side, or deprecate the field? (Note: `purchase_nursery` separately flagged for deprecation as a duplicate of `purchase_vendor` per §7 convergence.)
15. **Tags editable inline from Edit Plant Profile** — **OPEN** (also `EQ5`). Instead of routing to separate `/vault/tags` page?
16. ~~**17-field Edit Plant Profile collapse**~~ — **RESOLVED by §3.14** (also `EQ6`). Locked as collapsible groups (Identity / Key Attributes / Variety-type details / Care / Notes).
17. ~~**Packet decrement rule on planting**~~ — **RESOLVED by §3.17.** Locked: tier decrement (Full → Partial → Low → Empty). Unblocks `F-I`.
18. ~~**Permanent vs Seasonal type lock**~~ — **DISSOLVED by §3.13.** Replaced by editable `lifecycle_pattern` on the profile.
19. **Multi-grow flow** for power users — **OPEN, partially resolved** (also `PQ3`). Split-on-partial-count from logs (§3.7) covers some of this naturally. Remaining: whether to ALSO add multi-select at add-time (save+continue / per-bed multi-select / accept N cycles).
20. **Button copy naming** — **OPEN** (also `PQ6`). *"Add Plant"* or *"Plant Again"* (engineering uses latter; UI shows former everywhere)?
21. **`uncompleteTask` flow** — **OPEN** (also `TQ5`). Undo recent task complete with full rollback, or accept "delete and recreate"?
22. **Sow→harvest pair migrate to `care_schedules`** (`T9`) — **OPEN.** Direction locked by §3.13 (continuous-pick stays harvestable; single-harvest gets harvest-window task); remaining is the technical migration question.
23. **Per-plant "stop auto-tasks" toggle** — **OPEN** (also `TQ4`). Surface on plant profile?
24. **`tasks.title` denormalized** (`T11`) — **OPEN** (also `TQ3`). Fix on read or accept stale history?
25. **Tags + filters layer for power users** (Maya-persona) — **OPEN.** "Show me all tomatoes across all zones" — when to build, MVP or later?
26. **Frost-date data source** (§3.15) — **OPEN.** NWS API (US-only, accurate), OpenWeather (global, paid tier maybe), or built-in zone-to-frost-dates dataset (offline-friendly, USDA reference). Choose at Ship 5 implementation time.

### Residual open list (the carry-forward set after today's session)

After folding all of today's locks, the open questions Syd still needs to decide on (or that are deferred to implementation time):

- **Q1** — Per-instance card layout
- **Q11 / `EQ1`** — Edit Plant Profile structured fields (enum vs free-text)
- **Q13 / `EQ3`** — Growing Notes catch-all
- **Q14 / `EQ4`** — `purchase_vendor` display
- **Q15 / `EQ5`** — Tags editable inline
- **Q19 / `PQ3`** — Multi-grow flow (partial)
- **Q20 / `PQ6`** — Button copy naming
- **Q21 / `TQ5`** — `uncompleteTask` flow
- **Q22** — Sow→harvest `care_schedules` migration (technical)
- **Q23 / `TQ4`** — Per-plant "stop auto-tasks" toggle
- **Q24 / `TQ3`** — `tasks.title` denormalized
- **Q25** — Tags + filters power-user layer
- **Q26** — Frost-date data source

Plus the validation step from §8 (show pitch to another non-technical gardener before Phase 2 commit).

---

## 5. Bugs to ship independent of the redesign

These were surfaced by audits and don't depend on the redesign. Ship them in the next 1-2 weeks regardless:

### No-decision (Ship 1a):

- **`F-F`** — Plant Again from seasonal profile silently records as permanent. `useEffect` at `AddPlantModal.tsx:104-120` force-sets `plantType="permanent"` ignoring the `defaultPlantType` prop. ~10 min fix.
- **`F11`** — `QuickLogModal` saves only `photos[0]` despite multi-photo UI. Affects 5 of 8 journal entry points (FAB Add journal, Journal page +Entry, Vault Journal tab, Vault Plantings tab per-grow). `BatchLogSheet` + `EditJournalModal` handle multi-photo correctly. ~30 min fix mirroring `BatchLogSheet`'s loop.
- **`E5`** — Edit Plant Profile silently drops 5 fields (Sowing Method, Planting Window, Companion plants, Avoid plants, Vendor/Nursery) for legacy `plant_varieties` profiles. Form renders fields, save handler excludes them. ~15 min fix (conditional rendering or honest save).
- **`CAL-F7`** — Recurring task interval uneditable from Calendar. **Locked fix shape (§3.19):** add "Manage schedule" button in Calendar task detail popup that deep-links to the plant profile's Care tab. Keep `NewTaskModal` edit mode simple (title/date/category only). Replaces the earlier "add toggle to `NewTaskModal`" idea.
- **`F-I`** — Entire packet archived on plant, regardless of quantity. **Unblocked** by §3.17 (tier decrement locked). Implements: Full → Partial → Low → Empty on each plant action.

### Decision-gated (Ship 1b):

- **`F-H`** — Plant Again with 0 packets opens packet-inventory modal, not planting modal. No longer blocked on `Q17`; remaining decision is the broader Plant Again UX cleanup absorbed into Ship 5 plant-profile redesign.
- **`F-T`** — Permanent plant + 0 packets opens seed-packet form. No longer blocked on `Q17`; same Ship 5 absorption as `F-H`.

---

## 6. Recommended ship sequence

**Phasing is intentional.** Phase 1 gets Syd a functioning, less-leaky product fast. Phase 2 layers the structural redesign on top once Phase 1 is shipped and stable. The risk of phasing is *"Phase 2 never ships"* — mitigated by capturing the Phase 2 plan thoroughly (which is what this doc does) and a soft commitment to start Phase 2 within X weeks of Phase 1 landing.

### Phase 1 — Finish current build + ship soon (weeks)

- **Ship 1a** — No-decision bug fixes (`F-F` + `F11` + `E5` + `CAL-F7` + `F-I`). `F-I` joins Ship 1a now that §3.17 (tier decrement) is locked. 1-2 weeks. Doc-only or single bug-fix PR per item.
- **Ship 1b** — Plant Again UX cleanup absorbing `F-H` + `F-T`. Sequenced ahead of Ship 5 since both are real 0-packet bugs even with tier decrement in place; routes packet-empty → planting-modal correctly.
- **Ship 2** — Cohesion pass + Calendar polish in one PR:
  - Modal anchors, submit verbs (six verbs for one action today), back-arrow consistency, photo-upload button label alignment (*"From gallery"* / *"Choose from Files"* / *"Choose from files"*), *"Add new"* vs *"Create new"* alignment
  - **Plant-instance identity in Calendar task rows** (§3.18, `CAL-3`)
  - **`/schedule` cross-link from Calendar header** (§3.18, `CQ4`)
  - **Frost overlay on Calendar grid cells** (§3.18, `CQ2`)
- **Ship 3** — **Merge Active Garden + My Plants into a single Garden page** with filters. Remove the Permanent/Seasonal UI toggle from Add Plant; smart defaults derive from `profile.lifecycle_type` (§3.13). UI consolidation — schema-edits scoped to enabling the merged view. This is the bridge to Phase 2's Zones (the merged Garden page becomes the surface Zones replace later).
- **Ship 4** — **App voice sweep** across remaining surfaces. Chatty copy → plain action-led labels per the locked voice rule (§3.12). Audit and rewrite any *"Do you want to...?"* / *"Would you like to...?"* / conversational-AI framing.
- **Ship 5** — **Plant profile redesign** (§3.13 + §3.14 + §3.15 + §3.16 + §3.17). Schema: add `lifecycle_pattern` enum (`annual` / `perennial-single-harvest` / `perennial-continuous-pick` / `biennial`) to `plant_profiles`; backfill from variety enrichment with `annual` fallback. Capture user's zone at signup or in Settings; drop the hardcoded `zone10b` default everywhere. Profile UI: vendor-derived field set (botanical name, mature spread, light requirement, hardiness zone range, growth habit, chill hours, pollination, fruit-bearing season, foliage description, etc.); variety-type-aware visibility; collapsible groups (Identity / Key Attributes / Variety-type details / Care / Notes); all new fields optional; surfaces silently-captured `scientific_name` + `mature_spread` + `mature_height`. Add the *"When You Grow"* zone-aware timing section. Auto-derive `grow_instance` permanence from `profile.lifecycle_pattern`; deprecate per-planting `is_permanent_planting` UI surface. Seed-count field becomes optional + AI-enriched from photo/scan-receipt. Packet tier-decrement applied consistently across all plant actions (§3.17).
- **Ship 6** — **Website parity sweep.** Both app + website pass cohesion + functionality so the marketing/landing surface matches the in-app experience post-redesign.

### Phase 2 — The redesign rollout (months)

- **Zones / location-tabs as primary nav** — replaces Phase 1's merged Garden page from Ship 3.
- **Log-driven state derivation** — logging IS state management (§3.5).
- **Stage-aware lifecycle (data model only)** — the stage-as-data layer locks in; **stage-as-UI representation TBD** in coordination with family-mode rework (§3.5 UI options + must-pass criteria).
- **Split-on-partial-count** (§3.7) — schema add (`split_from` FK) + log forms.
- **Add Plant subcategories** (Start from seed / Add already-grown) + **sow method chips** (§3.2, §3.3).
- **End-lifecycle terminal state** (§3.9) — terminal stage + reasons + tab-delete-with-plants flow.
- **Migration plan** — auto-create Garden + Permanent zones for existing users; one-time onboarding tooltip locked: *"Your garden was reorganized into Garden + Permanent zones. You can rename or add new zones anytime."* (§3.10).
- **Compare / analytics tab** on Plant profile (§3.11).

### Phase 3 — Push notifications (post-Phase-2 standout ship)

**Locked: push notifications are Phase 3+, NOT MVP** (resolves `Q6`/`TQ2`/`CQ1`).

Rationale: Syd wants to see actual app usage patterns first before committing weeks of work to a notification engine. Phase 2 (Zones + log-driven state + Compare tab) is higher value per token. Notifications become the standout Phase 3 ship — engaging users back into the app after they've built habits via Phase 1 + 2.

Scope when it ships: push notification engine, task reminders (with quiet-hours respect), frost warnings (joins §3.18 frost overlay → push), harvest-window reminders for `perennial-single-harvest` plants, optional digest cadence.

### Beyond Phase 3

- Missing data structuring: sun exposure enum, container vs in-ground, time-of-day on tasks. Each is its own ship.
- Cross-variety analytics ("Insights") for Maya-persona power users.

### Sow+harvest refactor — slot inside whichever phase it lands

Collapse the 5 parallel insert paths in `AddPlantModal` / `vault/plant/page` / `VaultPageContent` (×2) / `review-import` into one helper. Fix `T1` (permanent gets sow task). Enable `T9` (recurring harvest for continuous-pick crops via `care_schedules`). Single biggest leverage refactor — fits naturally into Phase 2 alongside log-driven state derivation, but could be pulled into Phase 1 if a sow-task bug forces it.

---

## 7. Audit findings cross-reference (for future chats)

- **FAB audit** (chat `admiring-carson-81435d`, idle): F1-F21 friction items, including Seed-vs-Plant ambiguity (F1), double-asked Permanent/Seasonal (F2), modal anchor variance (F5), submit verb inconsistency (F6), Sam-persona empty-state landings (F4), etc.
- **Photo + Journal audit** (chat `youthful-napier-8a9bc5`, idle): C1-C12 cross-cutting items + F11 multi-photo bug scoped to `QuickLogModal` only. 8 journal entry points, 3 different modals.
- **Edit Plant Profile audit** (chat `xenodochial-mayer-1dd58d`, idle): E1-E15 friction items. 17-field inventory. E5 silent-drop bug. Silently-unused fields (`purchase_vendor`, `mature_height`, `mature_width`, `scientific_name`, `purchase_nursery`).
  - **Convergence with §3.14 vendor-derived field set:** Ship 5 surfaces `scientific_name` (→ Botanical Name), `mature_height` (→ Mature height in Key Attributes), `mature_width` (→ Mature spread). `purchase_nursery` confirmed redundant with existing `purchase_vendor`; recommend deprecating `purchase_nursery` in Ship 5 to collapse the duplicate. `purchase_vendor` display surface remains open as `Q14`.
- **Plant Again audit** (chat `youthful-napier-8a9bc5`, idle): F-A through F-T friction items + 3 critical bugs (F-F seasonal forcing, F-H 0-packet sidetrack, F-I full packet archive).
- **Tasks Lifecycle audit v2** (chat `zealous-bhaskara-8eff9d`, idle): T1-T12 friction items. 5 parallel sow+harvest insert paths. No push notifications. No `uncompleteTask`. `tasks.title` denormalized. `NewTaskModal` exposes 4 of 9 task categories.
- **Calendar UI audit** (chat `elastic-bhabha-12fb89`, idle): CAL-F1 through CAL-F12 friction items + CAL-M1 through CAL-M12 missing-data items. No "Today" jump. No push notifications. Phone-portrait swipe-only with no affordance. Recurring task interval uneditable.

Future code chats can read these transcripts via `read_transcript` from Dispatch.

---

## 8. Open validation work

The multi-month redesign was designed on Syd's dogfooding alone (1 user, who is also the product owner). Worth informal validation with another non-technical gardener (Sam-equivalent: day-1 new; Walter-equivalent: low-tech-comfort) **before** committing to the multi-month Phase 2 restructure. Show the pitch, get reaction, adjust.
