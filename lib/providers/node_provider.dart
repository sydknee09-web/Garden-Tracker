import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/node.dart';
import '../data/repositories/node_repository.dart';
import '../core/enums/node_type.dart';

final _nodeRepoProvider = Provider<NodeRepository>(
  (ref) => NodeRepository(),
);

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

/// The ID of a node that was just created and should have its
/// title text field auto-focused for immediate editing.
final editingNodeIdProvider = StateProvider<String?>((ref) => null);

// ── Actions ──────────────────────────────────────────────────

/// Exposes node repository actions to the UI.
final nodeActionsProvider = Provider<NodeRepository>((ref) {
  return ref.watch(_nodeRepoProvider);
});
