# Voyager Sanctuary — Deep Audit & Debug Report

**Date:** 2025-03-16  
**Scope:** Flutter 3.x, Riverpod, Supabase, GoRouter — Climb Flow, Node/Mountain providers, Sanctuary/Map UI  
**Auditor:** Senior Flutter Architect & Database Specialist

---

## Executive Summary

This audit examined logical integrity, state sync, the "Loop Bug," performance, and security. Findings are categorized as **[CRITICAL]**, **[FRICTION]**, and **[DEBT]** with reasoning.

---

## [CRITICAL] Findings

### C1. Node Realtime Stream — No `mountain_id` Filter (Security/Performance)

**Location:** `lib/data/repositories/node_repository.dart` L28–38

```dart
await for (final rows in SupabaseService.client
    .from(_table)
    .stream(primaryKey: ['id'])
    .order('path')) {
  final filtered = (rows as List)
      .where((r) =>
          r['mountain_id'] == mountainId &&
          (r['is_archived'] ?? false) == false)
      .toList();
  yield _parseNodes(filtered);
}
```

**Issue:** The Supabase realtime stream subscribes to **all** rows in `nodes` with no `.eq('mountain_id', mountainId)` filter. Filtering is done client-side only.

**Impact:**
- **Performance:** Every node change (any mountain, any user) triggers the stream; each `nodeListProvider(mountainId)` receives and filters all events.
- **Security:** RLS mitigates cross-user leakage, but the stream is broader than necessary. If RLS were misconfigured, other users’ data could be received.

**Fix:** Add `.eq('mountain_id', mountainId)` to the stream. Supabase Flutter supports `.eq()` on regular columns for realtime streams. Note: multiple filters on stream() have known limitations; if both `user_id` and `mountain_id` are needed, RLS already enforces `user_id` at the DB level, so scoping by `mountain_id` is the primary optimization.

---

### C2. `user_id` Consistency — Node Stream Lacks Explicit Filter

**Location:** `lib/data/repositories/node_repository.dart` L28–31

**Issue:** The `.stream()` call has no `.eq('user_id', SupabaseService.userId)`. RLS enforces row-level security at the DB, so only the current user's rows are returned. Per your global rules, every query should be explicitly scoped to the authenticated user.

**Fix:** Supabase stream has known limitations with multiple filters. Prioritize `.eq('mountain_id', mountainId)` (C1) for performance. If the API supports chained filters, add `.eq('user_id', SupabaseService.userId)` for defense-in-depth. Document that RLS is the primary `user_id` enforcement for realtime.

---

## [FRICTION] Findings — Logic & UX

### F1. The "Loop Bug" — Pebble Creation and Index Reset

**Location:** `lib/features/scroll_map/climb_flow_overlay.dart` L373–398, `climb_flow_provider.dart`

**Observed behavior (per MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md):** Adding a pebble can reset the wizard view to Landmark Index 0.

**Analysis:**
- `_createPebbleAndAnimate` does **not** call `setPebbleStepBoulderIndex(0)` or `setStep`.
- `setPebbleStepBoulderIndex(0)` is only called in `_onStep3Continue` (step 3→4) and `_onStep4Continue` (step 4→5).
- `ref.invalidate(nodeListProvider)` does not depend on `climbFlowProvider`; no direct cascade.

**Likely cause:** `climbFlowProvider` is `AutoDisposeNotifierProvider`. If the overlay is ever unmounted/remounted (e.g., route rebuild, overlay dismissal and re-open), the provider is disposed and recreated with default `pebbleStepBoulderIndex = 0`.

**Defensive fix:** Ensure `climbFlowProvider` is not disposed while the overlay is open. Options:
1. Use `ref.keepAlive()` while the overlay is mounted.
2. Or use a non–auto-dispose provider for climb flow and explicitly reset on close.
3. Add a guard in `_createPebbleAndAnimate` to never call `setPebbleStepBoulderIndex(0)` or `setStep` (already satisfied; document this as a rule).

---

### F2. Elias Line Cache Never Cleared — Stale Copy on Step Change

**Location:** `lib/features/scroll_map/climb_flow_overlay.dart` L189–260

```dart
_cachedIntentLine ??= EliasDialogue.climbIntentPromptWithIndex(state.lastEliasIndex).$1;
```

**Issue:** `_cachedIntentLine`, `_cachedIdentityLine`, etc. use `??=` and are never cleared. If the user navigates back (e.g., step 5 → 4 → 5), the cached line for step 5 may be stale if `lastEliasIndex` changed.

**Impact:** Minor UX inconsistency; dialogue may not match current `lastEliasIndex`.

**Fix:** Clear caches when `state.step` or `state.lastEliasIndex` changes, or remove caching and compute on each build.

---

### F3. `ref.watch` vs `ref.read` — Correct Usage

**Audit result:** Usage is generally correct:
- `ref.watch` for reactive UI (e.g., `climbFlowProvider`, `satchelProvider`, `nodeListProvider`).
- `ref.read` for one-off actions (e.g., `climbFlowProvider.notifier`, `nodeActionsProvider`).

No obvious misuse found.

---

### F4. `edit_flow_overlay.dart` — Redundant `setState`

