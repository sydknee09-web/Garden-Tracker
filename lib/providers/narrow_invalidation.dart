import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'mountain_provider.dart';
import 'node_provider.dart'; // nodeListProvider, mountainMomentumProvider

// ── Narrow Invalidation (Item 17) ─────────────────────────────────────────
//
// When a single pebble is carved (title edit, add child, delete, complete),
// invalidate only that mountain's node list and progress. Do NOT invalidate
// mountainListProvider — that forces a full re-read of the mountains stream
// and rebuilds the entire map. Narrow invalidation keeps 60fps "smooth as a
// river stone" as the user's map expands.
//
// Rule:
//   • Node mutation (in mountain X) → invalidateAfterNodeMutation(ref, X)
//   • Mountain list change (create / rename / archive / restore) →
//     invalidate mountainListProvider (and archivedMountainListProvider if needed)

/// Invalidates only the given mountain's node list and progress.
/// Call after any node mutation (title update, add boulder/pebble/shard,
/// delete subtree, toggle complete) so only that mountain's dependents rebuild.
void invalidateAfterNodeMutation(WidgetRef ref, String mountainId) {
  ref.invalidate(nodeListProvider(mountainId));
  ref.invalidate(mountainProgressProvider(mountainId));
}

/// Invalidates node list, progress, and momentum for a mountain (e.g. after burn).
/// Use after Hearth burn so the burned mountain's card and stats refresh.
void invalidateAfterBurn(WidgetRef ref, String mountainId) {
  ref.invalidate(nodeListProvider(mountainId));
  ref.invalidate(mountainProgressProvider(mountainId));
  ref.invalidate(mountainMomentumProvider(mountainId));
}
