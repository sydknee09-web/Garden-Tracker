import 'package:uuid/uuid.dart';
import '../models/node.dart';
import '../supabase_service.dart';
import '../../core/enums/node_type.dart';
import '../../core/utils/ltree_path.dart';

class NodeRepository {
  static const _table = 'nodes';
  static const _uuid = Uuid();

  /// Live stream of all nodes for a mountain, ordered by LTREE path.
  /// Excludes archived nodes (burned pebbles) so they don't clutter the map.
  /// Cache key 'nodes_${mountainId}_active' prevents cached archived nodes from appearing.
  Stream<List<Node>> watchByMountain(String mountainId) async* {
    final cacheKey = 'nodes_${mountainId}_active';
    final initial = await SupabaseService.executeWithRetryAndCache(
      () => SupabaseService.client
          .from(_table)
          .select()
          .eq('mountain_id', mountainId)
          .eq('is_archived', false)
          .order('path')
          .then((r) => r as List),
      cacheKey,
    );
    yield _parseNodes(initial);

    try {
      await for (final rows in SupabaseService.client
          .from(_table)
          .stream(primaryKey: ['id'])
          .eq('mountain_id', mountainId)
          .order('path')) {
        final filtered = (rows as List)
            .where((r) =>
                r['mountain_id'] == mountainId &&
                (r['is_archived'] ?? false) == false)
            .toList();
        yield _parseNodes(filtered);
      }
    } catch (_) {
      // Realtime unavailable — UI keeps the initial snapshot; user can retry.
    }
  }

  List<Node> _parseNodes(List<dynamic> rows) =>
      rows.map((r) => Node.fromJson(r as Map<String, dynamic>)).toList();

  // ── MALLET OPERATIONS ──────────────────────────────────────

