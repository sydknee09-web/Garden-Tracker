import 'package:flutter/foundation.dart';

import '../models/node.dart';
import '../models/satchel_slot.dart';
import '../supabase_service.dart';

/// Abstract contract for satchel slot management.
/// Implementations: [SupabaseSatchelRepository], [DemoSatchelRepository].
abstract class SatchelRepository {
  Future<List<SatchelSlot>> fetchSlotsWithNodes();
  Future<List<SatchelSlot>> fetchSlotsRaw();
  Future<List<Node>> fetchPackCandidates({
    required int limit,
    Set<String>? excludeIds,
  });
  Future<void> seedEmptySlots();
  Future<void> packSlots(List<Node> nodes);
  Future<void> assignPebbleToSlot(String nodeId, String slotId);
  Future<void> clearSlot(String slotId);
  Future<void> markReadyToBurn(String slotId);
  Future<void> toggleReadyToBurn(String slotId);
  Future<String?> findSlotIdForNode(String nodeId);
}

/// Supabase implementation of [SatchelRepository].
class SupabaseSatchelRepository extends SatchelRepository {
  static const _slotsTable = 'satchel_slots';

  @override
  Future<List<SatchelSlot>> fetchSlotsWithNodes() async {
    final rows = await SupabaseService.executeWithRetryAndCache(
      () => SupabaseService.client
          .from(_slotsTable)
          .select('*, nodes(*)')
          .eq('user_id', SupabaseService.userId)
          .order('slot_index')
          .then((r) => r),
      'satchel_slots',
    );
    return rows
        .map((r) => SatchelSlot.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<SatchelSlot>> fetchSlotsRaw() async {
    final rows = await SupabaseService.executeWithRetryAndCache(
      () => SupabaseService.client
          .from(_slotsTable)
          .select('id, user_id, slot_index, node_id, packed_at, ready_to_burn')
          .eq('user_id', SupabaseService.userId)
          .order('slot_index')
          .then((r) => r),
      'satchel_slots_raw',
    );
    return rows
        .map((r) {
          final map = Map<String, dynamic>.from(r as Map<String, dynamic>);
          map['nodes'] = null;
          return SatchelSlot.fromJson(map);
        })
        .toList();
  }

  @override
  Future<List<Node>> fetchPackCandidates({
    required int limit,
    Set<String>? excludeIds,
  }) async {
    try {
      final rows = await SupabaseService.executeWithRetry(() =>
          SupabaseService.client.rpc(
            'get_packable_candidates',
            params: {
              'p_user_id': SupabaseService.userId,
              'p_limit': limit,
              'p_exclude_ids': excludeIds?.toList() ?? [],
            },
          ));
      return (rows as List<dynamic>)
          .map((r) => Node.fromJson(r as Map<String, dynamic>))
          .toList();
    } catch (e, st) {
      debugPrint('SatchelRepository.fetchPackCandidates failed: $e');
      debugPrint('$st');
      return [];
    }
  }

  @override
  Future<void> seedEmptySlots() async {
    final userId = SupabaseService.userId;
    final inserts = List.generate(
      6,
      (i) => {'user_id': userId, 'slot_index': i + 1, 'node_id': null},
    );
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_slotsTable)
        .upsert(inserts, onConflict: 'user_id,slot_index'));
  }

  @override
  Future<void> packSlots(List<Node> nodes) async {
    final slots = await fetchSlotsRaw();
    slots.sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
    final emptySlots = slots.where((s) => s.isEmpty).toList()
      ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));

    final updates = <Map<String, dynamic>>[];
    for (var i = 0; i < nodes.length && i < emptySlots.length; i++) {
      final slot = emptySlots[i];
      updates.add({
        'id': slot.id,
        'user_id': SupabaseService.userId,
        'slot_index': slot.slotIndex,
        'node_id': nodes[i].id,
        'packed_at': DateTime.now().toIso8601String(),
        'ready_to_burn': false,
      });
    }

    if (updates.isNotEmpty) {
      await SupabaseService.executeWithRetry(() => SupabaseService.client
          .from(_slotsTable)
          .upsert(updates, onConflict: 'user_id,slot_index'));
    }
  }

  @override
  Future<void> assignPebbleToSlot(String nodeId, String slotId) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_slotsTable)
        .update({
          'node_id': nodeId,
          'packed_at': DateTime.now().toIso8601String(),
          'ready_to_burn': false,
        })
        .eq('id', slotId)
        .eq('user_id', SupabaseService.userId));
  }

  @override
  Future<void> clearSlot(String slotId) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_slotsTable)
        .update({
          'node_id': null,
          'packed_at': DateTime.now().toIso8601String(),
          'ready_to_burn': false,
        })
        .eq('id', slotId)
        .eq('user_id', SupabaseService.userId));
  }

  @override
  Future<void> markReadyToBurn(String slotId) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_slotsTable)
        .update({'ready_to_burn': true})
        .eq('id', slotId)
        .eq('user_id', SupabaseService.userId));
  }

  @override
  Future<void> toggleReadyToBurn(String slotId) async {
    final slots = await fetchSlotsRaw();
    final list = slots.where((s) => s.id == slotId).toList();
    if (list.isEmpty) return;
    final slot = list.first;
    final newValue = !slot.readyToBurn;
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_slotsTable)
        .update({'ready_to_burn': newValue})
        .eq('id', slotId)
        .eq('user_id', SupabaseService.userId));
  }

  @override
  Future<String?> findSlotIdForNode(String nodeId) async {
    final rows = await SupabaseService.executeWithRetry(() =>
        SupabaseService.client
            .from(_slotsTable)
            .select('id')
            .eq('user_id', SupabaseService.userId)
            .eq('node_id', nodeId)
            .limit(1));
    final list = rows as List;
    if (list.isEmpty) return null;
    return list.first['id'] as String;
  }
}
