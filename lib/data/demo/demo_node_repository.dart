import 'dart:async';

import 'package:uuid/uuid.dart';

import '../../core/enums/node_type.dart';
import '../../core/utils/ltree_path.dart';
import '../models/node.dart';
import '../repositories/node_repository.dart';
import 'demo_storage.dart';

/// Demo implementation of NodeRepository using local storage.
class DemoNodeRepository implements NodeRepository {
  final DemoStorage _storage = DemoStorage.instance;
  static const _uuid = Uuid();

  @override
  Stream<List<Node>> watchByMountain(String mountainId) async* {
    yield _storage.nodesForMountain(mountainId).where((n) => !n.isArchived).toList();
    await for (final _ in _storage.onChange) {
      yield _storage.nodesForMountain(mountainId).where((n) => !n.isArchived).toList();
    }
  }

  @override
  Future<Node> createBoulder({
    required String mountainId,
    String title = '',
    String? id,
  }) async {
    final nodeId = id ?? _uuid.v4();
    final path = buildBoulderPath(mountainId, nodeId);
    final node = Node(
      id: nodeId,
      userId: DemoStorage.demoUserId,
      mountainId: mountainId,
      path: path,
      nodeType: NodeType.boulder,
      title: title,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    await _storage.addNode(node);
    return node;
  }

  @override
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
    final node = Node(
      id: nodeId,
      userId: DemoStorage.demoUserId,
      mountainId: mountainId,
      path: path,
      nodeType: nodeType,
      title: title,
      isPendingRitual: isPendingRitual,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    await _storage.addNode(node);
    return node;
  }

  @override
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

  @override
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

  @override
  Future<Node> split(Node source) async {
    final newId = _uuid.v4();
    final parentLtree = source.parentPath ?? source.path;
    final newPath = '$parentLtree.${newId.ltreeLabel}';
    final sibling = source.cloneAsNewSibling(
      newId: newId,
      siblingPath: newPath,
    );
    await _storage.addNode(sibling);
    return sibling;
  }

  @override
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

  @override
  Future<void> updateTitle({required String id, required String title}) async {
    await _storage.updateNode(id, title: title);
  }

  @override
  Future<void> toggleStar(String id, {required bool isStarred}) async {
    await _storage.updateNode(id, isStarred: isStarred);
  }

  @override
  Future<void> setDueDate(String id, {required DateTime? dueDate}) async {
    await _storage.updateNode(id, dueDate: dueDate);
  }

  @override
  Future<void> setIsPendingRitual(String nodeId, {required bool value}) async {
    await _storage.updateNode(nodeId, isPendingRitual: value);
  }

  @override
  Future<void> burnNode(String nodeId) async {
    await _storage.updateNode(
      nodeId,
      isComplete: true,
      completedAt: DateTime.now(),
      isArchived: true,
      isPendingRitual: false,
    );
    await _cascadeParentCompletion(nodeId);
  }

  /// Simulates Postgres trigger: when a node completes, check if parent should complete.
  Future<void> _cascadeParentCompletion(String completedNodeId) async {
    final completed = _storage.nodes.where((n) => n.id == completedNodeId).toList();
    if (completed.isEmpty) return;
    final parentPath = completed.first.parentPath;
    if (parentPath == null) return;
    final parentList = _storage.nodes.where((n) => n.path == parentPath).toList();
    if (parentList.isEmpty) return;
    final parent = parentList.first;
    final depth = parentPath.split('.').length;
    final siblings = _storage.nodes.where((n) =>
        n.path.startsWith('$parentPath.') &&
        n.path.split('.').length == depth + 1);
    final allComplete = siblings.every((n) => n.isComplete);
    if (allComplete) {
      await _storage.updateNode(
        parent.id,
        isComplete: true,
        completedAt: DateTime.now(),
        isArchived: true,
        isPendingRitual: false,
      );
      await _cascadeParentCompletion(parent.id);
    }
  }

  @override
  Future<void> delete(String id) async {
    await _storage.deleteNode(id);
  }

  @override
  Future<List<DateTime>> fetchBurnTimestamps() async =>
      _storage.burnTimestamps;

  @override
  Future<int> countIncompleteLeavesForBoulder(String boulderPath) async {
    final under = _storage.nodes
        .where((n) => !n.isComplete && n.path.startsWith('$boulderPath.'))
        .toList();
    return under.where((n) => !_storage.nodes.any((c) => c.parentPath == n.path)).length;
  }

  @override
  Future<List<DateTime>> fetchBurnTimestampsForMountain(String mountainId) async =>
      _storage.burnTimestampsForMountain(mountainId);

  @override
  Future<void> deleteSubtree(Node node) async {
    final toDelete = _storage.nodes
        .where((n) => n.path == node.path || n.path.startsWith('${node.path}.'))
        .toList();
    for (final n in toDelete) {
      await _storage.deleteNode(n.id);
    }
  }
}
