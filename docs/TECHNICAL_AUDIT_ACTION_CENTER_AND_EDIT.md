# Technical Integrity Audit — Action Center & Universal Edit

**Scope:** Recent "Action Center" and "Universal Edit" changes (Vendor/Nursery, Plant Again, Quick Actions grid, Edit modals, QuickAddSeed locked-in flow).  
**Format:** Critical Errors → Inconsistencies → Optimization Recommendations.

---

## Critical Errors (must fix)

### 1. ~~Edit Plant Profile: save failure not shown inside modal~~ ✅ Fixed (Estate Audit Wave 1)

**Location:** [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx) — Edit Plant Profile modal (`showEditModal`).

**Issue:** `handleSaveEdit` calls `setError(error.message)` on Supabase failure, but the Edit Plant Profile modal content does **not** render `error` anywhere. The page-level `if (error || !profile) return <div>…role="alert"` only runs when the main content is shown; while the modal is open, a failed save sets state but the user sees no message.

**Fix:** Inside the Edit Plant Profile modal (e.g. above the Save button or at the top of the scrollable area), add: `{error && <p className="text-sm text-red-600" role="alert">{error}</p>}`. Optionally clear `error` when opening the modal (`openEditModal`) so previous errors don’t linger.

---

## Inconsistencies (should fix)

### 2. AddPlantModal still writes both `purchase_vendor` and `purchase_nursery`

**Location:** [src/components/AddPlantModal.tsx](src/components/AddPlantModal.tsx) — new profile insert (e.g. around lines 232–234).

**Issue:** UX Audit specified a single "Vendor / Nursery" field mapped **only** to `purchase_vendor`. AddPlantModal still sets both `purchase_vendor` and `purchase_nursery` from the same `vendorNursery` input when inserting a new plant profile.

**Fix:** For `plant_profiles` inserts, set only `purchase_vendor: vendorNursery.trim() || null`. Remove or stop setting `purchase_nursery` in that path so the UI matches the “one column” rule.

---

### 3. Stroke weight inconsistency outside styleDictionary

**Location:** [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx) uses `iconProps()` with `strokeWidth: 1.5`; all ICON_MAP icons inherit it.

**Issue:** Many inline SVGs elsewhere still use `strokeWidth="2"` or `strokeWidth="2.5"` (e.g. vault [id] close buttons, VaultPageContent chevrons/icons, EditJournalModal, BatchAddSeed, calendar, garden page). Action Center and Edit flows use ICON_MAP (1.5), but the rest of the app is mixed.

**Fix:** Where those inline icons represent the same actions as ICON_MAP (e.g. close, edit, trash), replace with `<ICON_MAP.Edit />` / `<ICON_MAP.Trash />` etc. so the 1.5 stroke is consistent. Low priority for decorative or one-off icons.

---

### 4. QuickAddSeed locked-in chip can briefly be empty

**Location:** [src/components/QuickAddSeed.tsx](src/components/QuickAddSeed.tsx) — `lockedInVarietyLabel` from `preSelectedProfile` in `seedProfiles`.

**Issue:** When opening with `preSelectedProfileId`, `manualMode` and `selectedProfileIdForLink` are set synchronously, but `profiles` (and thus `seedProfiles`) load asynchronously. Until they load, `preSelectedProfile` is undefined and `lockedInVarietyLabel` is null, so the “Variety” chip doesn’t render until the fetch completes.

**Fix:** Either: (a) pass `profileDisplayName` (or `name` + `variety`) from the parent when opening with `preSelectedProfileId` and use that for the chip until `preSelectedProfile` is available, or (b) show a short loading state in the chip area (“Variety: …”) when `preSelectedProfileId` is set but `lockedInVarietyLabel` is null.

---

## Optimization Recommendations (could fix)

### 5. Shared Quick Actions grid constant

**Location:** [src/app/journal/new/page.tsx](src/app/journal/new/page.tsx) (Quick Actions) and [src/components/BatchLogSheet.tsx](src/components/BatchLogSheet.tsx) (Quick Actions).

