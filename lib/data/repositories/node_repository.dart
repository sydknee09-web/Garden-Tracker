import 'package:uuid/uuid.dart';
import '../models/node.dart';
import '../supabase_service.dart';
import '../../core/enums/node_type.dart';
import '../../core/utils/ltree_path.dart';

class NodeRepository {
  static const _table = 'nodes';
  static const _uuid = Uuid();

  /// Live stream of all nodes for a mountain, ordered by LTREE path.
  /// Fetches initial data first (guarantees list loads even if Realtime is not configured),
  /// then listens to realtime changes.
  Stream<List<Node>> watchByMountain(String mountainId) async* {
    final initial = await SupabaseService.client
        .from(_table)
        .select()
        .eq('mountain_id', mountainId)
        .order('path');
    yield _parseNodes(initial as List);

    try {
      await for (final rows in SupabaseService.client
          .from(_table)
          .stream(primaryKey: ['id'])
          .order('path')) {
        yield _parseNodes(
          (rows as List).where((r) => r['mountain_id'] == mountainId).toList(),
        );
      }
    } catch (_) {
      // Realtime unavailable — UI keeps the initial snapshot; user can retry.
    }
  }

  List<Node> _parseNodes(List<dynamic> rows) =>
      rows.map((r) => Node.fromJson(r as Map<String, dynamic>)).toList();

  // ── MALLET OPERATIONS ──────────────────────────────────────

  /// Mallet on Mountain path → creates a Boulder.
  Future<Node> createBoulder({
    required String mountainId,
    String title = '',
  }) async {
    final id = _uuid.v4();
    final path = buildBoulderPath(mountainId, id);
    return _insert(Node(
      id: id,
      userId: SupabaseService.userId,
      mountainId: mountainId,
      path: path,
      nodeType: NodeType.boulder,
      title: title,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
  }

  /// Mallet on Boulder → creates a Pebble as a child.
  Future<Node> createPebble({
    required String mountainId,
    required String boulderId,
    String title = '',
  }) async {
    final id = _uuid.v4();
    final path = buildPebblePath(mountainId, boulderId, id);
    return _insert(Node(
      id: id,
      userId: SupabaseService.userId,
      mountainId: mountainId,
      path: path,
      nodeType: NodeType.pebble,
      title: title,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
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

  /// Mallet on Boulder → creates a Shard under a specific Pebble.
  Future<Node> createShard({
    required String mountainId,
    required String boulderId,
    required String pebbleId,
    String title = '',
  }) async {
    final id = _uuid.v4();
    final path = buildShardPath(mountainId, boulderId, pebbleId, id);
    return _insert(Node(
      id: id,
      userId: SupabaseService.userId,
      mountainId: mountainId,
      path: path,
      nodeType: NodeType.shard,
      title: title,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
  }

  // ── EDITING ────────────────────────────────────────────────

  Future<void> updateTitle({required String id, required String title}) async {
    await SupabaseService.client
        .from(_table)
        .update({'title': title, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  Future<void> toggleStar(String id, {required bool isStarred}) async {
    await SupabaseService.client
        .from(_table)
        .update({'is_starred': isStarred, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  Future<void> setDueDate(String id, {required DateTime? dueDate}) async {
    await SupabaseService.client
        .from(_table)
        .update({
          'due_date': dueDate?.toIso8601String().split('T').first,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  // ── BURN (HEARTH COMPLETION) ───────────────────────────────

  /// Burns a pebble: marks it complete and deletes all its child shards.
  /// Shards are visual-only — they are deleted when the parent pebble burns.
  Future<void> burnPebble(String pebbleId, {required String pebblePath}) async {
    final now = DateTime.now().toIso8601String();

    // 1. Mark the pebble complete
    await SupabaseService.client
        .from(_table)
        .update({'is_complete': true, 'completed_at': now, 'updated_at': now})
        .eq('id', pebbleId)
        .eq('user_id', SupabaseService.userId);

    // 2. Delete all child shards (path starts with pebble path + '.')
    //    Uses LTREE descendant operator via raw filter.
    await SupabaseService.client
        .from(_table)
        .delete()
        .eq('user_id', SupabaseService.userId)
        .eq('node_type', 'shard')
        .filter('path', 'cd', pebblePath);
  }

  Future<void> delete(String id) async {
    await SupabaseService.client
        .from(_table)
        .delete()
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  /// Deletes a node and all its descendants (e.g. boulder + its pebbles and shards).
  /// Uses the same LTREE 'cd' (child/descendant) operator as burnPebble.
  Future<void> deleteSubtree(Node node) async {
    // Delete all strict descendants first
    await SupabaseService.client
        .from(_table)
        .delete()
        .eq('user_id', SupabaseService.userId)
        .filter('path', 'cd', node.path);
    // Delete the node itself
    await delete(node.id);
  }

  // ── PRIVATE ────────────────────────────────────────────────

  Future<Node> _insert(Node node) async {
    final row = await SupabaseService.client
        .from(_table)
        .insert(node.toJson())
        .select()
        .single();
    return Node.fromJson(row);
  }
}
