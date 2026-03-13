import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/satchel_slot.dart';
import '../data/repositories/node_repository.dart';
import '../data/repositories/satchel_repository.dart';

// ── State ────────────────────────────────────────────────────

class SatchelState {
  const SatchelState({
    required this.slots,
    this.isLoading = false,
    this.errorMessage,
  });

  /// Always exactly 6 slots. Empty slots have node == null.
  final List<SatchelSlot> slots;
  final bool isLoading;
  final String? errorMessage;

  int get emptySlotCount => slots.where((s) => s.isEmpty).length;
  int get filledSlotCount => slots.where((s) => s.isFilled).length;
  /// Full only when we have 6 slots AND all are filled. Empty slots = not full.
  bool get isFull => slots.length >= 6 && emptySlotCount == 0;
  bool get isEmpty => filledSlotCount == 0;

  SatchelState copyWith({
    List<SatchelSlot>? slots,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) =>
      SatchelState(
        slots: slots ?? this.slots,
        isLoading: isLoading ?? this.isLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );

  static SatchelState empty() => SatchelState(
        slots: List.generate(
          6,
          (i) => SatchelSlot(
            id: 'empty-${i + 1}',
            userId: '',
            slotIndex: i + 1,
            packedAt: DateTime.now(),
          ),
        ),
      );
}

// ── Notifier ─────────────────────────────────────────────────

class SatchelNotifier extends StateNotifier<SatchelState> {
  SatchelNotifier({
    required SatchelRepository satchelRepo,
    required NodeRepository nodeRepo,
  })  : _satchelRepo = satchelRepo,
        _nodeRepo = nodeRepo,
        super(SatchelState.empty()) {
    _load();
  }

  final SatchelRepository _satchelRepo;
  final NodeRepository _nodeRepo;

  Future<void> _load() async {
    try {
      state = state.copyWith(isLoading: true, clearError: true);
      var slots = await _satchelRepo.fetchSlotsWithNodes();
      // New users have no slots — seed 6 empty ones
      if (slots.isEmpty) {
        await _satchelRepo.seedEmptySlots();
        slots = await _satchelRepo.fetchSlotsWithNodes();
      }
      // Ensure we always have exactly 6 slots in index order
      final ordered = List<SatchelSlot>.from(slots)
        ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
      state = state.copyWith(slots: ordered, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  /// Pack Satchel — fills empty slots with priority-ordered pebbles.
  /// Returns a message suitable for a toast/snackbar.
  Future<String> packSatchel() async {
    // Refresh from DB first so we use latest slot state (avoids stale "full" when slots were cleared)
    await _load();
    if (state.isFull) return 'Your satchel is full.';

    try {
      state = state.copyWith(isLoading: true, clearError: true);
      final emptyCount = state.emptySlotCount;
      final candidates = await _satchelRepo.fetchPackCandidates(limit: emptyCount);

      if (candidates.isEmpty) {
        state = state.copyWith(isLoading: false);
        return 'No tasks waiting on your mountains.';
      }

      await _satchelRepo.packSlots(candidates);
      await _load();
      return 'Satchel packed. ${candidates.length} stone${candidates.length == 1 ? '' : 's'} loaded.';
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return 'Could not pack satchel.';
    }
  }

  /// Burn a stone from the Hearth.
  /// Marks the node complete and clears the slot. NO auto-refill.
  /// Returns the mountainId so the caller can invalidate progress.
  Future<String?> burnStone(String nodeId) async {
    try {
      // Find which slot holds this node
      final slot = state.slots.firstWhere(
        (s) => s.nodeId == nodeId,
        orElse: () => throw StateError('Node $nodeId not found in satchel.'),
      );

      // Guard: slot must be checked off before it can burn
      if (!slot.readyToBurn) return null;

      // Get the node's LTREE path before burning (needed to delete child shards)
      final node = slot.node;
      if (node == null) return null;

      final mountainId = node.mountainId;

      // 1. Mark complete + delete shards
      await _nodeRepo.burnPebble(nodeId, pebblePath: node.path);

      // 2. Clear the slot — stays empty, no auto-refill
      await _satchelRepo.clearSlot(slot.id);

      // 3. Update local state immediately (optimistic) then sync from DB
      final updatedSlots = state.slots.map((s) {
        if (s.id == slot.id) return s.copyWith(clearNode: true);
        return s;
      }).toList();
      state = state.copyWith(slots: updatedSlots);
      await _load();

      return mountainId;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return null;
    }
  }

  /// Mark a slot as ready to burn (user checked it off in the Satchel).
  /// Only ready slots become draggable stones in the Sanctuary.
  Future<void> markReadyToBurn(String slotId) async {
    await _satchelRepo.markReadyToBurn(slotId);
    final updatedSlots = state.slots.map((s) {
      if (s.id == slotId) return s.copyWith(readyToBurn: true);
      return s;
    }).toList();
    state = state.copyWith(slots: updatedSlots);
  }

  /// Remove task from satchel (clear slot without completing). Task returns to the mountain.
  Future<void> removeFromSatchel(String slotId) async {
    await _satchelRepo.clearSlot(slotId);
    await _load();
  }

  /// Reload from database (e.g. after app resume).
  Future<void> refresh() => _load();
}

// ── Provider ─────────────────────────────────────────────────

final satchelProvider =
    StateNotifierProvider<SatchelNotifier, SatchelState>((ref) {
  return SatchelNotifier(
    satchelRepo: SatchelRepository(),
    nodeRepo: NodeRepository(),
  );
});
