# Voyager Sanctuary — Technical Audit Report

**Plan:** `voyager_sanctuary_audit_fixes_2497143f.plan.md`  
**Date:** March 15, 2025  
**Scope:** Exhaustive comparison of plan specifications vs. current codebase.

---

## Executive Summary

The plan defines a phased remediation covering overflow fixes, ritual logic (pebble lifecycle, three-stage Pack, burn/archive, activePebbles), mobile contrast/SafeArea, and Cursor rules. The codebase has **partial alignment** with the plan: migration, Node model, and SupabaseSatchelRepository structure are in place, but **critical gaps** remain in repository wiring, ritual logic, and UI features.

**Critical:** `repository_providers.dart` returns `SatchelRepository()` when not in demo mode. `SatchelRepository` is abstract and cannot be instantiated — this will cause a **compile error** in production builds.

---

## 1. Plan vs. Code — Critical Gaps

### 1.1 Repository Providers (BLOCKING)

| Plan | Code | Status |
|------|------|--------|
| Return `SupabaseSatchelRepository()` when not demo | `repository_providers.dart:30` returns `SatchelRepository()` | **FAIL** — Abstract class cannot be instantiated |

**Location:** `lib/providers/repository_providers.dart` line 30

```dart
// Current (broken):
return isDemoMode ? DemoSatchelRepository() : SatchelRepository();

// Required:
return isDemoMode ? DemoSatchelRepository() : SupabaseSatchelRepository();
```

---

### 1.2 SatchelRepository — PostgREST UUID Filter

| Plan | Code | Status |
|------|------|--------|
| UUID-safe format: `'(${excludeIds!.map((s) => '"$s"').join(',')})'` | `satchel_repository.dart:117` uses `excludeIds.toList()` | **FAIL** |

**Location:** `lib/data/repositories/satchel_repository.dart` line 117

```dart
// Current:
if (excludeIds != null && excludeIds.isNotEmpty) {
  query = query.not('id', 'in', excludeIds.toList());
}

// Required (per plan):
if (excludeIds != null && excludeIds.isNotEmpty) {
  query = query.not('id', 'in', '(${excludeIds!.map((s) => '"$s"').join(',')})');
}
```

---

### 1.3 DemoSatchelRepository

| Plan | Code | Status |
|------|------|--------|
| `extends` SatchelRepository | `implements` SatchelRepository | **FAIL** |
| `fetchActivePebbles()` | Not implemented | **MISSING** |
| `assignPebbleToSlot(nodeId, slotId)` | Not implemented | **MISSING** |
| `fetchPackCandidates(limit, excludeIds)` | `fetchPackCandidates(limit)` only; no excludeIds | **FAIL** |

**Location:** `lib/data/demo/demo_satchel_repository.dart`

---

### 1.4 NodeRepository — Ritual Logic

| Plan | Code | Status |
|------|------|--------|
| `createPebble(..., isPendingRitual: false)` | No `isPendingRitual` parameter | **FAIL** |
| `setIsPendingRitual(nodeId, value)` | Method does not exist | **MISSING** |
| `burnPebble` sets `is_archived: true`, `is_pending_ritual: false` | Sets only `is_complete: true`; no archive flags | **FAIL** |
| `watchByMountain` filters `.eq('is_archived', false)` | No archived filter | **FAIL** |
| Cache key `'nodes_${mountainId}_active'` | Uses `'nodes_$mountainId'` | **FAIL** |

**Location:** `lib/data/repositories/node_repository.dart`

---

### 1.5 DemoNodeRepository

| Plan | Code | Status |
|------|------|--------|
| `createPebble(..., isPendingRitual)` | No `isPendingRitual` parameter | **FAIL** |
| `setIsPendingRitual(nodeId, value)` | Method does not exist | **MISSING** |
| `burnPebble` sets `isArchived`, `isPendingRitual` | Sets only `isComplete`; no archive flags | **FAIL** |
| `watchByMountain` filters archived nodes | Yields all nodes; no `.where((n) => !n.isArchived)` | **FAIL** |

**Location:** `lib/data/demo/demo_node_repository.dart`

---

### 1.6 DemoStorage

| Plan | Code | Status |
|------|------|--------|
| `updateNode(id, ..., isPendingRitual?, isArchived?)` | `updateNode` has no `isPendingRitual` or `isArchived` | **FAIL** |

