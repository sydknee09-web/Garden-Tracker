import '../models/node.dart';
import '../models/satchel_slot.dart';
import '../repositories/satchel_repository.dart';
import 'demo_storage.dart';

/// Demo implementation of SatchelRepository using local storage.
class DemoSatchelRepository extends SatchelRepository {
  final DemoStorage _storage = DemoStorage.instance;

  SatchelSlot _slotFromMap(Map<String, dynamic> map, Node? node) {
    final packedAt = map['packed_at'];
    return SatchelSlot(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      slotIndex: (map['slot_index'] as num).toInt(),
      nodeId: map['node_id'] as String?,
      node: node,
      packedAt: packedAt != null
          ? DateTime.parse(packedAt as String)
          : DateTime.now(),
      readyToBurn: map['ready_to_burn'] as bool? ?? false,
    );
  }

  @override
  Future<List<SatchelSlot>> fetchSlotsWithNodes() async {
    final raw = _storage.satchelSlotsRaw;
    final result = <SatchelSlot>[];
    for (final map in raw) {
      final nodeId = map['node_id'] as String?;
      Node? node;
      if (nodeId != null && nodeId.toString().trim().isNotEmpty) {
        final found = _storage.nodes.where((n) => n.id == nodeId);
        node = found.isEmpty ? null : found.first;
      }
      result.add(_slotFromMap(Map<String, dynamic>.from(map), node));
    }
    result.sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
    return result;
  }

  @override
  Future<List<SatchelSlot>> fetchSlotsRaw() async {
    final raw = _storage.satchelSlotsRaw;
    return raw
        .map((m) => _slotFromMap(Map<String, dynamic>.from(m), null))
        .toList()
      ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
  }

  @override
  Future<void> assignPebbleToSlot(String nodeId, String slotId) async {
    await _storage.updateSatchelSlot(
      slotId,
      nodeId: nodeId,
      readyToBurn: false,
    );
  }

  @override
  Future<List<Node>> fetchPackCandidates({
    required int limit,
    Set<String>? excludeIds,
  }) async {
    final slots = await fetchSlotsRaw();
    final packedIds = slots
        .where((s) => s.nodeId != null && s.nodeId!.trim().isNotEmpty)
        .map((s) => s.nodeId!)
        .toSet();

    final nodes = _storage.nodes;
    var candidates = nodes
        .where(
          (n) =>
              !n.isComplete &&
              !n.isArchived &&
              !packedIds.contains(n.id) &&
              _isLeaf(n, nodes),
        )
        .toList();

    if (excludeIds != null && excludeIds.isNotEmpty) {
      final exclude = excludeIds;
      candidates = candidates.where((n) => !exclude.contains(n.id)).toList();
    }

    candidates.sort((a, b) {
      if (a.isStarred != b.isStarred) return a.isStarred ? -1 : 1;
      final aDue = a.dueDate;
      final bDue = b.dueDate;
      if (aDue != null && bDue != null) return aDue.compareTo(bDue);
      if (aDue != null) return -1;
      if (bDue != null) return 1;
      return a.createdAt.compareTo(b.createdAt);
    });

    return candidates.take(limit).toList();
  }

  /// Demo heuristic: leaf = no children. Layout/Sequential gates are Sanctuary-only.
  bool _isLeaf(Node n, List<Node> allNodes) =>
      !allNodes.any((c) => c.parentPath == n.path);

  @override
  Future<void> seedEmptySlots() async {
    final existing = _storage.satchelSlotsRaw;
    if (existing.length >= 6) return;
    final slots = List<Map<String, dynamic>>.from(existing);
    while (slots.length < 6) {
      slots.add({
        'id': 'slot-${slots.length + 1}',
        'user_id': DemoStorage.demoUserId,
        'slot_index': slots.length + 1,
        'node_id': null,
        'packed_at': DateTime.now().toIso8601String(),
        'ready_to_burn': false,
      });
    }
    await _storage.setSatchelSlots(slots);
  }

  @override
  Future<void> packSlots(List<Node> nodes) async {
    final slots = await fetchSlotsRaw();
    final emptySlots = slots.where((s) => s.isEmpty).toList()
      ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));

    final raw = _storage.satchelSlotsRaw
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
    for (var i = 0; i < nodes.length && i < emptySlots.length; i++) {
      final slot = emptySlots[i];
      final slotMap = raw.firstWhere((r) => r['id'] == slot.id);
      slotMap['node_id'] = nodes[i].id;
      slotMap['packed_at'] = DateTime.now().toIso8601String();
      slotMap['ready_to_burn'] = false;
    }
    await _storage.setSatchelSlots(raw);
  }

  @override
  Future<void> clearSlot(String slotId) async {
    await _storage.clearSatchelSlot(slotId);
  }

  @override
  Future<void> markReadyToBurn(String slotId) async {
    await _storage.updateSatchelSlot(slotId, readyToBurn: true);
  }

  @override
  Future<SatchelSlot?> toggleReadyToBurn(String slotId) async {
    final slots = await fetchSlotsRaw();
    final list = slots.where((s) => s.id == slotId).toList();
    if (list.isEmpty) return null;
    final slot = list.first;
    final newValue = !slot.readyToBurn;
    await _storage.updateSatchelSlot(slotId, readyToBurn: newValue);
    return slot.copyWith(readyToBurn: newValue);
  }

  @override
  Future<String?> findSlotIdForNode(String nodeId) async {
    final slots = await fetchSlotsRaw();
    final found = slots.where((s) => s.nodeId == nodeId).toList();
    return found.isEmpty ? null : found.first.id;
  }
}
