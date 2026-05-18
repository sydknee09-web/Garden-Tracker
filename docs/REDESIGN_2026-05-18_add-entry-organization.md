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
- **Add already-grown** — anything already alive when acquired (nursery, gift, division, mature plant). Captures: variety, source, acquisition date, location.

Indoor-start-to-transplant case is captured via an optional *"started indoors on [date]"* field inside Start-from-seed, not a separate option.

### 3.3 — Sow method chips

Inside the "Start from seed" form, four chip options:

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

**System default "Plants" zone — smart show/hide:**

- Brand new user (no plants, no zones): no tabs visible. Empty-state copy: *"Add a plant or set up a garden zone to get started."*
- User adds first plant without picking/creating a zone: "Plants" materializes as a real zone and the plant lands there
- User creates own zones AND no plants remain in "Plants": "Plants" auto-hides
- If user later adds a plant without specifying location: "Plants" reappears

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

DTM only displays for plants where *"matures on day N"* is meaningful. Continuous-pick crops (oregano, herbs, lettuce, beans) stay in "Harvestable" stage indefinitely with no false "mature-and-done" lie. Lifecycle pattern (annual / perennial / biennial / continuous-pick / single-harvest) is a property of the plant profile, drives whether DTM is shown.

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

---

## 4. Open questions still pending Syd's decision

Carry forward — these need her input before related work can ship:

1. **Per-instance card layout** — the planting instance card is underdeveloped today. Need to sketch what the new card contains (stage badge + location + dates + journal thread + photos) and how info ranks visually. Both mobile and desktop layouts.
2. **"Add already-grown" source options** — locked enum (Nursery / Gift / Division / Mature plant moved) or free text?
3. **Sow method chip count** — keep all 4 (Direct sow / Indoor / Greenhouse / Outdoor start) or merge similar ones (Greenhouse + Outdoor start are functionally similar — both two-event with start spot + transplant)?
4. **Default zone name** — "Plants" or "Garden"?
5. **Onboarding tooltip on post-migration first login** — yes or silent migration?
6. **Notification engine** (`TQ2`/`CQ1`) — push notifications: yes / no / when? Biggest absent feature flagged in audits. Decision shapes Ship 6 significantly.
7. **Recurring task interval editability** (`CAL-F7`) — fix shape: add toggle + interval to `NewTaskModal` edit mode, or keep Care-tab-only and surface "Manage schedule" deep-link?
8. **Weather + calendar join** (`CQ2`) — frost overlay on calendar grid cells using existing Home forecast data?
9. **`/schedule` cross-link from Calendar** (`CQ4`)?
10. **Plant-instance identity in calendar task rows** (`CQ5`/`CAL-3`) — show `grow_instance` location/sown-date when multiple plantings of same profile?
11. **Edit Plant Profile structured fields** — Sun / Water / Spacing / Sowing Method → enum selects with "Other" fallback, or stay free-text?
12. **`profile_type` editability** — accept lock-forever or make editable from Edit Plant Profile?
13. **Growing Notes catch-all** — keep as free-text or promote common content (location, health, amendments) to structured fields?
14. **`purchase_vendor` display** — exposed somewhere on read-side, or deprecate the field?
15. **Tags editable inline from Edit Plant Profile** — instead of routing to separate `/vault/tags` page?
16. **17-field Edit Plant Profile collapse** — group into Identity / How to Grow / Companion / Propagation / Notes sections with collapse?
17. **Packet decrement rule on planting** — today: full archive of selected packet. Better: tier decrement / ask user how much / no auto-decrement? **Blocks `F-I` bug fix.**
18. **Permanent vs Seasonal type lock** — accept lock-forever (delete + re-create to fix misclassification) or make editable?
19. **Multi-grow flow** for power users — save+continue, per-bed multi-select inside one modal, or accept N full cycles?
20. **Button copy naming** — "Add Plant" or "Plant Again" (engineering uses latter; UI shows former everywhere)?
21. **`uncompleteTask` flow** — undo recent task complete with full rollback, or accept "delete and recreate"?
22. **Sow→harvest pair migrate to `care_schedules`** (`T9`) — so continuous-pick crops get repeating harvest tasks?
23. **Per-plant "stop auto-tasks" toggle** — surface on plant profile?
24. **`tasks.title` denormalized** (`T11`) — fix on read or accept stale history?
25. **Tags + filters layer for power users** (Maya-persona, "show me all tomatoes across all zones") — when to build, MVP or later?

---

## 5. Bugs to ship independent of the redesign

These were surfaced by audits and don't depend on the redesign. Ship them in the next 1-2 weeks regardless:

### No-decision (Ship 1a):

- **`F-F`** — Plant Again from seasonal profile silently records as permanent. `useEffect` at `AddPlantModal.tsx:104-120` force-sets `plantType="permanent"` ignoring the `defaultPlantType` prop. ~10 min fix.
- **`F11`** — `QuickLogModal` saves only `photos[0]` despite multi-photo UI. Affects 5 of 8 journal entry points (FAB Add journal, Journal page +Entry, Vault Journal tab, Vault Plantings tab per-grow). `BatchLogSheet` + `EditJournalModal` handle multi-photo correctly. ~30 min fix mirroring `BatchLogSheet`'s loop.
- **`E5`** — Edit Plant Profile silently drops 5 fields (Sowing Method, Planting Window, Companion plants, Avoid plants, Vendor/Nursery) for legacy `plant_varieties` profiles. Form renders fields, save handler excludes them. ~15 min fix (conditional rendering or honest save).
- **`CAL-F7`** — Recurring task interval uneditable from Calendar. `NewTaskModal` in edit mode hides the recurring toggle (`{!editTask && ...}` at line 319). ~30 min fix.

### Decision-gated (Ship 1b):

