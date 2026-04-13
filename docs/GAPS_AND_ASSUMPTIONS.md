# Voyager Sanctuary — Gaps, Assumptions & Oversights

**Purpose:** Catch anything that could cause issues before or during implementation.  
**Status:** Vital audit complete. Official decisions locked in Master Ledger (March 2026).  
**Related:** [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md), [ALIGNMENT_OUTCOME_SPEC.md](ALIGNMENT_OUTCOME_SPEC.md), [FEATURES_EXPANSION_DOC.md](FEATURES_EXPANSION_DOC.md) — Deferred features and why.

---

## 0. Scenario Coverage — "Have We Covered All These?"

| Scenario | Covered? | How | Status |
|:---------|:---------|:----|:-------|
| **What will the edit be like?** | Yes | **Peak:** Bones view (Intent, Name, Logic, non-interactive hierarchy, admin actions). **Markers/Pebbles/Shards:** Map + Edit overlay + inline tap-to-edit. Bones = high-level + admin only. | **Locked** |
| **Abandon path (archive)?** | Yes (peak) / Soft (marker) | **Peak:** Abandon Peak → archives whole peak. **Marker:** "Move to General" = soft hide; "Scatter" = hard delete. No separate archive. | **Locked** |
| **Delete one pebble vs one landmark?** | Yes | **Pebble:** Swipe-left = Clear the Path. **Landmark:** Long-press = Branch Removal. | **Locked** |
| **Change pebble → landmark?** | Partial (Phase 1) | **Promote to Peak** only in Phase 1. **Promote to Marker** (same peak) = Phase 2. | **Deferred** |
| **Change landmark → pebble?** | No (Phase 1) | Demote/Merge = Phase 2. Complex UI; not required for MVP. | **Deferred** |
| **Goal landmarks sequential vs any order?** | Yes | `layout_type`: **Climb** = sequential. **Survey** = any order. | ✓ |
| **Pebbles in a landmark sequential (but goal is not)?** | Schema only (Phase 1) | `pebble_logic` in DB (default `freeform`). Toggle UI in Phase 2. **Logic & Leaf:** Logic on pebbles for shards; sub-boulders for mixed logic; Validity Filter in pack. **Rune:** Packable = rune stones; distinct rune visual. | **Store only** |
| **Climb + sub-boulders** | Known limitation | Climb gates on *first incomplete top-level boulder* only. If Office (depth 2) is complete, Kitchen's sub-boulders (Organize Pantry, etc.) never unlock. **Planned fix:** "First Blockage" rule—Highest Incomplete Ancestor as gatekeeper. See [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md) § First Blockage, [MASTER_PLAN.md](MASTER_PLAN.md) § Planned Refactor. **User instruction:** *"Keep your main projects in the top-level Boulders to see them on the map."* | **Documented** |

---

## 1. Schema Naming — **RESOLVED (Ledger Override)**

**Decision:** Cursor must use **existing DB names** to avoid migration hell:

| Use | DB Column | Type |
|:----|:----------|:-----|
| The Why | `intent_statement` | TEXT, nullable, max 1000 |
| The Identity | `name` | TEXT, not null |
| Logic | `layout_type` | Enum: climb, survey. Default: climb. |
| Status | `is_archived` | BOOLEAN, default false |

---

## 2. Promote + 3-Peak Cap — **RESOLVED**

**Decision:** **Option A — Block with Elias.** Keeps the 3-Peak limit sacred. Encourages "finish and archive" before starting new Mains.

---

## 3. Promote + Pebbles with Shards — **RESOLVED**

**Decision:** **Option A — Shards move with.** If "Buy Roses" has shards like "Check nursery" and "Price earth," they become pebbles in the new Peak's first Milestone. They don't vanish.

---

## 4. "Miscellaneous" Region — **RESOLVED**

**Decision:** **Same Peak, Bottom of List.** Keeps cleanup localized. If you clear a branch in "Hillside" peak, extras stay in "Hillside: Miscellaneous."

---

## 5. Bones View — **RESOLVED**

**Decision:** **Tap title.** Long-press feels like "deleting/moving files." Tapping the title feels like "inspecting the architecture."

---

## 6. Step 4 Labels — **RESOLVED**

**Decision:** Wizard adapts based on Step 3: **Milestone 1, 2, 3…** (Climb) or **Region 1, 2, 3…** (Survey). Code: always `Marker`/`boulder`.

---

## 7. Intent Statement Length — **RESOLVED**

**Decision:** **Cap at 1,000 characters.** A "Why" shouldn't be an essay; it should be a North Star. Elias: *"Keep it focused. The peak is won with clarity, not volume."*

