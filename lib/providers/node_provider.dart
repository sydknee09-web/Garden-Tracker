import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/node.dart';
import '../data/repositories/node_repository.dart';
import '../core/enums/node_type.dart';
import 'repository_providers.dart';

final _nodeRepoProvider = Provider<NodeRepository>((ref) {
  return ref.watch(nodeRepositoryProvider);
});

/// Live stream of all nodes for a given mountain, ordered by LTREE path.
/// Keyed by mountainId — each mountain gets its own independent stream.
final nodeListProvider =
    StreamProvider.family<List<Node>, String>((ref, mountainId) {
  return ref.watch(_nodeRepoProvider).watchByMountain(mountainId);
});

/// All boulder nodes for a mountain, ordered by creation time.
final boulderListProvider =
    Provider.family<List<Node>, String>((ref, mountainId) {
  return ref
          .watch(nodeListProvider(mountainId))
          .valueOrNull
          ?.where((n) => n.nodeType == NodeType.boulder)
          .toList() ??
      [];
});

/// All incomplete pebble nodes for a mountain.
final pebbleListProvider =
    Provider.family<List<Node>, String>((ref, mountainId) {
  return ref
          .watch(nodeListProvider(mountainId))
          .valueOrNull
          ?.where((n) => n.nodeType == NodeType.pebble && !n.isComplete)
          .toList() ??
      [];
});

/// All shard nodes that are children of a given pebble, identified by pebble LTREE path.
/// Uses the flat node list from the mountain stream — zero extra network calls.
final shardListProvider =
    Provider.family<List<Node>, ({String mountainId, String pebblePath})>(
  (ref, args) {
    return ref
            .watch(nodeListProvider(args.mountainId))
            .valueOrNull
            ?.where((n) =>
                n.nodeType == NodeType.shard &&
                n.parentPath == args.pebblePath)
            .toList() ??
        [];
  },
);

// ── Mallet UI State ──────────────────────────────────────────

/// Whether "Architect Mode" is active (mallet tool revealed).
final malletActiveProvider = StateProvider<bool>((ref) => false);

/// Stones dropped onto hearth this "round" (1–5). Reset when user packs satchel.
final hearthDropCountProvider = StateProvider<int>((ref) => 0);

/// The ID of a node that was just created and should have its
/// title text field auto-focused for immediate editing.
final editingNodeIdProvider = StateProvider<String?>((ref) => null);

/// True when Refine mode is active on the Scroll (tap node to edit).
/// Deprecated/Unused: No longer triggered by Satchel; Whetstone overlay offers Sharpen Habits only. Refine/Edit is on the Map (Peak Detail). Retained for future "Global Refine" features.
final refineModeProvider = StateProvider<bool>((ref) => false);

/// Momentum stats for a mountain: burns this week and days since last burn.
class MountainMomentum {
  const MountainMomentum({
    required this.burnsThisWeek,
    this.daysSinceLastBurn,
  });

  final int burnsThisWeek;
  final int? daysSinceLastBurn;

  bool get isUntouched => daysSinceLastBurn == null || daysSinceLastBurn! >= 7;
}

/// Burns this week and days since last burn for a mountain.
final mountainMomentumProvider =
    FutureProvider.family<MountainMomentum, String>((ref, mountainId) async {
  final repo = ref.watch(_nodeRepoProvider);
  final timestamps = await repo.fetchBurnTimestampsForMountain(mountainId);
  final now = DateTime.now();
  final weekAgo = now.subtract(const Duration(days: 7));
  final burnsThisWeek = timestamps.where((t) => t.isAfter(weekAgo)).length;
  final sorted = timestamps.toList()..sort((a, b) => b.compareTo(a));
  final lastBurn = sorted.isEmpty ? null : sorted.first;
  final daysSinceLastBurn = lastBurn != null
      ? now.difference(lastBurn).inDays
      : null;
  return MountainMomentum(
    burnsThisWeek: burnsThisWeek,
    daysSinceLastBurn: daysSinceLastBurn,
  );
});

// ── Actions ──────────────────────────────────────────────────

/// Exposes node repository actions to the UI.
final nodeActionsProvider = Provider<NodeRepository>((ref) {
  return ref.watch(_nodeRepoProvider);
});