- **`F-H`** — Plant Again with 0 packets opens packet-inventory modal, not planting modal. Blocked on Q1 (Seed vs Plant collapse) or Q17 (packet rule).
- **`F-I`** — Entire packet archived on plant, regardless of quantity. Blocked on Q17.
- **`F-T`** — Permanent plant + 0 packets opens seed-packet form. Blocked on Q1 / Q17.

---

## 6. Recommended ship sequence

**Phasing is intentional.** Phase 1 gets Syd a functioning, less-leaky product fast. Phase 2 layers the structural redesign on top once Phase 1 is shipped and stable. The risk of phasing is *"Phase 2 never ships"* — mitigated by capturing the Phase 2 plan thoroughly (which is what this doc does) and a soft commitment to start Phase 2 within X weeks of Phase 1 landing.

### Phase 1 — Finish current build + ship soon (weeks)

- **Ship 1a** — No-decision bug fixes (`F-F` + `F11` + `E5` + `CAL-F7`). 1-2 weeks. Doc-only or single bug-fix PR per item.
- **Ship 1b** — Decision-gated bug fixes (`F-H` + `F-I` + `F-T`). After Q1 + Q17 decisions land.
- **Ship 2** — Cohesion pass: modal anchors, submit verbs (six verbs for one action today), back-arrow consistency, photo-upload button label alignment (*"From gallery"* / *"Choose from Files"* / *"Choose from files"*), *"Add new"* vs *"Create new"* alignment. One PR.
- **Ship 3** — **Merge Active Garden + My Plants into a single Garden page with filters.** Permanent / Seasonal becomes a filter, not separate tabs. UI consolidation only — schema unchanged. This is the bridge to Phase 2's Zones (the merged Garden page becomes the surface Zones replace later).
- **Ship 4** — **App voice sweep** across remaining surfaces. Chatty copy → plain action-led labels per the locked voice rule (§3.12). Audit and rewrite any *"Do you want to...?"* / *"Would you like to...?"* / conversational-AI framing.

### Phase 2 — The redesign rollout (months)

- **Zones / location-tabs as primary nav** — replaces Phase 1's merged Garden page from Ship 3.
- **Log-driven state derivation** — logging IS state management (§3.5).
- **Stage-aware lifecycle (data model only)** — the stage-as-data layer locks in; stage-as-UI is decided here in coordination with family-mode rework (§3.5 UI options + must-pass criteria).
- **Split-on-partial-count** (§3.7) — schema add (`split_from` FK) + log forms.
- **Add Plant subcategories** (Start from seed / Add already-grown) + **sow method chips** (§3.2, §3.3).
- **End-lifecycle terminal state** (§3.9) — terminal stage + reasons + tab-delete-with-plants flow.
- **Migration plan** — auto-create Garden + Permanent zones for existing users (§3.10).
- **Compare / analytics tab** on Plant profile (§3.11).

### Beyond Phase 2

- Missing data structuring: sun exposure enum, container vs in-ground, time-of-day on tasks, push notification engine. Each is its own ship; sequencing depends on Q6 (notifications) decision.
- Cross-variety analytics ("Insights") for Maya-persona power users.

### Sow+harvest refactor — slot inside whichever phase it lands

Collapse the 5 parallel insert paths in `AddPlantModal` / `vault/plant/page` / `VaultPageContent` (×2) / `review-import` into one helper. Fix `T1` (permanent gets sow task). Enable `T9` (recurring harvest for continuous-pick crops via `care_schedules`). Single biggest leverage refactor — fits naturally into Phase 2 alongside log-driven state derivation, but could be pulled into Phase 1 if a sow-task bug forces it.

---

## 7. Audit findings cross-reference (for future chats)

- **FAB audit** (chat `admiring-carson-81435d`, idle): F1-F21 friction items, including Seed-vs-Plant ambiguity (F1), double-asked Permanent/Seasonal (F2), modal anchor variance (F5), submit verb inconsistency (F6), Sam-persona empty-state landings (F4), etc.
- **Photo + Journal audit** (chat `youthful-napier-8a9bc5`, idle): C1-C12 cross-cutting items + F11 multi-photo bug scoped to `QuickLogModal` only. 8 journal entry points, 3 different modals.
- **Edit Plant Profile audit** (chat `xenodochial-mayer-1dd58d`, idle): E1-E15 friction items. 17-field inventory. E5 silent-drop bug. Silently-unused fields (`purchase_vendor`, `mature_height`, `mature_width`, `scientific_name`, `purchase_nursery`).
- **Plant Again audit** (chat `youthful-napier-8a9bc5`, idle): F-A through F-T friction items + 3 critical bugs (F-F seasonal forcing, F-H 0-packet sidetrack, F-I full packet archive).
- **Tasks Lifecycle audit v2** (chat `zealous-bhaskara-8eff9d`, idle): T1-T12 friction items. 5 parallel sow+harvest insert paths. No push notifications. No `uncompleteTask`. `tasks.title` denormalized. `NewTaskModal` exposes 4 of 9 task categories.
- **Calendar UI audit** (chat `elastic-bhabha-12fb89`, idle): CAL-F1 through CAL-F12 friction items + CAL-M1 through CAL-M12 missing-data items. No "Today" jump. No push notifications. Phone-portrait swipe-only with no affordance. Recurring task interval uneditable.

Future code chats can read these transcripts via `read_transcript` from Dispatch.

---

## 8. Open validation work

The multi-month redesign was designed on Syd's dogfooding alone (1 user, who is also the product owner). Worth informal validation with another non-technical gardener (Sam-equivalent: day-1 new; Walter-equivalent: low-tech-comfort) **before** committing to the multi-month Phase 2 restructure. Show the pitch, get reaction, adjust.
