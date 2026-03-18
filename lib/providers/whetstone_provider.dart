import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/enums/day_offset.dart';
import '../data/models/whetstone_item.dart';
import '../data/repositories/whetstone_repository.dart';
import 'repository_providers.dart';

// ── State ────────────────────────────────────────────────────

class WhetstoneState {
  const WhetstoneState({
    required this.selectedOffset,
    required this.items,
    required this.completedItemIds,
    this.isLoading = false,
    this.errorMessage,
  });

  final DayOffset selectedOffset;
  final List<WhetstoneItem> items;

  /// IDs of items checked off for the currently selected date.
  final Set<String> completedItemIds;
  final bool isLoading;
  final String? errorMessage;

  bool isComplete(String itemId) => completedItemIds.contains(itemId);

  WhetstoneState copyWith({
    DayOffset? selectedOffset,
    List<WhetstoneItem>? items,
    Set<String>? completedItemIds,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) =>
      WhetstoneState(
        selectedOffset: selectedOffset ?? this.selectedOffset,
        items: items ?? this.items,
        completedItemIds: completedItemIds ?? this.completedItemIds,
        isLoading: isLoading ?? this.isLoading,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      );

  static WhetstoneState initial() => const WhetstoneState(
        selectedOffset: DayOffset.today,
        items: [],
        completedItemIds: {},
      );
}

// ── Notifier ─────────────────────────────────────────────────

class WhetstoneNotifier extends StateNotifier<WhetstoneState> {
  WhetstoneNotifier(this._repo) : super(WhetstoneState.initial()) {
    _itemSubscription = _repo.watchItems().listen(_onItemsUpdated);
    _loadCompletions(DayOffset.today);
    _scheduleMidnightRefresh();
  }

  final WhetstoneRepository _repo;
  StreamSubscription<List<WhetstoneItem>>? _itemSubscription;
  Timer? _midnightTimer;

  // ── Public actions ───────────────────────────────────────

  /// Switch the slider to a different day. Reloads completions for that date.
  Future<void> selectDay(DayOffset offset) async {
    if (state.selectedOffset == offset) return;
    state = state.copyWith(selectedOffset: offset, isLoading: true);
    await _loadCompletions(offset);
  }

  /// Toggle a habit item's completion for the selected date.
  Future<void> toggleItem(String itemId) async {
    final wasComplete = state.isComplete(itemId);
    // Optimistic update — flip locally first
    final updated = Set<String>.from(state.completedItemIds);
    if (wasComplete) {
      updated.remove(itemId);
    } else {
      updated.add(itemId);
    }
    state = state.copyWith(completedItemIds: updated);

    try {
      await _repo.toggle(
        itemId: itemId,
        localDate: _dateForOffset(state.selectedOffset),
        currentlyComplete: wasComplete,
      );
    } catch (e) {
      // Revert on failure
      final reverted = Set<String>.from(state.completedItemIds);
      if (wasComplete) {
        reverted.add(itemId);
      } else {
        reverted.remove(itemId);
      }
      state = state.copyWith(completedItemIds: reverted, errorMessage: e.toString());
    }
  }

  Future<void> addItem(String title) async {
    try {
      final item = await _repo.addItem(title);
      state = state.copyWith(items: [...state.items, item], clearError: true);
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      rethrow;
    }
  }

  Future<void> reorderItems(List<String> orderedIds) async {
    await _repo.reorder(orderedIds);
    // Stream will update items automatically
  }

  Future<void> deleteItem(String id) async {
    await _repo.deleteItem(id);
    // Stream will remove the item automatically
  }

  /// Called when the app returns to foreground — checks for date change.
  void onAppResume() {
    _scheduleMidnightRefresh();
    // If we were on Today and the date has changed, refresh completions
    if (state.selectedOffset == DayOffset.today) {
      _loadCompletions(DayOffset.today);
    }
  }

  // ── Midnight detection ───────────────────────────────────

  /// Schedules a timer that fires just after midnight local time.
  /// If the Whetstone is on "Today", it refreshes to show a blank slate.
  void _scheduleMidnightRefresh() {
    _midnightTimer?.cancel();
    final now = DateTime.now();
    final midnight = DateTime(now.year, now.month, now.day + 1);
    final untilMidnight = midnight.difference(now) + const Duration(seconds: 2);

    _midnightTimer = Timer(untilMidnight, () {
      if (state.selectedOffset == DayOffset.today) {
        _loadCompletions(DayOffset.today);
      }
      _scheduleMidnightRefresh(); // reschedule for next midnight
    });
  }

  // ── Private helpers ──────────────────────────────────────

  void _onItemsUpdated(List<WhetstoneItem> items) {
    // Avoid a delayed initial stream emission overwriting an optimistic add.
    if (items.isEmpty && state.items.isNotEmpty) return;
    state = state.copyWith(items: items);
  }

  Future<void> _loadCompletions(DayOffset offset) async {
    try {
      final date = _dateForOffset(offset);
      final dateString = date.toIso8601String().split('T').first;
      final completedIds = await _repo.fetchCompletedItemIds(dateString);
      state = state.copyWith(
        completedItemIds: completedIds,
        isLoading: false,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  DateTime _dateForOffset(DayOffset offset) {
    final now = DateTime.now();
    switch (offset) {
      case DayOffset.yesterday: return DateTime(now.year, now.month, now.day - 1);
      case DayOffset.today:     return DateTime(now.year, now.month, now.day);
      case DayOffset.tomorrow:  return DateTime(now.year, now.month, now.day + 1);
    }
  }

  @override
  void dispose() {
    _itemSubscription?.cancel();
    _midnightTimer?.cancel();
    super.dispose();
  }
}

// ── Provider ─────────────────────────────────────────────────

final whetstoneProvider =
    StateNotifierProvider<WhetstoneNotifier, WhetstoneState>((ref) {
  return WhetstoneNotifier(ref.watch(whetstoneRepositoryProvider));
});

/// True when user has completed at least one habit today (for Satchel Whetstone spark).
final hasCompletedAnyHabitTodayProvider = Provider<bool>((ref) {
  final state = ref.watch(whetstoneProvider);
  if (state.selectedOffset != DayOffset.today) return true;
  return state.completedItemIds.isNotEmpty;
});
