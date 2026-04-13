# Master Plan — Full Audit Report

**Date:** March 2026  
**Scope:** MASTER_PLAN.md + related specs, NAVIGATION_MAP, schema, ALIGNMENT

---

## 1. Build Outs — Status

**All Build Outs 1–10 are resolved.** No new Build Outs required for MVP.

**Resolved:** Step 2 (Appearance) — Migration `20250319000000_add_appearance_style.sql` adds `mountains.appearance_style`. Values: `dark_walnut`, `navy`, `slate`, `charcoal`, `burgundy`, `forest`. Default `slate`. Stored in DB for sync across devices.

---

## 2. Inconsistencies

| # | Location | Issue | Fix |
|---|----------|-------|-----|
| 1 | **NAVIGATION_MAP** §4 Management Menu | Shows Pack Satchel first; missing "New Journey" and "Seek Guidance". ALIGNMENT/MASTER_LEDGER require: **New Journey** (first), Seek Guidance, Pack Satchel, Archive Recovery, Settings. | Update NAVIGATION_MAP Management Menu layout. |
| 2 | **PHASE 1** line 57 | Says "Create `users` profile table" but schema uses `profiles`. | Change to "Create `profiles` table". |
| 3 | **PEAK_PLANTING_WIZARD_SPEC** (Peak Creation Wizard) §2 Logic & Flow Notes | Says Intent saved to "`mountain_logs` or a description field." MASTER_LEDGER and schema use `intent_statement` on `mountains`. | Change to "Save to `mountains.intent_statement`." |
| 4 | **PEAK_PLANTING_WIZARD_SPEC** §3 | Step 5 button: "Pack Journey". MASTER_PLAN F.0.5 and Part B 1.5 lock **"Pack this Journey"**. | Standardize to "Pack this Journey" in wizard spec. (Wizard = Peak Creation; spec filename unchanged.) |
| 5 | **Completed Build Out 4** | Inline says "Scans `daily_habits`" but schema uses `whetstone_completions`. | If you implement Edge Functions, use `whetstone_completions` + `whetstone_items`. (Minor—deferred.) |

---

## 3. Missing from Related Docs

These docs are referenced in the plan but not in the Related Docs list:

- [GRACE_DAY_STREAK_SPEC.md](GRACE_DAY_STREAK_SPEC.md)
- [SATCHEL_PACK_ANIMATION_SPEC.md](SATCHEL_PACK_ANIMATION_SPEC.md)
- [MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md](MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md)
- [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md)

---

## 4. Whetstone Overlay — Entry Point Clarity

**WHETSTONE_CHOICE_OVERLAY_SPEC:** "User is in Your Satchel view. They tap the Whetstone icon."

**NAVIGATION_MAP:** Satchel screen shows slots + Pack Satchel button. No Whetstone icon/tile is shown in the Satchel layout diagram.

**Recommendation:** Add a Whetstone tile or icon to the Satchel screen description in NAVIGATION_MAP (e.g. in header or as a secondary action) so the overlay trigger is explicit.

---

## 5. Map Refactor vs Current State

**PEAK_JOURNAL_SPEC** and **PHASE 10** require:
- Map = summary cards only (Peak Name, Identity Icon, Progress Bar)
- Full tree (boulders/pebbles/shards) removed from Map
- Tap card → push to Detail

**NAVIGATION_MAP** §6 still shows the Map with full tree (Boulder A, Pebble 1, Shards, etc.).

**Recommendation:** Update NAVIGATION_MAP Map section to show the new "summary card" design per PEAK_JOURNAL_SPEC, or add a note that the current diagram is pre-refactor.

---

## 6. Duplicate / Overlapping Tasks

Same work appears in multiple places (expected, but worth noting):

| Task | Appears In |
|------|------------|
| Satchel pack animation | Part G Polish, PHASE 12, SATCHEL_PACK_ANIMATION_SPEC |
| RLS verification | PHASE 11, Build Out 7, Part G High priority |
| MountainDetailScreen / Map → Detail | PHASE 4, PHASE 10, Build Out 10, PEAK_JOURNAL_SPEC |
| New Journey from Elias | Part B, Part F, ALIGNMENT, MASTER_LEDGER |

**No action needed** — these are cross-references. Completed Build Outs are the source of truth for specs.

---

## 7. Concerns

1. **Appearance schema** — Step 2 (Icon/Style Picker) has no DB column. Either add migration or document as Phase 2 / client-only.
2. **Management Menu order** — NAVIGATION_MAP is out of sync with locked decisions. Risk of implementing wrong order.
3. **Intent storage wording** — PEAK_PLANTING_WIZARD (Peak Creation flow) could mislead implementers to create `mountain_logs` instead of using `intent_statement`.

---

## 8. Recommendations

### High priority
1. **Fix NAVIGATION_MAP Management Menu** — New Journey (first), Seek Guidance, Pack Satchel, Archive Recovery, Settings.
2. **Fix PEAK_PLANTING_WIZARD_SPEC** (Peak Creation Wizard) — Intent → `mountains.intent_statement`; Step 5 button → "Pack this Journey".
3. **Fix PHASE 1** — "users" → "profiles".

### Medium priority
4. **Add missing Related Docs** — GRACE_DAY_STREAK_SPEC, SATCHEL_PACK_ANIMATION_SPEC, MASTER_LEDGER_ARCHITECTURE_OVERHAUL, GAPS_AND_ASSUMPTIONS.
5. ~~**Appearance/icon**~~ — **Done.** Migration `20250319000000_add_appearance_style.sql` added.
6. **NAVIGATION_MAP Satchel** — Add Whetstone icon/tile to Satchel screen so overlay trigger is clear.
7. **NAVIGATION_MAP Map** — Update to summary-card design or add "pre-refactor" note.

### Low priority
8. **Edge Functions** — When implementing, use `whetstone_completions` not `daily_habits`.

---

**End of Audit Report.**
