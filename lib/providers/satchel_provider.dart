import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/satchel_slot.dart';
import '../data/repositories/node_repository.dart';
import '../data/repositories/satchel_repository.dart';
import 'active_pebbles_provider.dart';
import 'repository_providers.dart';

// ── State ────────────────────────────────────────────────────

class SatchelState {
  const SatchelState({
    required this.slots,
    this.isLoading = false,
    this.errorMessage,
    this.isBurnInProgress = false,
  });

  /// Always exactly 6 slots. Empty slots have node == null.
  final List<SatchelSlot> slots;
  final bool isLoading;
  final String? errorMessage;
  final bool isBurnInProgress;

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
    bool? isBurnInProgress,
  }) =>
      SatchelState(
        slots: slots ?? this.slots,
        isLoading: isLoading ?? this.isLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        isBurnInProgress: isBurnInProgress ?? this.isBurnInProgress,
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
    required Ref ref,
  })  : _satchelRepo = satchelRepo,
        _nodeRepo = nodeRepo,
        _ref = ref,
        super(SatchelState.empty()) {
    _load();
  }

  final SatchelRepository _satchelRepo;
  final NodeRepository _nodeRepo;
  final Ref _ref;

  Future<void> _load() async {
    try {
      state = state.copyWith(isLoading: true, clearError: true);
      var slots = await _satchelRepo.fetchSlotsWithNodes();
      if (slots.isEmpty) {
        await _satchelRepo.seedEmptySlots();
        slots = await _satchelRepo.fetchSlotsWithNodes();
      }
      final ordered = List<SatchelSlot>.from(slots)
        ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
      state = state.copyWith(slots: ordered, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  /// Pack Satchel — fetch packable candidates (leaf-only, layout/sequential gated) and fill empty slots.
  Future<String> packSatchel() async {
    await _load();
    if (state.isFull) return 'Your satchel is full.';

    try {
      state = state.copyWith(isLoading: true, clearError: true);

      final emptySlots = state.slots.where((s) => s.isEmpty).toList()
        ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
      final remaining = emptySlots.length;

      final candidates = await _satchelRepo.fetchPackCandidates(limit: remaining);
      if (candidates.isEmpty) {
        state = state.copyWith(isLoading: false);
        return 'No tasks waiting on your mountains.';
      }

      await _satchelRepo.packSlots(candidates);

      _ref.invalidate(packCandidatesProvider);
      await _load();

      final totalPacked = candidates.length;
      return 'Satchel packed. $totalPacked stone${totalPacked == 1 ? '' : 's'} loaded.';
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return 'Could not pack satchel.';
    }
  }

  Future<bool> _performPostBurnCleanup(String freedSlotId) async {
    final slots = await _satchelRepo.fetchSlotsRaw();
    final packedIds = slots
        .where((s) => s.nodeId != null && s.nodeId!.trim().isNotEmpty)
        .map((s) => s.nodeId!)
        .toSet();
    final candidates = await _satchelRepo.fetchPackCandidates(
      limit: 1,
      excludeIds: packedIds.isEmpty ? null : packedIds,
    );
    if (candidates.isEmpty) return false;
    final emptySlots = slots.where((s) => s.isEmpty).toList()
      ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
    if (emptySlots.isEmpty) return false;
    await _satchelRepo.assignPebbleToSlot(
      candidates.first.id,
      emptySlots.first.id,
    );
    _ref.invalidate(packCandidatesProvider);
    return true;
  }

  /// Burn a stone from the Hearth. Auto-drains activePebbles into freed slot when non-empty.
  Future<String?> burnStone(String nodeId) async {
    try {
      state = state.copyWith(isBurnInProgress: true);
      final slot = state.slots.firstWhere(
        (s) => s.nodeId == nodeId,
        orElse: () => throw StateError('Node $nodeId not found in satchel.'),
      );
      if (!slot.readyToBurn) return null;

      final node = slot.node;
      if (node == null) return null;

      final mountainId = node.mountainId;

      await _nodeRepo.burnNode(nodeId);
      await _satchelRepo.clearSlot(slot.id);

      final didDrain = await _performPostBurnCleanup(slot.id);

      if (!didDrain) {
        final updatedSlots = state.slots.map((s) =>
            s.id == slot.id ? s.copyWith(clearNode: true) : s).toList();
        state = state.copyWith(slots: updatedSlots);
      }
      await _load();
      return mountainId;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return null;
    } finally {
      state = state.copyWith(isBurnInProgress: false);
    }
  }

  /// Move a pebble from activePebbles into the first empty slot.
  Future<void> movePebbleToReady(String nodeId) async {
    final slots = await _satchelRepo.fetchSlotsRaw();
    final emptySlots = slots.where((s) => s.isEmpty).toList()
      ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
    if (emptySlots.isEmpty) return;
    await _satchelRepo.assignPebbleToSlot(nodeId, emptySlots.first.id);
    _ref.invalidate(packCandidatesProvider);
    await _load();
  }

  /// Mark a slot as ready to burn (user checked it off in the Satchel).
  Future<void> markReadyToBurn(String slotId) async {
    await _satchelRepo.markReadyToBurn(slotId);
    final updatedSlots = state.slots.map((s) {
      if (s.id == slotId) return s.copyWith(readyToBurn: true);
      return s;
    }).toList();
    state = state.copyWith(slots: updatedSlots);
  }

  /// Toggle ready-to-burn: if ready, lock; if locked, mark done.
  Future<void> toggleReadyToBurn(String slotId) async {
    await _satchelRepo.toggleReadyToBurn(slotId);
    final updatedSlots = state.slots.map((s) {
      if (s.id == slotId) return s.copyWith(readyToBurn: !s.readyToBurn);
      return s;
    }).toList();
    state = state.copyWith(slots: updatedSlots);
  }

  /// Remove task from satchel (clear slot without completing). Task returns to the mountain.
  /// Atomic: capture nodeId, clearSlot, setIsPendingRitual(nodeId, false), invalidate, _load.
  Future<void> removeFromSatchel(String slotId) async {
    String? nodeId;
    for (final s in state.slots) {
      if (s.id == slotId) {
        nodeId = s.nodeId;
        break;
      }
    }

    await _satchelRepo.clearSlot(slotId);
    if (nodeId != null && nodeId.trim().isNotEmpty) {
      await _nodeRepo.setIsPendingRitual(nodeId, value: false);
    }
    _ref.invalidate(packCandidatesProvider);
    await _load();
  }

  /// Reload from database (e.g. after app resume).
  Future<void> refresh() => _load();
}

// ── Provider ─────────────────────────────────────────────────

final satchelProvider =
    StateNotifierProvider<SatchelNotifier, SatchelState>((ref) {
  return SatchelNotifier(
    satchelRepo: ref.watch(satchelRepositoryProvider),
    nodeRepo: ref.watch(nodeRepositoryProvider),
    ref: ref,
  );
});
