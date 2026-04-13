# Scroll System Master Prompt — Implementation Plan

## Context

The current app uses **go_router** with a standard push to `ScrollMapScreen`, which shows the **map hierarchy** (mountains > boulders > pebbles > shards). The Scroll is the map view, not a flat satchel list. The satchel is a separate backpack with 6 slots. The schema uses `nodes.is_complete` and `satchel_slots`. This plan implements the master prompt while mapping to the existing architecture.

---

## 1. Dependencies and Assets

**pubspec.yaml**
- Add `audioplayers: ^6.0.0` (or latest compatible)
- Add asset paths:
  - `assets/sounds/`
  - `assets/images/`

**New assets** (you will need to provide or generate):
- `assets/sounds/scroll_open.mp3`
- `assets/images/parchment_tile.png` (tileable parchment texture)
- `assets/images/scroll_top.png` (wooden roller, top)
- `assets/images/scroll_bottom.png` (wooden roller, bottom)

---

## 2. Custom Route — createScrollRoute

Create a `PageRouteBuilder`-style transition:
- Use `SizeTransition` with `axis: Axis.vertical`, `axisAlignment: 0` (top-aligned)
- Duration: 800ms
- Curved: `Curves.easeOut` (deliberate unroll)
- Play `assets/sounds/scroll_open.mp3` once when the animation starts

**Integration with go_router:** Use `CustomTransitionPage` in the scroll route:

```dart
GoRoute(
  path: AppRoutes.scroll,
  pageBuilder: (context, state) => CustomTransitionPage(
    key: state.pageKey,
    child: const TheScrollPage(),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return SizeTransition(
        sizeFactor: animation,
        axis: Axis.vertical,
        axisAlignment: 0,
        child: child,
      );
    },
    transitionDuration: const Duration(milliseconds: 800),
  ),
),
```

**Audio:** Play in `TheScrollPage.initState` when the route is first built (the unroll is handled by `CustomTransitionPage`).

---

## 3. The Scroll Page — Parchment + Rollers

**Scaffold structure:**
- `Stack` with:
  1. **Background:** `Image.asset('assets/images/parchment_tile.png')` with `repeat: ImageRepeat.repeat`, wrapped in `ColorFiltered` with `ColorFilter.mode(Colors.brown.withOpacity(0.08), BlendMode.multiply)` for a subtle sepia tint
  2. **Content:** `CustomScrollView` or `ListView` with the task rows
  3. **Top roller:** `Positioned(top: 0, left: 0, right: 0, child: Image.asset('assets/images/scroll_top.png', fit: BoxFit.fitWidth))`
  4. **Bottom roller:** `Positioned(bottom: 0, left: 0, right: 0, child: Image.asset('assets/images/scroll_bottom.png', fit: BoxFit.fitWidth))`

Ensure the list content is inset with padding so it does not overlap the rollers (e.g. `top: 60, bottom: 60`).

---

## 4. Task Model and Data Mapping

**Schema mapping:**
- `is_done` → `nodes.is_complete` (Right swipe = mark complete / burn pebble)
- "Stow" → `removeFromSatchel` (Left swipe = clear satchel slot; pebble stays on mountain)

**Task source:** Scroll shows the **map hierarchy** (mountains > boulders > pebbles > shards). Only incomplete pebbles are shown. Right swipe = Done (burn pebble, clear satchel slot if present). Left swipe = Stow (remove from satchel only; pebble stays on mountain). The satchel is a separate 6-slot backpack; the Scroll is the map view.

---

## 5. TaskRow Widget

**Structure:**
- `Dismissible` with `key: ValueKey(task.id)` (critical for correct behavior)
- `direction: DismissDirection.horizontal` (both left and right)
- `onDismissed`:
  - Right: call `markReadyToBurn` then user drops in hearth, OR directly `burnPebble` + clear slot
  - Left: call `removeFromSatchel(slotId)` only
- Background for right swipe: ember "Done"
- Background for left swipe: charcoal "Stow"

**Child:** Row with:
- Task title (`Text` or `TextField` when editing)
- If `isArchitectMode`: trailing `IconButton(icon: Icons.close, onPressed: () => deleteNode(node))`

**Inline editing:** When `isArchitectMode` and row is tapped, swap `Text` for `TextField`. On unfocus or Enter, save via `updateTitle(nodeId, text)`.

---

## 6. Architect Mode

- `isArchitectMode` = `malletActiveProvider` (reuse existing)
- In Architect Mode: tap to edit, show Delete icon
- In Standard Mode: no Delete icon, tap does nothing
- Dismissible works in both modes

---

## 7. Styling

- Task text: `fontFamily: 'Georgia'` (serif), dark charcoal color
- Ensure all interactive elements respect `isArchitectMode`

---

## 8. File Structure

| File | Purpose |
|------|---------|
| `lib/features/scroll_map/scroll_map_screen.dart` | Scroll page with parchment, rollers, map hierarchy |
| `lib/app.dart` | Scroll route uses CustomTransitionPage (800ms unroll) |
| `lib/providers/satchel_provider.dart` | removeFromSatchel |
| `lib/data/repositories/node_repository.dart` | burnPebble |

---

## 9. Replace vs Coexist

**Implemented:** The scroll route uses `ScrollMapScreen` (parchment, rollers, map hierarchy). Architect mode toggle in the app bar enables inline edit and delete. Dismissible on pebble rows: right = Done, left = Stow.

---

## 10. Implementation Order

1. Add audioplayers + asset paths; create placeholder assets (or document required files)
2. Update go_router with CustomTransitionPage for scroll route
3. Build TheScrollPage scaffold (parchment, rollers, padding)
4. Build TaskRow with Dismissible (right=Done, left=Stow)
5. Wire data: satchel slots → TaskRow, call existing providers
6. Add inline edit + Delete icon when isArchitectMode
7. Trigger audio on route enter
8. Test and tune animation duration (800ms)