**Location:** `lib/data/demo/demo_storage.dart` line 166

---

### 1.7 SatchelProvider / SatchelState

| Plan | Code | Status |
|------|------|--------|
| `SatchelState.isBurnInProgress` | Not present | **MISSING** |
| Three-stage `packSatchel` (drain overflow → assign → mountain fill) | Single-stage pack; no overflow drain | **FAIL** |
| `movePebbleToReady(nodeId)` | Not implemented | **MISSING** |
| `onBurnComplete` callback / auto-drain next pebble | Not implemented | **MISSING** |
| `removeFromSatchel`: capture nodeId → clearSlot → setIsPendingRitual | Takes slotId only; clears slot; no setIsPendingRitual | **FAIL** |
| `SatchelNotifier(..., Ref ref)` for invalidation | No Ref parameter | **FAIL** |

**Location:** `lib/providers/satchel_provider.dart`

---

### 1.8 activePebblesProvider

| Plan | Code | Status |
|------|------|--------|
| Standalone `FutureProvider`; invalidated after pack/burn/remove | Provider does not exist | **MISSING** |

**Location:** Plan specifies `active_pebbles_provider.dart` or add to existing provider file.

---

### 1.9 createPebble Call Sites (Climb / Edit)

| Plan | Code | Status |
|------|------|--------|
| Climb: `createPebble(..., isPendingRitual: true)` | `climb_flow_overlay.dart:245` — no `isPendingRitual` | **FAIL** |
| Edit "Add Pebble": `createPebble(..., isPendingRitual: true)` | `edit_flow_overlay.dart:387` — no `isPendingRitual` | **FAIL** |

---

### 1.10 Routes — focusOnHearth

| Plan | Code | Status |
|------|------|--------|
| `/sanctuary` accepts `queryParameters['focusOnHearth']` | `app.dart:120-121` — builder ignores `state.uri.queryParameters` | **FAIL** |

**Location:** `lib/app.dart` — Sanctuary GoRoute builder does not pass or read query params.

---

### 1.11 Cursor Rules

| Plan | Code | Status |
|------|------|--------|
| `voyager_sanctuary/.cursor/rules/voyager-sanctuary-ui.mdc` | File does not exist | **MISSING** |

**Existing rules:** `audio.mdc`, `architecture-and-data.mdc`, `bugs-and-future-phases.mdc`

---

### 1.12 app_colors — darkWalnut

| Plan | Code | Status |
|------|------|--------|
| `static const Color darkWalnut = sanctuaryIcon;` | Not present | **MISSING** |

**Note:** `sanctuaryIcon` exists at `0xFF2E2419`; plan specifies alias for interactive text.

---

### 1.13 Zoom Termination (onDragEnd / onDragCompleted)

| Plan | Code | Status |
|------|------|--------|
| Zoom resets on `onDragEnd` or `onDragCompleted` (not drag start) | No `LongPressDraggable`, `onDragEnd`, or `onDragCompleted` in codebase | **NOT IMPLEMENTED** |

**Note:** Sanctuary uses `Draggable<String>` and `DragTarget<String>` for burn flow. Zoom-and-focus feature is not yet implemented; plan specifies where to wire termination.

---

## 2. Plan vs. Code — Line Number / Structure Discrepancies

| Plan Reference | Actual Location | Notes |
|----------------|-----------------|------|
| `_Step3Pebbles` Row at 748–889 | `_Step3Pebbles` class ~764–895; Row at 847–888 | Plan line numbers slightly off; structure is Column → Container → Column → Row |
| `edit_flow_overlay` "action bar Rows" | Uses Column with buttons; no explicit "action bar Rows" | Layout differs; overflow fix pattern still applies to any Row children |

---

## 3. Plan vs. Code — Already Correct

