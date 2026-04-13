import 'package:flutter_test/flutter_test.dart';
import 'package:voyager_sanctuary/core/enums/day_offset.dart';
import 'package:voyager_sanctuary/data/models/satchel_slot.dart';
import 'package:voyager_sanctuary/providers/satchel_provider.dart';
import 'package:voyager_sanctuary/providers/whetstone_provider.dart';

void main() {
  // ── DayOffset ─────────────────────────────────────────────

  group('DayOffset date resolution', () {
    test('today resolves to current date string', () {
      final today = DateTime.now();
      final expected =
          '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      expect(DayOffset.today.toDateString(), expected);
    });

    test('yesterday is one day before today', () {
      final yesterday = DateTime.now().subtract(const Duration(days: 1));
      final expected =
          '${yesterday.year}-${yesterday.month.toString().padLeft(2, '0')}-${yesterday.day.toString().padLeft(2, '0')}';
      expect(DayOffset.yesterday.toDateString(), expected);
    });

    test('tomorrow is one day after today', () {
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      final expected =
          '${tomorrow.year}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}';
      expect(DayOffset.tomorrow.toDateString(), expected);
    });

    test('labels are correct', () {
      expect(DayOffset.yesterday.label, 'Yesterday');
      expect(DayOffset.today.label, 'Today');
      expect(DayOffset.tomorrow.label, 'Tomorrow');
    });
  });

  // ── SatchelState ──────────────────────────────────────────

  group('SatchelState', () {
    test('empty() creates 6 empty slots', () {
      final state = SatchelState.empty();
      expect(state.slots.length, 6);
      expect(state.emptySlotCount, 6);
      expect(state.filledSlotCount, 0);
    });

    test('isEmpty is true when all slots are empty', () {
      final state = SatchelState.empty();
      expect(state.isEmpty, isTrue);
      expect(state.isFull, isFalse);
    });

    test('slot indices are 1-based (1 through 6)', () {
      final state = SatchelState.empty();
      final indices = state.slots.map((s) => s.slotIndex).toList();
      expect(indices, [1, 2, 3, 4, 5, 6]);
    });

    test('copyWith preserves unchanged fields', () {
      final state = SatchelState.empty();
      final updated = state.copyWith(isLoading: true);
      expect(updated.slots.length, 6);
      expect(updated.isLoading, isTrue);
    });
  });

  // ── WhetstoneState ────────────────────────────────────────

  group('WhetstoneState', () {
    test('initial state is Today with empty items and completions', () {
      final state = WhetstoneState.initial();
      expect(state.selectedOffset, DayOffset.today);
      expect(state.items, isEmpty);
      expect(state.completedItemIds, isEmpty);
      expect(state.isLoading, isFalse);
    });

    test('isComplete returns false for unchecked item', () {
      final state = WhetstoneState.initial();
      expect(state.isComplete('some-id'), isFalse);
    });

    test('isComplete returns true for checked item', () {
      final state = WhetstoneState.initial().copyWith(
        completedItemIds: {'item-1', 'item-2'},
      );
      expect(state.isComplete('item-1'), isTrue);
      expect(state.isComplete('item-2'), isTrue);
      expect(state.isComplete('item-3'), isFalse);
    });

    test('copyWith with clearError removes errorMessage', () {
      final state = WhetstoneState.initial().copyWith(errorMessage: 'oops');
      expect(state.errorMessage, 'oops');
      final cleared = state.copyWith(clearError: true);
      expect(cleared.errorMessage, isNull);
    });

    test('switching DayOffset updates selectedOffset', () {
      final state = WhetstoneState.initial();
      final updated = state.copyWith(selectedOffset: DayOffset.yesterday);
      expect(updated.selectedOffset, DayOffset.yesterday);
    });

    // First Five Test #5: midnight sweep uses current date for Today
    test('Today date string is current calendar day (midnight boundary)', () {
      final now = DateTime.now();
      final todayStr = DayOffset.today.toDateString();
      final parts = todayStr.split('-').map(int.parse).toList();
      expect(parts[0], now.year);
      expect(parts[1], now.month);
      expect(parts[2], now.day);
    });
  });

  // ── Midnight reset (date boundary) ──────────────────────────

  group('Midnight reset — date boundary', () {
    test('yesterday and today date strings differ by one day', () {
      final yesterday = DayOffset.yesterday.toDateString();
      final today = DayOffset.today.toDateString();
      // Parse and verify yesterday + 1 day == today
      final yParts = yesterday.split('-').map(int.parse).toList();
      final yDate = DateTime(yParts[0], yParts[1], yParts[2]);
      final nextDay = yDate.add(const Duration(days: 1));
      final expectedToday =
          '${nextDay.year}-${nextDay.month.toString().padLeft(2, '0')}-${nextDay.day.toString().padLeft(2, '0')}';
      expect(today, expectedToday);
    });

    test('today and tomorrow date strings differ by one day', () {
      final today = DayOffset.today.toDateString();
      final tomorrow = DayOffset.tomorrow.toDateString();
      final tParts = today.split('-').map(int.parse).toList();
      final tDate = DateTime(tParts[0], tParts[1], tParts[2]);
      final nextDay = tDate.add(const Duration(days: 1));
      final expectedTomorrow =
          '${nextDay.year}-${nextDay.month.toString().padLeft(2, '0')}-${nextDay.day.toString().padLeft(2, '0')}';
      expect(tomorrow, expectedTomorrow);
    });
  });

  // ── First Five Test #4: Burned slot stays empty (no auto-refill) ───────

  group('Burned slot stays empty (First Five Test #4)', () {
    test('clearing one slot via copyWith(clearNode: true) leaves slot empty', () {
      final filledSlot = SatchelSlot(
        id: 'slot-1',
        userId: 'user-1',
        slotIndex: 1,
        nodeId: 'node-1',
        node: null,
        packedAt: DateTime(2026, 1, 1),
        readyToBurn: true,
      );
      expect(filledSlot.isFilled, isTrue);
      final cleared = filledSlot.copyWith(clearNode: true);
      expect(cleared.isEmpty, isTrue);
      expect(cleared.nodeId, isNull);
    });

    test('state with one filled slot then cleared has 6 empty slots', () {
      final slots = List.generate(
        6,
        (i) => SatchelSlot(
          id: 'slot-${i + 1}',
          userId: 'u',
          slotIndex: i + 1,
          nodeId: i == 0 ? 'node-1' : null,
          packedAt: DateTime(2026, 1, 1),
        ),
      );
      final stateWithOneFilled = SatchelState(slots: slots);
      expect(stateWithOneFilled.filledSlotCount, 1);
      expect(stateWithOneFilled.emptySlotCount, 5);

      final clearedSlots = stateWithOneFilled.slots.map((s) {
        if (s.slotIndex == 1) return s.copyWith(clearNode: true);
        return s;
      }).toList();
      final stateAfterBurn = stateWithOneFilled.copyWith(slots: clearedSlots);
      expect(stateAfterBurn.filledSlotCount, 0);
      expect(stateAfterBurn.emptySlotCount, 6);
    });
  });
}