---

## 8. Elias Tap: Dialogue + Sheet

**Issue:** When the user taps Elias, the code does two things:
1. Sets `eliasMessageProvider` to a random onTap line (e.g. "The fire holds as long as you tend it")
2. Shows the Management sheet

So the user may see a **dialogue bubble** and the **sheet** at the same time. Is that intentional or redundant?

**Options:**
- A) Keep both — Elias speaks while the menu appears (cohesive).
- B) Don't set the message when opening the sheet — sheet is enough.
- C) Set the message only when the sheet *closes* — Elias responds to their choice.

**Recommendation:** **A** is fine if the bubble doesn't block the sheet. If it feels cluttered, try **B**.

**Resolution:** Low priority. Test and adjust.

---

## 9. Survey Map Layout — **RESOLVED**

**Decision:** **Phase 1: Both logic, 1 layout.** Ship `layout_type` DB logic and Step 3 UI now. Use Climb (tree) visual for **both** Climb and Survey. **Phase 2:** Ship Island/Constellation layout for Survey.

---

## 10. Demo Mode + New Schema

**Issue:** The app has demo mode (in-memory storage when offline). Do the new fields (`intent_statement`, `layout_type`) work in demo mode?

**Action:** Ensure `DemoStorage` / `DemoMountainRepository` / `DemoNodeRepository` support the new columns. When creating a peak in demo mode, include `intentStatement`, `layoutType`.

**Resolution:** Implementation task. Add to checklist.

**Feasibility refinement:** Use Repository pattern. UI talks to `DataRepository` only. `SupabaseRepository` vs `MockLocalRepository` = simple toggle. Demo mode is a swap, not a rewrite. See MASTER_PLAN § Feasibility Refinements.

---

## 11. Existing Data Migration

**Issue:** Users who already have peaks with 4 markers. After we ship dynamic 1–10:
- Their data stays as-is (4 markers).
- No migration needed for existing rows.
- New columns (`intent_statement`, `layout_type`) will be NULL for existing peaks.

**Question:** For existing peaks with NULL `intent_statement`, does the Bones view show "(Not set)" or hide the field? For NULL `layout_type`, default to `climb`.

**Recommendation:** Default `layout_type` to `climb` in DB and in reads. Show Intent in Bones as "(Not set)" or empty, with option to add.

**Resolution:** Add to spec: *"Existing peaks: layout_type defaults to climb; intent_statement nullable, editable in Bones."*

---

## 12. Integration Tests

**Issue:** The synthetic user tests (e.g. `add_task_journey`, `complete_task_journey`) use specific flows. Adding "New Journey" from Elias and changing the creation wizard will affect these.

**Action:** Update integration tests to:
- Use "New Journey" from Elias (or Map FAB) for add-task flow.
- Handle 6-step wizard (Intent, Identity, Appearance, Logic, Markers, Placing stones).
- Handle dynamic markers (1–10) instead of fixed 4.

**Resolution:** Implementation task. Add to post-F1–F5 checklist.

---

## 13. "Place" — Accessibility / Clarity

**Issue:** "Place Pebble" uses the Sanctuary metaphor. For screen readers or users who don't infer the metaphor, "Place" might need clarification.

**Recommendation:** Add a semantic label for accessibility: e.g. `Semantics(label: 'Add pebble to [marker name]')` so screen readers get the action, while the visible button still says "Place Pebble".

**Resolution:** Implementation task. Low priority but good practice.

---

## 14. New Gaps From Scenario Audit

### 14a. Edit Experience — **RESOLVED (Gemini)**

**Decision:** **Bones = High-level + Admin.** Bones is for Intent, Name, Logic, and Peak-level actions (Rename, Archive, Delete). Individual nodes stay on the Map for editing (Edit overlay, inline tap-to-edit).

**Bones middle section:** **Non-interactive tree structure** — visual hierarchy overview only. No editing of markers/pebbles within Bones.

---

### 14b. Pebble → Landmark (Within Same Peak) — **RESOLVED (Gemini)**

**Decision:** **Phase 2: Deferred.** Keep Phase 1 lean. Use "Promote to Peak" as the only promotion path for now.

---

### 14c. Landmark → Pebble (Demote) — **RESOLVED (Gemini)**

**Decision:** **Phase 2: Deferred.** "Demote" is a complex UI pattern. Not required for MVP.

---

### 14d. Pebble Logic — **RESOLVED (Gemini)**

**Decision:** **Option C: Store Only.** Store `pebble_logic` in DB (default `freeform`). Add the toggle UI in Phase 2.

---

### 14e. Archive vs Delete at Marker Level — **RESOLVED (Gemini)**

