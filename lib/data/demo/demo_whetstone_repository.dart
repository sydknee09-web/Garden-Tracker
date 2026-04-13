import 'dart:async';

import '../models/whetstone_item.dart';
import '../repositories/whetstone_repository.dart';
import '../../core/services/streak_service.dart';
import '../../core/extensions/datetime_extensions.dart';
import 'demo_storage.dart';

/// Demo implementation of WhetstoneRepository using local storage.
class DemoWhetstoneRepository implements WhetstoneRepository {
  final DemoStorage _storage = DemoStorage.instance;

  @override
  DateTime get sanctuaryEffectiveDate {
    final now = DateTime.now();
    if (now.hour < 4) {
      return now.subtract(const Duration(days: 1));
    }
    return now;
  }

  @override
  Stream<List<WhetstoneItem>> watchItems() async* {
    var items = List<WhetstoneItem>.from(_storage.whetstoneItems);
    items.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
    yield items;
    await for (final _ in _storage.onChange) {
      items = List<WhetstoneItem>.from(_storage.whetstoneItems);
      items.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
      yield items;
    }
  }

  @override
  Future<WhetstoneItem> addItem(String title) async {
    final orderIndex = _storage.whetstoneItems.length;
    final item = WhetstoneItem(
      id: 'wh-${DateTime.now().millisecondsSinceEpoch}',
      userId: DemoStorage.demoUserId,
      title: title,
      orderIndex: orderIndex,
      isActive: true,
      createdAt: DateTime.now(),
    );
    await _storage.addWhetstoneItem(item);
    return item;
  }

  @override
  Future<void> updateTitle(String id, String title) async {
    await _storage.updateWhetstoneItem(id, title: title);
  }

  @override
  Future<void> deleteItem(String id) async {
    await _storage.updateWhetstoneItem(id, isActive: false);
  }

  @override
  Future<void> reorder(List<String> orderedIds) async {
    await _storage.reorderWhetstoneItems(orderedIds);
  }

  @override
  Future<void> seedStarterHabits() async {
    if (_storage.whetstoneItems.isNotEmpty) return;
    for (var i = 0; i < WhetstoneRepository.starterHabits.length; i++) {
      final item = WhetstoneItem(
        id: 'wh-$i',
        userId: DemoStorage.demoUserId,
        title: WhetstoneRepository.starterHabits[i],
        orderIndex: i,
        isActive: true,
        createdAt: DateTime.now(),
      );
      await _storage.addWhetstoneItem(item);
    }
  }

  @override
  Future<Set<String>> fetchCompletedItemIds(String dateString) async =>
      _storage.completedItemIdsForDate(dateString);

  @override
  Future<void> markComplete({
    required String itemId,
    required DateTime localDate,
  }) async {
    await _storage.addCompletion(
      itemId,
      localDate.toDateString(),
      DateTime.now().toIso8601String(),
    );
  }

  @override
  Future<void> markIncomplete({
    required String itemId,
    required DateTime localDate,
  }) async {
    await _storage.removeCompletion(itemId, localDate.toDateString());
  }

  @override
  Future<bool> toggle({
    required String itemId,
    required DateTime localDate,
    required bool currentlyComplete,
  }) async {
    final dateString = localDate.toDateString();
    if (currentlyComplete) {
      await _storage.removeCompletion(itemId, dateString);
      return false;
    } else {
      await _storage.addCompletion(
        itemId,
        dateString,
        DateTime.now().toIso8601String(),
      );
      return true;
    }
  }

  @override
  Future<List<DateTime>> fetchAllCompletionTimestamps() async =>
      _storage.whetstoneCompletionTimestamps;

  @override
  Future<WhetstoneStreakStatus> fetchStreakStatus() async {
    final result = computeStreak(_storage.whetstoneCompletionTimestamps);
    return WhetstoneStreakStatus(
      streak: result.currentStreak,
      graceActive: result.graceUsed,
    );
  }
}
