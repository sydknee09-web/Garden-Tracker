# Voyager Sanctuary — Audit Fix Implementation Plan

**Source:** [DEEP_AUDIT_DEBUG_REPORT.md](./DEEP_AUDIT_DEBUG_REPORT.md)  
**Created:** 2025-03-16  
**Architectural Decisions:** Locked (see [Architectural Decisions](#architectural-decisions) below)

---

## Overview

This plan prioritizes fixes from the Deep Audit Report into phases. Each task includes file(s), steps, and verification.

---

## Architectural Decisions

| Question | Decision | Reasoning |
|----------|----------|-----------|
| **Q1: Multi-filter Supabase Streams (C2)** | Implement C1 only; rely on RLS for `user_id` | Supabase Realtime streams struggle with complex multi-filters. RLS (`auth.uid() = user_id`) physically refuses to stream cross-user data. Client-side `user_id` filter is redundant and increases stream breakage risk. |
| **Q2: Fresh Slate vs. Preserved State (F1)** | Option A — Fresh Slate on Reopen | Voyager metaphor: a journey has a distinct beginning and end. Closing = "stepping away from the map." On return, Elias greets at the start. Keeps memory low; prevents "state ghosts." |
| **Q3: Rebuild Optimization (D7)** | Defer | Double rebuilds on a single screen are rarely noticeable on modern mobile hardware. Focus complexity budget on 5-Step Wizard logic. |

---

## Phase 1: Critical — Node Stream & Security

### Task 1.1 — Add `mountain_id` filter to node realtime stream (C1)

| Item | Detail |
|------|--------|
| **File** | `lib/data/repositories/node_repository.dart` |
| **Lines** | 28–38 |
| **Effort** | Small |

**Steps:**
1. Add `.eq('mountain_id', mountainId)` to the `.stream()` chain before `.order('path')`.
2. Keep client-side `is_archived` filter (stream may not support multiple filters reliably).
3. Run app and verify node list updates when creating/editing nodes on a mountain.
4. Confirm other mountains’ node lists are not affected.

**Code change:**
```dart
await for (final rows in SupabaseService.client
    .from(_table)
    .stream(primaryKey: ['id'])
    .eq('mountain_id', mountainId)  // ADD
    .order('path')) {
```

**Verification:** Create a pebble on Mountain A; confirm only Mountain A’s node list refreshes. Check Supabase docs if `.eq()` + `.order()` ordering causes issues.

---

### Task 1.2 — Add `user_id` filter to node stream (C2) — **SKIPPED**

| Item | Detail |
|------|--------|
| **File** | `lib/data/repositories/node_repository.dart` |
| **Depends on** | Task 1.1 |
| **Effort** | Small |

**Steps:**
1. Add `.eq('user_id', SupabaseService.userId)` to the stream chain.
2. If Supabase stream rejects multiple filters, document that RLS enforces `user_id` and skip this.
3. Test with a real Supabase project.

**Question:** Do you have a Supabase project where we can verify multi-filter stream behavior? If not, implement C1 only and document C2 as “RLS-enforced.”

---

## Phase 2: Friction — Loop Bug & UX

### Task 2.1 — Prevent climb flow provider disposal (F1 — Loop Bug)

| Item | Detail |
|------|--------|
| **Files** | `lib/features/scroll_map/climb_flow_overlay.dart`, `lib/features/scroll_map/scroll_map_screen.dart` |
| **Effort** | Medium |

**Option A — `ref.keepAlive()` (recommended)**  
1. In `ClimbFlowOverlay.initState`, call `ref.keepAlive(climbFlowProvider)`.
2. In `ClimbFlowOverlay.dispose`, call `ref.invalidate(climbFlowProvider)` so state resets on next open.
3. Ensures provider stays alive while overlay is open; fresh state when reopened.

**Option B — Non–auto-dispose provider**  
1. Change `climbFlowProvider` from `AutoDisposeNotifierProvider` to `NotifierProvider`.
2. Add explicit reset in `onClose` before popping the route.
3. Risk: state persists across sessions if overlay is never “closed” (e.g. app backgrounded).

**Steps (Option A):**
1. In `_ClimbFlowOverlayState.initState`, add:
   ```dart
   ref.keepAlive(climbFlowProvider);
   ```
2. In `dispose`, add:
   ```dart
   ref.invalidate(climbFlowProvider);
   ```
3. Test: open Climb flow → Step 5 → add pebble on landmark 2 → confirm index stays at 2.

**Question:** Do you want a “fresh slate” every time the overlay opens (current behavior), or should we preserve state if the user accidentally closes and reopens? Option A gives fresh slate on reopen.

---

### Task 2.2 — Fix Elias line cache staleness (F2)

| Item | Detail |
|------|--------|
| **File** | `lib/features/scroll_map/climb_flow_overlay.dart` |
| **Lines** | 189–260 |
| **Effort** | Small |

**Option A — Clear cache on step/index change**  
1. In `_buildStep`, before the switch, add:
   ```dart
   // Invalidate cache when step or lastEliasIndex changes
   if (_lastBuiltStep != state.step || _lastBuiltEliasIndex != state.lastEliasIndex) {
     _lastBuiltStep = state.step;
     _lastBuiltEliasIndex = state.lastEliasIndex;
     _cachedIntentLine = null;
     _cachedIdentityLine = null;
     _cachedLogicLine = null;
     _cachedLandmarksLine = null;
     _cachedPebblesLine = null;
   }
   ```
2. Add `int? _lastBuiltStep` and `int? _lastBuiltEliasIndex` to state.
3. **Elias-specific rail:** When the cache clears and a new line is computed, wrap the Elias text in a `FadeTransition`. Logic: If Elias's text "pops" instantly, it feels like a bug. If it fades, it feels like he is transitioning his thought.

**Option B — Remove cache**  
1. Remove `_cached*` fields.
2. Compute `EliasDialogue.*` on each build.
3. Simpler, but may add minor CPU cost.

**Recommendation:** Option A; cache is useful for step content that doesn’t change often.

---

## Phase 3: Debt — Performance & Cleanup

### Task 3.1 — Narrow `_saveTitle` invalidation (D3)

| Item | Detail |
|------|--------|
| **File** | `lib/features/scroll_map/scroll_map_screen.dart` |
| **Lines** | 601–608 |
| **Effort** | Medium (signature change) |

**Current:** `_saveTitle(nodeId, title)` invalidates all mountains’ node lists.

**Target:** Invalidate only the mountain that contains the edited node. By narrowing invalidation, a title change on one Peak does not cause a "flicker" on others when multiple Peaks are visible.

**Steps:**
1. Change callback from `Future<void> Function(String nodeId, String title)` to `Future<void> Function(String nodeId, String title, String mountainId)`.
2. Update `_saveTitle` to:
   ```dart
   Future<void> _saveTitle(String nodeId, String title, String mountainId) async {
     if (title.trim().isEmpty) return;
     await ref.read(nodeActionsProvider).updateTitle(id: nodeId, title: title.trim());
     ref.invalidate(nodeListProvider(mountainId));
   }
   ```
3. Update all call sites to pass `mountainId`:
   - `_TrailWaypoint`: `onSaveTitle(boulder.id, v)` → `onSaveTitle(boulder.id, v, mountain.id)` (boulder has no `mountainId`; use `mountain.id` from parent).
   - `_TrailPebbleRow`: `onSaveTitle(pebble.id, v, mountain.id)`.
   - `_TrailShardItem`: `onSaveTitle(shard.id, v, mountain.id)`.
4. Update `_commitTitle` to accept and pass `mountainId` (or derive it from the editing context).
5. Thread `mountainId` through `_MountainSection` → `_MountainTrailBody` → `_TrailWaypoint` / `_TrailPebbleRow` / `_TrailShardItem`.

**Question:** `_commitTitle` is called from `_InlineTextField`’s focus callback. The text field only has `nodeId` and `onSubmit`. We need `mountainId` at the call site. Options:
- **(a)** Extend `_InlineTextField` to accept `mountainId` and pass it to `onSubmit(nodeId, title, mountainId)`.
- **(b)** Store `editingNodeId` and look up `mountainId` from the current nodes when committing (adds a lookup).

**Note:** `onCommitTitle` is passed but never invoked. Update `_commitTitle` signature for consistency when adding a Save button later.

---

### Task 3.2 — Reduce `_Step5Pebbles` rebuilds (D7)

| Item | Detail |
|------|--------|
| **File** | `lib/features/scroll_map/climb_flow_overlay.dart` |
| **Lines** | 1349–1350 |
| **Effort** | Medium |
| **Priority** | Low |

**Current:** Watches `satchelProvider` and `activePebblesProvider`; both update on `movePebbleToReady`.

**Options:**
1. **Selective watch:** Use `ref.watch(satchelProvider.select((s) => s.slots.any((s) => s.readyToBurn)))` if only `readyToBurn` drives the “Ascension” button.
2. **Extract widget:** Move the overflow/ascension UI into a child that watches only `activePebblesProvider` and `satchelProvider`’s relevant slice.
3. **Defer:** Accept double rebuild; optimize only if profiling shows impact.

**Recommendation:** Defer unless you see performance issues. Document as future optimization.

---

## Phase 4: Optional Cleanup

### Task 4.1 — Merge `setState` in edit flow overlay (F4)

| Item | Detail |
|------|--------|
| **File** | `lib/features/scroll_map/edit_flow_overlay.dart` |
| **Lines** | 89–105 |
| **Effort** | Trivial |

**Steps:** Combine into a single `setState`:
```dart
setState(() {
  _addPebbleNamingActive = false;
  _addPebbleController.clear();
  _eliasLine = EliasDialogue.afterAddPebble();
});
```

---

### Task 4.2 — Add `.cursor/rules` entry for Loop Bug (Preservation of Intent)

| Item | Detail |
|------|--------|
| **File** | `.cursor/rules/master-ledger-overhaul.mdc` |
| **Effort** | Trivial |

**Content:** Rule: “When creating a pebble in Climb Flow Step 5, never call `setPebbleStepBoulderIndex(0)` or `setStep`. Preserve `pebbleStepBoulderIndex`.”

---

## Execution Order

| Phase | Task | Depends on |
|-------|------|------------|
| 1 | 1.1 Node stream `mountain_id` | — |
| 1 | 1.2 Node stream `user_id` (skipped) | 1.1 |
| 2 | 2.1 Loop Bug fix | — |
| 2 | 2.2 Elias cache fix | — |
| 3 | 3.1 `_saveTitle` invalidation | — |
| 3 | 3.2 `_Step5Pebbles` rebuilds | — (defer) |
| 4 | 4.1 Edit flow `setState` | — |
| 4 | 4.2 Cursor rule | — |

**Suggested order:** 1.1 → 2.1 → 2.2 → 3.1 → 4.1 → 4.2. (Task 1.2 skipped per Q1.)

---

## Questions Summary — Resolved

All architectural questions have been decided (see [Architectural Decisions](#architectural-decisions) above).

---

## Verification Checklist

After implementation:

- [ ] Node list updates correctly when creating/editing nodes (C1).
- [ ] Adding a pebble in Step 5 does not reset landmark index (F1).
- [ ] Elias dialogue updates when stepping back and forth (F2).
- [ ] Saving a node title invalidates only that mountain’s node list (D3).
- [ ] Climb flow opens with fresh state after closing (F1 Option A).
- [ ] All existing tests pass.
- [ ] Manual smoke test: full Climb flow (steps 1–5) with multiple pebbles.