**Decision:** **Option C: Move to General.** "Move to General" serves as the soft hide. "Scatter" is the hard delete. No separate archive at marker level.

---

## 14f. Appearance (Step 2) — Icon/Style Picker

**Issue:** Wizard Step 2 (Appearance) has Icon/Style Picker (Dark Walnut, Navy, etc.). PEAK_JOURNAL_SPEC expects "Identity Icon" on Map cards.

**Decision:** **Add migration.** Storing in DB ensures sync across devices (remote desk, mobile). Client-only would break immersion when switching environments. Architectural integrity: the "Bones" of the digital sanctuary stay consistent.

**Resolution:** Migration `20250319000000_add_appearance_style.sql`. Column: `mountains.appearance_style TEXT DEFAULT 'slate'` CHECK (appearance_style IN ('dark_walnut', 'navy', 'slate', 'charcoal', 'burgundy', 'forest')).

---

## 15. Summary: Decisions Locked (Vital Audit + Gemini — March 2026)

| # | Gap | Decision |
|:--|:----|:---------|
| 1 | Schema naming | Use `intent_statement`, `name`, `layout_type`, `is_archived`. |
| 2 | Promote at 3-peak cap | Block with Elias. |
| 3 | Promote + shards | Shards move with → pebbles in new Peak's first Milestone. |
| 4 | Miscellaneous | Same peak, bottom of list. |
| 5 | Bones trigger | Tap title. |
| 6 | Step 4 labels | Milestone (Climb) or Region (Survey). |
| 7 | Intent length | Cap 1,000 chars. Elias: "Keep it focused. The peak is won with clarity, not volume." |
| 9 | Survey layout | Phase 1: both logic, 1 layout (tree). Phase 2: Island/Constellation. |
| **14a** | **Edit experience** | Bones = high-level + admin. Middle = **non-interactive** tree. Individual nodes on Map. |
| **14b** | **Pebble → Marker (same peak)** | Phase 2. Promote to Peak only in Phase 1. |
| **14c** | **Landmark → Pebble (demote)** | Phase 2. Not required for MVP. |
| **14d** | **Pebble logic** | Store in DB (default `freeform`). UI in Phase 2. |
| **14e** | **Archive at marker** | Move to General = soft hide. Scatter = hard delete. No separate archive. |
| **14f** | **Appearance (Step 2)** | Add `mountains.appearance_style`. Migration 20250319000000. Sync across devices. |

---

## 16. Phase 1 Technical Checklist (Gemini)

- [ ] **DB Migration:** Add `intent_statement`, `layout_type`, and `pebble_logic` columns.
- [ ] **Elias Management:** Add "New Journey" as the first list item.
- [ ] **Wizard Implementation:** Build the 5-step overlay with dynamic 1–10 Marker list.
- [ ] **Loop Bug Fix:** Ensure Step 5 (Placing stones) maintains state on the current Marker.
- [ ] **Demo Mode:** Update DemoStorage to support new fields.

---

## 17. Assumptions (Locked)

- **Miscellaneous** = new marker, same peak, bottom of list.
- **Promote at cap** = block with Elias.
- **Promote + shards** = shards move with.
- **Bones view** = tap title. Top: Intent. Middle: **Non-interactive** hierarchy. Bottom: Rename, Archive, Delete.
- **Step 4 labels** = Milestone (Climb) or Region (Survey).
- **Intent length** = 1,000 char cap.
- **Survey layout** = Phase 1: tree for both. Phase 2: Island.
- **DB columns** = intent_statement, name, layout_type, is_archived. **pebble_logic** on nodes (store only, UI Phase 2).
- **Create wizard** = 6 steps in Phase 1. Step 3 = Logic (terminology). Same tree for both.
- **Promote to Marker** (same peak) = Phase 2. **Demote** = Phase 2.

---

## 18. Housekeeping (Architecture Lock — March 2026)

| Item | Decision | Rationale |
|------|----------|-----------|
| **order_index on create** | Stay with `0` + `created_at`. | Chronological is intuitive for MVP. Implement `max(siblings) + 1` only when "Drag to Reorder" ships. |
| **RPC fallback logging** | `debugPrint` in catch blocks. | Distinguishes migration-not-applied from network timeout when progress bar stays at 0%. |
| **Hammer modal** | Buttons: "Add" / "Refine". Header: "Strike the Stone". | Buttons are functionally clear; header provides Sanctuary flavor. |
| **Climb user instruction** | *"Keep your main projects in the top-level Boulders to see them on the map."* | Reflects current reality until First Blockage refactor. |

---

**End of Gaps & Assumptions.**