  /// Mallet on Mountain path → creates a Boulder.
  /// Optional [id] for demo seeding (Developer-Only).
  Future<Node> createBoulder({
    required String mountainId,
    String title = '',
    String? id,
  }) async {
    final nodeId = id ?? _uuid.v4();
    final path = buildBoulderPath(mountainId, nodeId);
    return _insert(Node(
      id: nodeId,
      userId: SupabaseService.userId,
      mountainId: mountainId,
      path: path,
      nodeType: NodeType.boulder,
      title: title,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
  }

  /// Depth-agnostic: creates a node under any parent. Use for Hammer and Mallet.
  /// Replaces path-level hacks; works at any depth (boulder, sub-boulder, pebble).
  Future<Node> createNodeUnderParent({
    required String parentPath,
    required String mountainId,
    required NodeType nodeType,
    String title = '',
    bool isPendingRitual = false,
    String? id,
  }) async {
    final nodeId = id ?? _uuid.v4();
    final path = buildChildPath(parentPath, nodeId);
    return _insert(Node(
      id: nodeId,
      userId: SupabaseService.userId,
      mountainId: mountainId,
      path: path,
      nodeType: nodeType,
      title: title,
      isPendingRitual: isPendingRitual,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
  }

  /// Mallet on Boulder/Sub-Boulder → creates a Sub-Boulder as a child.
  Future<Node> createSubBoulder({
    required String parentPath,
    required String mountainId,
    String title = '',
    String? id,
  }) =>
      createNodeUnderParent(
        parentPath: parentPath,
        mountainId: mountainId,
        nodeType: NodeType.boulder,
        title: title,
        id: id,
      );

  /// Mallet on Boulder → creates a Pebble as a child. Wrapper for 3-level path.
  Future<Node> createPebble({
    required String mountainId,
    required String boulderId,
    String title = '',
    bool isPendingRitual = false,
    String? id,
  }) =>
      createNodeUnderParent(
        parentPath: buildBoulderPath(mountainId, boulderId),
        mountainId: mountainId,
        nodeType: NodeType.pebble,
        title: title,
        isPendingRitual: isPendingRitual,
        id: id,
      );

  /// Updates is_pending_ritual for remove-from-satchel flow.
  Future<void> setIsPendingRitual(String nodeId, {required bool value}) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({
          'is_pending_ritual': value,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', nodeId)
        .eq('user_id', SupabaseService.userId));
  }

  /// Mallet on Pebble or Shard → splits into two siblings.
  /// The original node is unchanged. The new node clones is_starred + due_date.
  Future<Node> split(Node source) async {
    final newId = _uuid.v4();
    final parentLtree = source.parentPath ?? source.path;
    final newPath = '$parentLtree.${newId.ltreeLabel}';
    final sibling = source.cloneAsNewSibling(
      newId: newId,
      siblingPath: newPath,
    );
    return _insert(sibling);
  }

  /// Hammer on Pebble → creates a Shard. Depth-agnostic via [createNodeUnderParent].
  Future<Node> createShard({
    required String parentPebblePath,
    required String mountainId,
    String title = '',
    String? id,
  }) =>
      createNodeUnderParent(
        parentPath: parentPebblePath,
        mountainId: mountainId,
        nodeType: NodeType.shard,
        title: title,
        id: id,
      );


  // ── EDITING ────────────────────────────────────────────────

  Future<void> updateTitle({required String id, required String title}) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({'title': title, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> toggleStar(String id, {required bool isStarred}) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({'is_starred': isStarred, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> setDueDate(String id, {required DateTime? dueDate}) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({
          'due_date': dueDate?.toIso8601String().split('T').first,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  // ── BURN (HEARTH COMPLETION) ───────────────────────────────

  /// Burns a node (pebble or shard): extinguishes it—sets is_complete, no delete.
  /// Shards stay; the recursive trigger cascades to parent pebble when all siblings done.
  /// Preserves Sanctuary history; weight transforms into Light (progress).
  Future<void> burnNode(String nodeId) async {
    final now = DateTime.now().toIso8601String();
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({
          'is_complete': true,
          'completed_at': now,
          'updated_at': now,
          'is_archived': true,
          'is_pending_ritual': false,
        })
        .eq('id', nodeId)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> delete(String id) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .delete()
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  /// Fetches all burn (pebble + shard completion) timestamps for streak computation.
  Future<List<DateTime>> fetchBurnTimestamps() async {
    final rows = await SupabaseService.executeWithRetryAndCache(
      () => SupabaseService.client
          .from(_table)
          .select('completed_at')
          .eq('user_id', SupabaseService.userId)
          .inFilter('node_type', ['pebble', 'shard'])
          .eq('is_complete', true)
          .not('completed_at', 'is', null)
          .then((r) => r as List),
      'burn_timestamps',
    );
    return rows
        .map((r) => DateTime.parse(r['completed_at'] as String).toLocal())
        .toList();
  }

  /// Count of incomplete leaves under a boulder (for contextual haptic).
  Future<int> countIncompleteLeavesForBoulder(String boulderPath) async {
    final rows = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .select('id, path')
        .eq('user_id', SupabaseService.userId)
        .eq('is_complete', false)
        .like('path', '$boulderPath.%'));
    final nodes = rows as List;
    if (nodes.isEmpty) return 0;
    final allPaths = nodes.map((r) => r['path'] as String).toSet();
    var leaves = 0;
    for (final r in nodes) {
      final path = r['path'] as String;
      final depth = path.split('.').length;
      final hasChild = allPaths.any((p) =>
          p.startsWith('$path.') && p.split('.').length == depth + 1);
      if (!hasChild) leaves++;
    }
    return leaves;
  }

  /// Fetches burn timestamps for a single mountain (for momentum display).
  Future<List<DateTime>> fetchBurnTimestampsForMountain(String mountainId) async {
    final rows = await SupabaseService.executeWithRetryAndCache(
      () => SupabaseService.client
          .from(_table)
          .select('completed_at')
          .eq('user_id', SupabaseService.userId)
          .eq('mountain_id', mountainId)
          .inFilter('node_type', ['pebble', 'shard'])
          .eq('is_complete', true)
          .not('completed_at', 'is', null)
          .then((r) => r as List),
      'burn_timestamps_$mountainId',
    );
    return rows
        .map((r) => DateTime.parse(r['completed_at'] as String).toLocal())
        .toList();
  }

  /// Deletes a node and all its descendants (e.g. boulder + its pebbles and shards).
  Future<void> deleteSubtree(Node node) async {
    await SupabaseService.executeWithRetry(() async {
      await SupabaseService.client
          .from(_table)
          .delete()
          .eq('user_id', SupabaseService.userId)
          .filter('path', 'cd', node.path);
      await SupabaseService.client
          .from(_table)
          .delete()
          .eq('id', node.id)
          .eq('user_id', SupabaseService.userId);
    });
  }

  // ── PRIVATE ────────────────────────────────────────────────

  Future<Node> _insert(Node node) async {
    final row = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .insert(node.toJson())
        .select()
        .single());
    return Node.fromJson(row);
  }
}