| Item | Location | Status |
|------|----------|--------|
| Node model: `isPendingRitual`, `isArchived`, `fromJson`/`toJson`/`copyWith` | `lib/data/models/node.dart` | **OK** |
| Migration: `20250315000000_add_ritual_and_archive_fields.sql` | `supabase/migrations/` | **OK** |
| Abstract `SatchelRepository` with 10 methods | `satchel_repository.dart` | **OK** |
| `SupabaseSatchelRepository` with `fetchActivePebbles`, `assignPebbleToSlot`, `fetchPackCandidates(excludeIds)` | `satchel_repository.dart` | **OK** (except UUID filter) |
| `_CompactSatchelTray`, `_StoneFeedback`, `_CompactSlot` in sanctuary | `sanctuary_screen.dart` | **OK** |
| `_ToolsSection`, `_SatchelSlotRow` padding 14 | `satchel_screen.dart` | **OK** |
| Elias ColorFilter at 50–56 | `elias_silhouette.dart` | **OK** (plan says remove by default; code has it) |
| `_SpeechBubble` maxWidth 190 | `sanctuary_screen.dart:1036` | **OK** (plan says replace with `math.min(MediaQuery.size.width * 0.6, 280)`) |
| `nodeActionsProvider` exists; Climb/Edit call `createPebble` via it | `node_provider.dart`, overlays | **OK** |

---

## 4. Assets

| Item | Status |
|------|--------|
| PNG inventory | **24 PNGs exist** in satchel, stones, images, elias, hearth, mallet. |
| Action | Wire `assets/stones/stone_medium.png` (and stone_small, stone_large) in _StoneFeedback, _CompactSlot, _SatchelSlotRow. Code still uses Icon fallbacks. |

---

## 5. Diamond Path Implementation Order

Per plan, the dependency-aware sequence is:

| Step | Goal | Current State |
|------|------|---------------|
| 1 | Repository Contract | Abstract exists; **repository_providers returns wrong type** |
| 2 | Implementation | SupabaseSatchelRepository exists; **UUID filter wrong** |
| 3 | Node Logic | **createPebble, setIsPendingRitual, burnPebble, watchByMountain all need updates** |
| 4 | Provider | **SatchelNotifier needs Ref, 3-stage pack, movePebbleToReady, onBurnComplete, removeFromSatchel fix, isBurnInProgress** |
| 5 | Demo | **DemoSatchelRepository, DemoNodeRepository, DemoStorage need updates; placement guard** |
| 6 | UI/UX | Tray to Layer 3; Zoom/Focus not implemented |

---

## 6. File Change Summary (Implementation Checklist)

| File | Required Changes |
|------|------------------|
| `repository_providers.dart` | Return `SupabaseSatchelRepository()` instead of `SatchelRepository()` |
| `satchel_repository.dart` | UUID-safe PostgREST filter for `excludeIds` |
| `demo_satchel_repository.dart` | Change to `extends`; add `fetchActivePebbles`, `assignPebbleToSlot`; add `excludeIds` to `fetchPackCandidates` |
| `node_repository.dart` | `createPebble(isPendingRitual)`; `setIsPendingRitual`; `burnPebble` + archive; `watchByMountain` filter + cache key |
| `demo_node_repository.dart` | Same ritual logic; `watchByMountain` filter archived |
| `demo_storage.dart` | `updateNode` + `isPendingRitual`, `isArchived` |
| `satchel_provider.dart` | `SatchelState.isBurnInProgress`; `SatchelNotifier(Ref)`; 3-stage pack; `movePebbleToReady`; `onBurnComplete`; `removeFromSatchel` atomic; wire `burnStone` to `isBurnInProgress` |
| `active_pebbles_provider.dart` (new) | Create `activePebblesProvider` |
| `climb_flow_overlay.dart` | `createPebble(isPendingRitual: true)`; overflow fix (Flexible/Expanded) |
| `edit_flow_overlay.dart` | `createPebble(isPendingRitual: true)`; overflow fix |
| `app.dart` | Sanctuary route: read `focusOnHearth` from `state.uri.queryParameters` |
| `app_colors.dart` | Add `darkWalnut = sanctuaryIcon` |
| `.cursor/rules/voyager-sanctuary-ui.mdc` | Create per plan content |

---

## 7. Recommendations

1. **Immediate:** Fix `repository_providers.dart` to return `SupabaseSatchelRepository()` — unblocks production builds.
2. **Diamond Path 1–3:** Apply repository and node logic changes before provider/UI work.
3. **Demo parity:** Update DemoStorage, DemoSatchelRepository, DemoNodeRepository so demo mode exercises the full ritual flow.
4. **Phase 4:** Add `voyager-sanctuary-ui.mdc` early so new code follows plan rules.

---

*End of Technical Audit Report*
