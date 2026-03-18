import '../models/whetstone_item.dart';
import '../supabase_service.dart';
import '../../core/extensions/datetime_extensions.dart';

class WhetstoneRepository {
  static const _itemsTable = 'whetstone_items';
  static const _completionsTable = 'whetstone_completions';

  /// The 5 starter habits seeded for every new user.
  static const List<String> starterHabits = [
    'Morning Movement',
    'Read 20 Pages',
    'Evening Reflection',
    'Cold Shower',
    'Gratitude — 3 Things',
  ];

  // ── ITEMS ──────────────────────────────────────────────────

  /// Live stream of all active habit items, ordered by display order.
  Stream<List<WhetstoneItem>> watchItems() {
    return SupabaseService.client
        .from(_itemsTable)
        .stream(primaryKey: ['id'])
        .order('order_index')
        .map((rows) => rows
            .map(WhetstoneItem.fromJson)
            .where((item) => item.isActive)
            .toList());
  }

  Future<WhetstoneItem> addItem(String title) async {
    final existing = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_itemsTable)
        .select('id')
        .eq('user_id', SupabaseService.userId)
        .eq('is_active', true));
    final orderIndex = (existing as List).length;

    final row = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_itemsTable)
        .insert({
          'user_id': SupabaseService.userId,
          'title': title,
          'order_index': orderIndex,
        })
        .select()
        .single());
    return WhetstoneItem.fromJson(row);
  }

  Future<void> updateTitle(String id, String title) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_itemsTable)
        .update({'title': title})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> deleteItem(String id) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_itemsTable)
        .update({'is_active': false})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> reorder(List<String> orderedIds) async {
    final updates = orderedIds.asMap().entries.map((e) => {
      'id': e.value,
      'user_id': SupabaseService.userId,
      'order_index': e.key,
    }).toList();
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_itemsTable)
        .upsert(updates, onConflict: 'id'));
  }

  /// Seeds 5 starter habits for a new user. Called once after signup.
  Future<void> seedStarterHabits() async {
    final userId = SupabaseService.userId;
    final inserts = starterHabits.asMap().entries.map((e) => {
      'user_id': userId,
      'title': e.value,
      'order_index': e.key,
    }).toList();
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_itemsTable)
        .insert(inserts));
  }

  // ── COMPLETIONS ────────────────────────────────────────────

  /// Fetch all completion item IDs for a given local date string (YYYY-MM-DD).
  Future<Set<String>> fetchCompletedItemIds(String dateString) async {
    final rows = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_completionsTable)
        .select('item_id')
        .eq('user_id', SupabaseService.userId)
        .eq('completed_date', dateString));
    return (rows as List).map((r) => r['item_id'] as String).toSet();
  }

  /// Marks an item complete for a given date. Uses upsert — safe to call repeatedly.
  Future<void> markComplete({
    required String itemId,
    required DateTime localDate,
  }) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_completionsTable)
        .upsert({
          'user_id': SupabaseService.userId,
          'item_id': itemId,
          'completed_date': localDate.toDateString(),
          'completed_at': DateTime.now().toIso8601String(),
        }, onConflict: 'user_id,item_id,completed_date'));
  }

  /// Removes the completion for an item on a given date (uncheck).
  Future<void> markIncomplete({
    required String itemId,
    required DateTime localDate,
  }) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_completionsTable)
        .delete()
        .eq('user_id', SupabaseService.userId)
        .eq('item_id', itemId)
        .eq('completed_date', localDate.toDateString()));
  }

  /// Toggles completion. Returns the new checked state.
  Future<bool> toggle({
    required String itemId,
    required DateTime localDate,
    required bool currentlyComplete,
  }) async {
    if (currentlyComplete) {
      await markIncomplete(itemId: itemId, localDate: localDate);
      return false;
    } else {
      await markComplete(itemId: itemId, localDate: localDate);
      return true;
    }
  }

  /// Fetches all completion timestamps for streak computation.
  Future<List<DateTime>> fetchAllCompletionTimestamps() async {
    final rows = await SupabaseService.executeWithRetryAndCache(
      () => SupabaseService.client
          .from(_completionsTable)
          .select('completed_at')
          .eq('user_id', SupabaseService.userId)
          .then((r) => r as List),
      'whetstone_completions',
    );
    return rows
        .map((r) => DateTime.parse(r['completed_at'] as String).toLocal())
        .toList();
  }
}
