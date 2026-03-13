import '../models/node.dart';
import '../models/satchel_slot.dart';
import '../supabase_service.dart';

class SatchelRepository {
  static const _slotsTable = 'satchel_slots';
  static const _nodesTable = 'nodes';

  /// Fetches slots with their nodes joined (for full metadata display).
  Future<List<SatchelSlot>> fetchSlotsWithNodes() async {
    final rows = await SupabaseService.client
        .from(_slotsTable)
        .select('*, nodes(*)')
        .eq('user_id', SupabaseService.userId)
        .order('slot_index');
    return (rows as List<dynamic>)
        .map((r) => SatchelSlot.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  /// Fetches all slot rows without join. Use for Pack so we always get 6 rows (join can omit rows when node_id is null in some setups).
  Future<List<SatchelSlot>> fetchSlotsRaw() async {
    final rows = await SupabaseService.client
        .from(_slotsTable)
        .select('id, user_id, slot_index, node_id, packed_at, ready_to_burn')
        .eq('user_id', SupabaseService.userId)
        .order('slot_index');
    return (rows as List<dynamic>)
        .map((r) {
          final map = Map<String, dynamic>.from(r as Map<String, dynamic>);
          map['nodes'] = null;
          return SatchelSlot.fromJson(map);
        })
        .toList();
  }

  /// The Pack Satchel query.
  /// Fetches top N incomplete pebbles not already in the satchel,
  /// ordered by: due_date ASC NULLS LAST → is_starred DESC → created_at ASC (FIFO).
  Future<List<Node>> fetchPackCandidates({required int limit}) async {
    // Get IDs currently in the satchel to exclude them
    final slotRows = await SupabaseService.client
        .from(_slotsTable)
        .select('node_id')
        .eq('user_id', SupabaseService.userId)
        .not('node_id', 'is', null);

    final packedIds = (slotRows as List)
        .map((r) => r['node_id'] as String)
        .toSet();

    // Fetch candidates: incomplete pebbles, priority-ordered
    final nodeRows = await SupabaseService.client
        .from(_nodesTable)
        .select()
        .eq('user_id', SupabaseService.userId)
        .eq('node_type', 'pebble')
        .eq('is_complete', false)
        .order('due_date', ascending: true, nullsFirst: false)
        .order('is_starred', ascending: false)
        .order('created_at', ascending: true)
        .limit(limit + packedIds.length); // overfetch to account for exclusions

    final allCandidates = (nodeRows as List<dynamic>)
        .map((r) => Node.fromJson(r as Map<String, dynamic>))
        .toList();
    return allCandidates
        .where((n) => !packedIds.contains(n.id))
        .take(limit)
        .toList();
  }

  /// Seeds 6 empty slots for a new user (called after signup).
  Future<void> seedEmptySlots() async {
    final userId = SupabaseService.userId;
    final inserts = List.generate(
      6,
      (i) => {'user_id': userId, 'slot_index': i + 1, 'node_id': null},
    );
    await SupabaseService.client
        .from(_slotsTable)
        .upsert(inserts, onConflict: 'user_id,slot_index');
  }

  /// Fills the lowest-numbered empty slots first (1, 2, 3, …) with the given nodes.
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
      await SupabaseService.client
          .from(_slotsTable)
          .upsert(updates, onConflict: 'user_id,slot_index');
    }
  }

  /// Clears a slot (sets node_id to null). Called after burning a stone.
  /// The slot stays empty — NO auto-refill. ready_to_burn is also reset.
  Future<void> clearSlot(String slotId) async {
    await SupabaseService.client
        .from(_slotsTable)
        .update({
          'node_id': null,
          'packed_at': DateTime.now().toIso8601String(),
          'ready_to_burn': false,
        })
        .eq('id', slotId)
        .eq('user_id', SupabaseService.userId);
  }

  /// Marks a slot as ready to burn (user checked off in Satchel).
  Future<void> markReadyToBurn(String slotId) async {
    await SupabaseService.client
        .from(_slotsTable)
        .update({'ready_to_burn': true})
        .eq('id', slotId)
        .eq('user_id', SupabaseService.userId);
  }

  /// Finds which slot holds a given node (used after burn to clear it).
  Future<String?> findSlotIdForNode(String nodeId) async {
    final rows = await SupabaseService.client
        .from(_slotsTable)
        .select('id')
        .eq('user_id', SupabaseService.userId)
        .eq('node_id', nodeId)
        .limit(1);
    final list = rows as List;
    if (list.isEmpty) return null;
    return list.first['id'] as String;
  }
}
