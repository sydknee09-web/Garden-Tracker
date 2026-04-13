# Voyager Sanctuary — Master Ledger: Architecture Overhaul & Fixes

**Status:** Locked — Officially signed off (March 2026)  
**Purpose:** Single source of truth for technical fixes, UI cleanup, terminology refactor, schema additions, guided flow redesign, and lifecycle management.  
**Related:** [ALIGNMENT_OUTCOME_SPEC.md](ALIGNMENT_OUTCOME_SPEC.md) — Architectural Blueprint (signed off). [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md) — Pre-implementation audit. [FEATURES_EXPANSION_DOC.md](FEATURES_EXPANSION_DOC.md) — Deferred features and why.

**Sanctuary DNA:** Refined, Functional, Intent-focused. Move from rigid list to malleable terrain.

---

## Table of Contents

1. [Technical Fixes & UI Cleanup](#1-technical-fixes--ui-cleanup)
2. [Database & Schema Additions](#2-database--schema-additions) — includes Schema in Tree, Strategic Guardrails
3. [Terminology Refactor](#3-terminology-refactor)
4. [Guided State-Machine Flow (Creation Wizard)](#4-guided-state-machine-flow-creation-wizard)
5. [Navigation & Entry Points](#5-navigation--entry-points)
6. [Lifecycle & Map Management](#6-lifecycle--map-management)
7. [Implementation Mapping & Gaps](#7-implementation-mapping--gaps)

---

## 1. Technical Fixes & UI Cleanup

| ID | Issue / Feature | The Problem | The Technical Action | Current Code Location |
|:---|:----------------|:------------|:--------------------|:----------------------|
| **F1** | **The "Loop" Bug** | Adding a pebble resets the UI view back to Landmark Index 0. User loses context and must re-navigate to the correct landmark. | Update `ClimbFlowNotifier` and `_createPebbleAndAnimate` to **preserve** `pebbleStepBoulderIndex` on pebble creation. Audit: ensure `ref.invalidate(nodeListProvider)` does not trigger any provider cascade that resets `climbFlowProvider`. Do NOT call `setPebbleStepBoulderIndex(0)` or `setStep` when creating a pebble. | `climb_flow_overlay.dart` L234–286, `climb_flow_provider.dart` |
| **F2** | **Redundant Buttons** | "Add" and "Add Another" are confusing; "Add Stone" (if present) is broken/duplicative. | **Two buttons:** Primary: **"Plant Pebble"**. Secondary (ghost button): **"Plant & Next Area"**. Rewards power users without cluttering the Refined UI. Remove "Add" and "Add Another". | `climb_flow_overlay.dart` L700–770 `_NamePebbleCard` |
| **F3** | **Navigation Friction** | "Add Goal" / "Climb New Mountain" is buried: user must go Satchel → Management → Pack, or Scroll Map → FAB. Creation feels disconnected from the Hearth. | Add a direct **"New Journey"** trigger from Elias at the Hearth. When user taps Elias, show Management sheet with "New Journey" as the first/prominent option. Bypass Satchel for creation. Route: Sanctuary → tap Elias → "New Journey" → Climb/creation flow. | `sanctuary_screen.dart` L318–327 `_EliasWidget`, `management_menu_sheet.dart` |
| **F4** | **The 4-Marker Wall** | App forces exactly 4 landmarks. Users with 1–3 or 5–10 phases hit friction. | Implement **dynamic landmark list**: minimum 1, maximum 10. Replace fixed `List.generate(4, ...)` with `List.generate(landmarkCount, ...)`. Add "+ Add Landmark" and "- Remove" (when count > 1). On attempt to add 11th: Elias *"Heavy Satchel"* warning. | `climb_flow_overlay.dart` L31–32, L369–430 `_Step2Landmarks`, `_LandmarkField` |
| **F5** | **Terminology** | "Scroll" implies a top-to-bottom list; "Mountain" is less intuitive than "Peak" for a single goal. | Refactor UI copy: **"Map"** = the whole project/view; **"Peak"** = a specific goal (current "Mountain"). See [§3 Terminology Refactor](#3-terminology-refactor). | App-wide: `elias_dialogue.dart`, `scroll_map_screen.dart`, `satchel_screen.dart`, `app.dart` routes |

---

## 2. Database & Schema Additions

**Cursor must use existing DB column names to avoid migration hell.**

| Column / Field | Table / Model | Type | Purpose |
|:---------------|:--------------|:-----|:--------|
| **`intent_statement`** | `mountains` | `TEXT` (nullable) | Captures the "Why" before the "What". Step 0 of the new guided flow. **Cap: 1,000 characters.** |
| **`name`** | `mountains` | `TEXT` (not null) | The Identity. Use `name` in DB; display as "title" in UI. |
| **`layout_type`** | `mountains` | `TEXT` / Enum | `climb` = Sequential; `survey` = Categorical. Default: `climb`. |
| **`appearance_style`** | `mountains` | `TEXT` / Enum | Step 2 (Appearance). Values: `dark_walnut`, `navy`, `slate`, `charcoal`, `burgundy`, `forest`. Default: `slate`. Syncs across devices. |
| **`is_archived`** | `mountains` | `BOOLEAN` | **Already exists.** Default: `false`. Used for "Abandon Peak". |
| **`pebble_logic`** | `nodes` (boulder) | `TEXT` / Enum | Per-marker override. **Store in Phase 1** (default `freeform`). **UI in Phase 2.** |

### Migration Sketch

```sql
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS intent_statement TEXT;
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS layout_type TEXT DEFAULT 'climb' CHECK (layout_type IN ('climb', 'survey'));
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS pebble_logic TEXT DEFAULT 'freeform' CHECK (pebble_logic IN ('sequential', 'freeform'));
```

### Model Updates (Dart)

- **`Mountain`**: add `String? intentStatement`, `String layoutType` (default `'climb'`). Use `name` (existing).
- **`Node`** (boulder): add `String pebbleLogic` (default `'freeform'`). UI toggle in Phase 2.

### Schema in the Tree Hierarchy (Phase 1)

**Phase 1:** Both Climb and Survey use the **same tree layout**. The DB stores `layout_type` and `pebble_logic`; the visual engine renders all peaks as branches. Phase 2 will switch Survey peaks to an Island layout.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PEAK (mountains)                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ intent_statement  │  The "Why" — Step 1. Cap 1000 chars.            │    │
│  │ name              │  The Identity — Step 2. Display as "title".     │    │
│  │ layout_type       │  'climb' | 'survey'. Step 3. Default: climb.    │    │
│  │ is_archived       │  Abandon Peak → true.                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         │  Phase 1: BOTH use tree. layout_type = terminology only.           │
│         │  Phase 2: layout_type = 'survey' → Island layout.                 │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ MARKER / BOULDER (nodes, parent = mountain)                         │    │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │ │ pebble_logic  │  'sequential' | 'freeform'. Default: freeform.   │ │    │
│  │ │               │  Store Phase 1; UI toggle Phase 2.                │ │    │
│  │ │ order_index   │  Order within peak.                              │ │    │
│  │ │ title         │  Milestone/Region name.                            │ │    │
│  │ └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PEBBLE (nodes, parent = boulder)                                    │    │
│  │ title, order_index, is_complete, ...                                 │    │
│  │ Logic & Leaf: pebble with shards = container; logic for shards.      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SHARD (nodes, parent = pebble)                                      │    │
│  │ Sub-tasks. Logic & Leaf: actionable; packable when pebble has them. │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
Logic & Leaf: Sub-boulders (Boulder → Boulder) supported. LTREE arbitrary depth.
```

**Cursor implementation note:** When rendering the Map, read `mountain.layoutType` for terminology (Milestone vs Region labels). Use the **same tree widget** for both. Do not branch on layout_type for layout engine in Phase 1.

---

### Strategic Guardrails (Final Handshake)

| Guardrail | Behavior | Why |
|:----------|:---------|:----|
| **Data integrity** | Pre-Flight JSON maps directly to DB columns (`intent_statement`, `name`). No aliases. | Prevents "Migration Hell" — Cursor uses existing column names. |
| **Elias at 3-Peak cap** | Block Promote when user has 3 active peaks. Elias: *"You're at the peak limit. Archive one before promoting."* | Forces choice between "Idea Lust" and "Goal Completion" — heart of Voyager philosophy. |
| **Miscellaneous** | Branch Removal → "Move to General" creates a **new marker at the bottom of the same peak**. Pebbles move there. | Clean branch removal without losing data to a global void. |

---

## 3. Terminology Refactor

| Old Term | New Term | Where Used |
|:---------|:---------|:-----------|
| **Scroll** | **Map** | Screen title "The Scroll" → "The Map"; route `/scroll` can stay; UI labels "Return to Map", "Open Map". |
| **Mountain** | **Peak** | In creation flow, Elias, and user-facing copy. Internal code (`mountain_id`, `Mountain`) can remain; display as "Peak". |
| **Landmark** (Climb) | **Milestone** | Sequential/Climb: markers displayed as "Milestones". |
| **Landmark** (Survey) | **Region** | Categorical/Survey: markers displayed as "Regions". |
| **Code** | **Marker** | Both Milestones and Regions are `Marker` / `boulder` in schema. |
| **Climb New Mountain** | **New Journey** | Primary CTA for creation. |

### Step 4 Contextual Labels (Wizard)

The wizard **must** adapt labels based on Step 3 choice:
- **If Climb:** Input fields labeled "Milestone 1", "Milestone 2", "Milestone 3"…
- **If Survey:** Input fields labeled "Region 1", "Region 2", "Region 3"…
- **Internal code:** Always `Marker` or `boulder`.

### Scope

- **Elias dialogue**: Replace "Scroll" with "Map", "mountain" with "peak" where user-facing.
- **Route names**: `/scroll` can remain; semantic label = "Map".

---

## 4. Guided State-Machine Flow (Creation Wizard)

The creation process is rebuilt as a **step-by-step wizard**. User cannot advance until the current state is satisfied.

| Step | Name | UI | Elias Prompt | Validation |
|:-----|:-----|:---|:-------------|:-----------|
| **1** | **The Intent** | Dimmed UI. Multi-line input. **Cap: 1,000 characters.** | *"Before we map the terrain, what are we reaching for, and why does this journey matter?"* | Non-empty. On 1000 cap: Elias *"Keep it focused. The peak is won with clarity, not volume."* |
| **2** | **The Identity** | Single-line input. | *"Let's give this journey a name—a title for the peak."* | Non-empty. |
| **3** | **The Logic** | Toggle selection. | Choose **The Climb** (Step-by-Step) or **The Survey** (Collection of Areas). | Required. |
| **4** | **The Markers** | Dynamic list (1–10). | Name each marker/area. "+ Add" / "- Remove". | All named; min 1, max 10. On 11th add: *"Heavy Satchel"* warning. |
| **5** | **Placing stones** | Isolated pebble entry per marker. | UI stays locked on current marker until user taps **"Next Area"**. | No empty pebbles. |

### State Machine Rules

- **Lock on current marker**: In Step 5, do not auto-advance or reset `pebbleStepBoulderIndex` when a pebble is added. User explicitly taps "Next Area" to move.
- **No skip**: User must complete each step before advancing.
- **Back**: Allow "Return to Map" with unsaved warning (existing behavior).

### Mapping to Current Code

| New Step | Current Equivalent | Changes |
|:---------|:-------------------|:--------|
| 1. Intent | (new) | Add before current Step 1. Save to `intent_statement`. |
| 2. Identity | Current Step 1 (Name the Peak) | Same; ensure `intent_statement` saved first. |
| 3. Logic | (new) | Add after Identity. Save to `layout_type`. |
| 4. Markers | Current Step 2 (Four Landmarks) | Make dynamic 1–10; remove fixed 4. |
| 5. Placing stones | Current Step 3 (Pebbles) | Fix Loop bug; lock on current marker. |

---

## 5. Navigation & Entry Points

| Action | Current | Target |
|:-------|:--------|:-------|
| **New Journey** | Satchel → Management → Pack, or Scroll Map FAB | **Sanctuary → Tap Elias → "New Journey"** (first option in sheet). Also keep Map FAB for power users. |
| **Open Map** | Satchel → "The Scroll" tile; empty slot → Management | Add direct **"Open Map"** from Sanctuary (e.g. small icon near Elias or in tray). |
| **Pack Satchel** | Management → Pack Satchel | Keep; also available from Satchel screen. |
| **Archive Recovery** | Management → Archive Recovery | Keep. |

---

## 5b. Map Visual Layout — Phase 1 vs Phase 2

| Phase | Logic | Layout | Notes |
|:------|:------|:-------|:------|
| **Phase 1** | Both logic (DB + Step 3 UI). Ship `layout_type` and Step 3 choice. | **One layout:** Climb (tree) for both. | Survey peaks use same hierarchical tree. Step 3 = **terminology only** (Milestone vs Region). |
| **Phase 2** | — | **Island/Constellation** for Survey. | Markers spread out, no connecting lines. Sanctuary map, not ladder. |

---

## 6. Lifecycle & Map Management

| Action | Execution | Notes |
|:-------|:----------|:------|
| **Abandon Peak** | Toggle `is_archived`. Move to Archive Recovery. | Exists: `mountainActionsProvider.archive()`. |
| **Bones View** | **Tap** Peak title → open. See [§6b](#6b-bones-view-blueprint-drawer). | **Tap** (not long-press). "Inspecting the architecture." |
| **Clear the Path** | Swipe-left on pebble → surgically delete. | Exists: `Slidable` delete. Label "Clear". |
| **Branch Removal** | Long-press on Marker → cascade. **Move to General:** Creates "Miscellaneous" region at **bottom of same peak** for those pebbles. **Scatter:** Hard delete. Elias: *"Are you sure? These memories will be lost to the wind."* | **New.** Miscellaneous = same peak, bottom of list. |
| **Level Up (Promote)** | Button on pebble → converts to **Sibling Peak**. **At 3-peak cap:** Block with Elias. **Shards:** Move with (become pebbles in new Peak's first Milestone). | **New.** Block at cap. Shards move with. |

### 6b. Bones View (Blueprint Drawer)

**The Peak's Heart.** Replaces the current Options sheet. High-level + admin only. Individual nodes stay on the Map for editing.

| Section | Content |
|:--------|:--------|
| **Top** | Editable Intent Statement. |
| **Middle** | Visual Hierarchy Overview — **non-interactive** tree structure. Small-scale map of Milestones/Regions. Read-only. |
| **Bottom** | Administrative Actions: Rename, Archive, Delete. |

**Trigger:** Tap on the Peak Title in the Map view. (Long-press = aggressive actions; tap = inspecting the architecture.)

---

## 7. Implementation Mapping & Gaps

### Ready to Implement (Clear Mapping)

| ID | Item | Notes |
|:---|:-----|:------|
| F1 | Loop bug fix | Preserve `pebbleStepBoulderIndex`; audit provider dependencies. |
| F2 | Button consolidation | Replace "Add" / "Add another" with "Place Pebble" (and optionally "Place & Next Area"). |
| F3 | New Journey from Elias | Add "New Journey" to Management sheet; open Climb flow. Consider making it the first item. |
| F4 | Dynamic 1–10 markers | Replace fixed 4 with dynamic list; add +/- controls; 11th = Elias warning. |
| F5 | Terminology | Systematic find-replace in user-facing strings; "Scroll"→"Map", "Mountain"→"Peak" in copy. |
| Schema | intent_statement, layout_type, pebble_logic | Migration + model updates. |
| Flow | Steps 1–5 wizard | Insert Intent + Logic steps; make Markers dynamic; fix Placing stones lock. |
| Abandon Peak | Already exists | Verify wording. |
| Edit Peak | Extend Rename to Blueprint | Add intent + layout_type editing. |
| Clear the Path | Exists (Slidable delete) | Verify swipe-left and label. |

### Resolved (Official Sign-Off — March 2026)

| ID | Item | Resolution |
|:---|:-----|:-----------|
| Promote at 3-peak cap | Block or allow? | **Block** with Elias. Keeps 3-Peak limit sacred. |
| Promote + Shards | Move or block? | **Shards move with.** Become pebbles in new Peak's first Milestone. |
| Miscellaneous | Where? | **Same peak, bottom of list.** e.g. "Hillside: Miscellaneous." |
| Bones trigger | Tap or long-press? | **Tap title.** Long-press = delete/move; tap = inspect. |
| Intent length | Cap? | **1,000 characters.** Elias: *"Keep it focused. The peak is won with clarity, not volume."* |
| Survey layout | Phase 1 or 2? | **Phase 1:** Both logic, 1 layout (Climb tree for both). **Phase 2:** Island/Constellation. |
| Step 4 labels | Contextual? | **Milestone 1, 2, 3…** (Climb) or **Region 1, 2, 3…** (Survey). |
| DB column names | Use what? | **intent_statement, name, layout_type, is_archived.** No aliases. |
| Bones view | Structure? | Top: Intent. Middle: **Non-interactive** hierarchy. Bottom: Rename, Archive, Delete. Individual nodes edited on Map. |
| 14a–14e | Scenario gaps | 14a: Bones = high-level + admin. 14b–c: Promote to Marker, Demote = Phase 2. 14d: pebble_logic store only, UI Phase 2. 14e: Move to General = soft hide. |

---

## 8. Implementation Order (Suggested)

1. **F1** — Loop bug (quick win, high impact)
2. **F2** — Button consolidation ("Plant Pebble")
3. **F4** — Dynamic 1–10 markers (reduces friction)
4. **F3** — New Journey from Elias (navigation)
5. **F5** — Terminology refactor (can be incremental)
6. **Schema** — Migration + model updates
7. **Flow** — Add Intent + Logic steps; wire to new schema
8. **Lifecycle** — Branch Removal, Level Up (Promote)
9. **Edit Peak** — Blueprint drawer extension

---

## 9. Cursor / Master Prompt Hooks

When feeding this into Cursor:

- **Rule file**: Create `.cursor/rules/voyager-sanctuary-ledger.mdc` that references this doc and enforces: (1) preserve `pebbleStepBoulderIndex` on pebble create; (2) use "Plant Pebble" not "Add"/"Add another"; (3) dynamic 1–10 markers; (4) "Map" and "Peak" in user-facing copy.
- **Implementation prompts**: Use section IDs (e.g. "Implement F1 from MASTER_LEDGER") for scoped changes.
- **Schema changes**: Run migrations before model/repo updates.

---

## 10. Developer Pre-Flight Schema

**Use DB column names.** Cursor must not create aliases.

| Concept | DB Column | Type |
|:--------|:----------|:-----|
| The Why | `intent_statement` | TEXT, nullable, max 1000 |
| The Identity | `name` | TEXT, not null |
| Logic | `layout_type` | `climb` \| `survey`, default `climb` |
| Status | `is_archived` | BOOLEAN, default false |
| Markers | `nodes` (boulder) | `order_index`, `title` |
| Pebble logic (per marker) | `pebble_logic` | `sequential` \| `freeform`, default `freeform`. Store Phase 1; UI Phase 2. |

**Step 4 labels:** "Milestone N" (Climb) or "Region N" (Survey). Code: always `Marker`/`boulder`.

---

## 11. Creation Wizard — Phase 1 Logic

Implement the **5-Step Wizard** immediately. Step 3 selection determines **terminology only** for now.

- **Phase 1:** Store `layout_type` in DB. Step 3 UI: Climb vs Survey. Step 4 labels: Milestone (Climb) or Region (Survey).
- **Phase 1:** Same hierarchical (tree) layout for **both** Climb and Survey peaks.
- **Phase 2:** Add Island/Constellation visual for Survey peaks once base logic is stable.

---

## 12. Phase 1 Technical Checklist

- [x] **DB Migration:** Add `intent_statement`, `layout_type`, `pebble_logic` columns.
- [x] **Elias Management:** Add "New Journey" as the first list item.
- [x] **Wizard Implementation:** Build the 5-step overlay with dynamic 1–10 Marker list.
- [x] **Loop Bug Fix:** Ensure Step 5 (Placing stones) maintains state on the current Marker.
- [x] **Demo Mode:** Update DemoStorage to support new fields.
- [x] **Bones View:** Tap peak title → Intent, Hierarchy, Rename, Archive. Logic (Climb/Survey) editable.
- [x] **Terminology (F5):** Map, Peak, Milestone/Region in user-facing copy.

---

## 13. Changelog

| Date | Change |
|:-----|:-------|
| 2026-03 | Initial master ledger. Consolidated user feedback, technical audit, spec. |
| 2026-03 | **Official sign-off.** Terminology (Region/Milestone/Marker), Bones view, Branch Removal, Promote, Layout types, Pre-Flight Schema. |
| 2026-03 | **Vital audit decisions.** Promote at cap (block), Shards move with, Miscellaneous (same peak), Bones (tap, 3 sections), Intent 1000 cap, Phase 1 (both logic, 1 layout), DB schema override. |
| 2026-03 | **Gemini multi-disciplinary.** 14a: Bones = high-level + admin, middle non-interactive. 14b–c: Promote to Marker, Demote = Phase 2. 14d: pebble_logic store only, UI Phase 2. 14e: Move to General = soft hide. Phase 1 checklist. |
| 2026-03 | **Phase 1 complete.** 5-step wizard, dynamic 1–10 markers, F5 terminology, Bones + Edit Peak (Intent + Logic). All smoke tests passing. |

---

**End of Master Ledger.**