**Location:** `lib/features/scroll_map/edit_flow_overlay.dart` L89–105

```dart
if (mounted) {
  setState(() => _addPebbleNamingActive = false);
  _addPebbleController.clear();
  ...
  setState(() => _eliasLine = EliasDialogue.afterAddPebble());
}
```

**Issue:** Two `setState` calls; the second only updates `_eliasLine`. Can be merged into one `setState` for clarity.

---

## [DEBT] Findings — Patterns & Cleanup

### D1. Heavy Widget Rebuilds — Missing `const`

**Locations:**
- `_Step2Identity`, `_Step3Logic`, `_Step4Markers`, `_LandmarkChipsCard`, `_NamePebbleCard`, `_StoneChip` — already `const` where possible.
- `_Step1Intent` is `StatefulWidget` (needs listener); cannot be `const`.
- `EliasWidget`, `TweenAnimationBuilder` — consider `const` where parameters allow.

**Recommendation:** Add `const` to constructors that accept only const arguments to reduce rebuild cost.

---

### D2. `_Step5Pebbles` Watches Multiple Providers

**Location:** `lib/features/scroll_map/climb_flow_overlay.dart` L1349–1350

```dart
final satchel = ref.watch(satchelProvider);
final activePebbles = ref.watch(activePebblesProvider).valueOrNull ?? [];
```

**Issue:** Any change to `satchelProvider` or `activePebblesProvider` rebuilds the entire `_Step5Pebbles` subtree. When `movePebbleToReady` runs, both update, causing two rebuilds in quick succession.

**Recommendation:** Consider `ref.watch(satchelProvider.select((s) => s.slots.any((s) => s.readyToBurn))))` if only `readyToBurn` drives UI, or split into smaller widgets that watch narrower state.

---

### D3. `nodeListProvider` Invalidation Scope

**Location:** `climb_flow_overlay.dart` L387, `scroll_map_screen.dart` L604

In `_saveTitle` (scroll_map_screen.dart):
```dart
for (final m in mountains) {
  ref.invalidate(nodeListProvider(m.id));
}
```

**Issue:** Invalidates **all** mountains’ node lists when saving a single node title. Overly broad; causes unnecessary stream restarts.

**Fix:** Invalidate only the mountain that contains the edited node: `ref.invalidate(nodeListProvider(node.mountainId))`.

---

## Security Audit — `user_id` Usage

| Component | Status | Notes |
|-----------|--------|-------|
| `MountainRepository` | ✅ | All queries use `.eq('user_id', SupabaseService.userId)` |
| `NodeRepository` | ⚠️ | Inserts include `userId`; stream lacks explicit `user_id` filter (see C2) |
| `SatchelRepository` | ✅ | All queries use `user_id` |
| `WhetstoneRepository` | ✅ | All queries use `user_id` |
| `Node.toJson()` | ✅ | Includes `user_id` |
| `Mountain` create | ✅ | Includes `user_id` |

**Verdict:** Repositories generally respect `user_id`. The node stream is the main gap; RLS provides a safety net but explicit scoping is recommended.

---

## State Sync — Supabase → UI

| Provider | Sync Mechanism | Invalidation |
|----------|----------------|--------------|
| `mountainListProvider` | StreamProvider + `watchActive()` | Manual on create/archive/rename |
| `nodeListProvider` | StreamProvider + `watchByMountain()` | Manual after create/update/delete |
| `satchelProvider` | StateNotifier + `_load()` | Manual via `movePebbleToReady`, `packSatchel`, etc. |
| `activePebblesProvider` | FutureProvider | Invalidated by `SatchelNotifier` |

**Finding:** Realtime streams for mountains and nodes are in place. Manual `ref.invalidate()` is used after mutations. No obvious state desync; the main risk is the node stream’s broad subscription (C1).

---

## Recommendations Summary

1. **C1/C2:** Add `mountain_id` and `user_id` filters to the node realtime stream.
2. **F1:** Add `ref.keepAlive()` or equivalent to prevent `climbFlowProvider` disposal while the overlay is open.
3. **F2:** Clear or recompute Elias line caches when step or `lastEliasIndex` changes.
4. **D3:** Invalidate only the relevant `nodeListProvider(mountainId)` when saving a node title.
5. **D2:** Narrow `ref.watch` in `_Step5Pebbles` if only specific satchel/active-pebble fields drive the UI.

---

## Appendix: Files Audited

- `lib/providers/climb_flow_provider.dart`
- `lib/features/scroll_map/climb_flow_overlay.dart`
- `lib/providers/node_provider.dart`
- `lib/providers/mountain_provider.dart`
- `lib/providers/satchel_provider.dart`
- `lib/providers/active_pebbles_provider.dart`
- `lib/data/repositories/mountain_repository.dart`
- `lib/data/repositories/node_repository.dart`
- `lib/data/repositories/satchel_repository.dart`
- `lib/features/scroll_map/scroll_map_screen.dart`
- `lib/features/sanctuary/sanctuary_screen.dart`
- `lib/features/scroll_map/edit_flow_overlay.dart`
- `lib/data/supabase_service.dart`
- `lib/providers/repository_providers.dart`