**Current:** Both use the same layout: `grid grid-cols-4 gap-2`. No horizontal scroll; layout is identical.

**Recommendation:** If you add a third Action Center surface later, consider a small shared constant or a single “QuickActionsGrid” wrapper (e.g. `className={QUICK_ACTIONS_GRID_CLASS}`) so column count and gap stay in one place. Optional; current duplication is minimal.

---

### 6. Full-screen drawer and mobile keyboard

**Location:** Edit Grow Instance modal and EditPacketModal — `min-h-[100dvh]`, `items-end md:items-center`.

**Current:** Modals expand to full viewport height on mobile. There is no explicit handling for the virtual keyboard (e.g. no `visualViewport` resize or bottom padding when the keyboard opens).

**Recommendation:** If users report the keyboard covering inputs, add a resize observer on `window.visualViewport` and adjust padding-bottom or max-height of the scroll container when the keyboard is open. Not required unless you see issues on devices.

---

### 7. Error handling consistency across Edit flows

**Current:** Edit Grow and Edit Packet show inline error state and use `hapticSuccess()` on save. Edit Plant Profile now uses `hapticSuccess()` on success but does not show save failure inside the modal (see Critical #1).

**Recommendation:** After fixing Critical #1, consider: (a) calling `hapticError()` on save failure in all three Edit flows, and (b) ensuring each modal has a single, visible error region (e.g. above primary button) so behavior is consistent.

---

### 8. overflow-x-auto outside Action Center

**Current:** Quick Actions in journal/new and BatchLogSheet no longer use horizontal scroll; they use a 2-row grid. Other `overflow-x-auto` usages are in different contexts (tabs, image galleries, tables) and are not part of the Action Center changes.

**Recommendation:** No change needed for Action Center. If you observe “side-wobble” on mobile elsewhere, audit those containers (e.g. `scrollbar-width: thin`, or replace with a non-scrolling layout where appropriate).

---

## Summary

| Severity   | Count | Items |
|-----------|-------|--------|
| Critical  | 1     | Edit Plant Profile save error not shown in modal |
| Inconsistencies | 3 | AddPlantModal dual purchase_vendor/purchase_nursery; stroke weight outside styleDictionary; QuickAddSeed chip empty until profiles load |
| Optimizations | 4 | Shared grid constant; keyboard handling in drawers; error/haptic consistency; overflow audit elsewhere |

**Data integrity:** Vendor / Nursery and Price are correctly mapped: plant_profiles → `purchase_vendor` (Edit Profile); grow_instances → `vendor` and `purchase_price` (AddPlantModal and Edit Grow); seed_packets → `vendor_name` (EditPacketModal). No UI-only fields were found that are omitted from Supabase update/insert calls.

**preSelectedProfileId:** State is set once on open; no unnecessary re-renders from the hidden search bar. The only nuance is the async load of `profiles` causing a brief missing chip (Inconsistency #4).

---

## Estate Audit Wave 1 — journal_entries entry_type audit (2025-03-10)

**Requirement:** All `journal_entries` inserts must set `entry_type` explicitly (Law 9). No reliance on DB default or text-matching `note`.

**Result:** ✅ All inserts set `entry_type`.

| Location | entry_type(s) used |
|----------|--------------------|
| `src/lib/completeSowTask.ts` | `planting` |
| `src/components/AddPlantModal.tsx` | `planting`, `growth` |
| `src/app/vault/[id]/page.tsx` | `quick`, `death` / `note` |
| `src/app/vault/plant/page.tsx` | `planting`, `care` |
| `src/app/vault/VaultPageContent.tsx` | `planting`, `care` |
| `src/app/vault/review-import/page.tsx` | `planting` |
| `src/components/BatchLogSheet.tsx` | `quick`, `growth` |
| `src/components/ActiveGardenView.tsx` | `quick`, `note` |
| `src/components/MyPlantsView.tsx` | `quick`, `death` / `note` |
| `src/app/garden/page.tsx` | `growth`, `note` |
| `src/components/HarvestModal.tsx` | `harvest` |

No missing or defaulted `entry_type` found.
