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
final nodeListProvider = StreamProvider.family<List<Node>, String>((
  ref,
  mountainId,
) {
  return ref.watch(_nodeRepoProvider).watchByMountain(mountainId);
});

/// Map card: milestone (boulder) completion breakdown from the active node stream.
class MountainMarkerStats {
  const MountainMarkerStats({
    required this.total,
    required this.complete,
    required this.inProgress,
    required this.locked,
  });

  final int total;
  final int complete;
  final int inProgress;
  final int locked;

  double get ringFraction => total == 0 ? 0.0 : complete / total;
}

MountainMarkerStats computeMountainMarkerStats(List<Node> nodes) {
  final boulders = nodes.where((n) => n.nodeType == NodeType.boulder).toList();
  if (boulders.isEmpty) {
    return const MountainMarkerStats(
      total: 0,
      complete: 0,
      inProgress: 0,
      locked: 0,
    );
  }
  var done = 0;
  var prog = 0;
  var lock = 0;
  for (final b in boulders) {
    final under = nodes
        .where((n) => n.path != b.path && n.path.startsWith('${b.path}.'))
        .toList();
    bool isLeaf(Node n) {
      final d = n.path.split('.').length;
      return !under.any(
        (c) =>
            c.path.startsWith('${n.path}.') &&
            c.path.split('.').length == d + 1,
      );
    }

    final leaves = under.where(isLeaf).toList();
    if (leaves.isEmpty) {
      lock++;
      continue;
    }
    if (leaves.every((l) => l.isComplete)) {
      done++;
    } else {
      prog++;
    }
  }
  return MountainMarkerStats(
    total: boulders.length,
    complete: done,
    inProgress: prog,
    locked: lock,
  );
}

/// Live marker stats for Scroll Map summary (X of Y milestones complete).
final mountainMarkerStatsProvider =
    Provider.family<MountainMarkerStats?, String>((ref, mountainId) {
      final nodes = ref.watch(nodeListProvider(mountainId)).valueOrNull;
      if (nodes == null) return null;
      return computeMountainMarkerStats(nodes);
    });

/// All boulder nodes for a mountain, ordered by creation time.
final boulderListProvider = Provider.family<List<Node>, String>((
  ref,
  mountainId,
) {
  return ref
          .watch(nodeListProvider(mountainId))
          .valueOrNull
          ?.where((n) => n.nodeType == NodeType.boulder)
          .toList() ??
      [];
});

/// All incomplete pebble nodes for a mountain.
final pebbleListProvider = Provider.family<List<Node>, String>((
  ref,
  mountainId,
) {
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
    Provider.family<List<Node>, ({String mountainId, String pebblePath})>((
      ref,
      args,
    ) {
      return ref
              .watch(nodeListProvider(args.mountainId))
              .valueOrNull
              ?.where(
                (n) =>
                    n.nodeType == NodeType.shard &&
                    n.parentPath == args.pebblePath,
              )
              .toList() ??
          [];
    });

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
  const MountainMomentum({required this.burnsThisWeek, this.daysSinceLastBurn});

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

class MountainLedgerData {
  const MountainLedgerData({required this.nodes, required this.progress});

  final List<Node> nodes;
  final double progress;
}

/// Flat ledger data for a peak journal, with leaf-only extinguish progress.
final mountainLedgerProvider = FutureProvider.autoDispose
    .family<MountainLedgerData, String>((ref, mountainId) async {
      final repository = ref.watch(_nodeRepoProvider);
      final nodes = await repository.fetchMountainLedger(mountainId);
      final pathSet = nodes.map((n) => n.path).toSet();

      var totalLeaves = 0;
      var extinguishedLeaves = 0;

      for (final node in nodes) {
        final hasChild = pathSet.any(
          (p) => p != node.path && p.startsWith('${node.path}.'),
        );
        if (!hasChild) {
          totalLeaves++;
          if (node.isComplete) {
            extinguishedLeaves++;
          }
        }
      }

      final progress = totalLeaves == 0
          ? 0.0
          : extinguishedLeaves / totalLeaves;
      return MountainLedgerData(nodes: nodes, progress: progress);
    });
