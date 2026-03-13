import '../models/mountain.dart';
import '../supabase_service.dart';

class MountainRepository {
  static const _table = 'mountains';

  /// Maximum active (non-archived) mountains per user.
  static const int maxActive = 3;

  /// Live stream of all active mountains for the current user, ordered by display index.
  /// Fetches initial data first (guarantees list loads even if Realtime is not configured),
  /// then listens to realtime changes. On initial fetch failure, yields empty so Scroll still renders.
  Stream<List<Mountain>> watchActive() async* {
    List<Mountain> initial;
    try {
      final rows = await SupabaseService.client
          .from(_table)
          .select()
          .eq('user_id', SupabaseService.userId)
          .order('order_index');
      initial = _parseActive(rows as List);
    } catch (_) {
      initial = [];
    }
    yield initial;

    try {
      await for (final rows in SupabaseService.client
          .from(_table)
          .stream(primaryKey: ['id'])
          .eq('user_id', SupabaseService.userId)
          .order('order_index')) {
        yield _parseActive(rows as List);
      }
    } catch (_) {
      // Realtime unavailable — UI keeps the last snapshot; user can retry.
    }
  }

  Stream<List<Mountain>> watchArchived() async* {
    List<Mountain> initial;
    try {
      final rows = await SupabaseService.client
          .from(_table)
          .select()
          .eq('user_id', SupabaseService.userId)
          .eq('is_archived', true)
          .order('created_at', ascending: false);
      initial = _parseArchived(rows as List);
    } catch (_) {
      initial = [];
    }
    yield initial;

    try {
      await for (final rows in SupabaseService.client
          .from(_table)
          .stream(primaryKey: ['id'])
          .eq('user_id', SupabaseService.userId)
          .order('created_at', ascending: false)) {
        yield _parseArchived(rows as List);
      }
    } catch (_) {
      // Realtime unavailable — UI keeps the last snapshot; user can retry.
    }
  }

  List<Mountain> _parseActive(List<dynamic> rows) =>
      rows.map((r) => Mountain.fromJson(r as Map<String, dynamic>)).where((m) => !m.isArchived).toList();

  List<Mountain> _parseArchived(List<dynamic> rows) =>
      rows.map((r) => Mountain.fromJson(r as Map<String, dynamic>)).where((m) => m.isArchived).toList();

  /// Count of currently active mountains. Used to enforce the cap of 3.
  Future<int> countActive() async {
    final result = await SupabaseService.client
        .from(_table)
        .select('id')
        .eq('user_id', SupabaseService.userId)
        .eq('is_archived', false);
    return (result as List).length;
  }

  /// Create a new mountain. Throws if the user already has [maxActive] active mountains.
  Future<Mountain> create({required String name}) async {
    await _ensureProfile();
    final count = await countActive();
    if (count >= maxActive) {
      throw StateError(
        'You are climbing $maxActive mountains. Archive one before opening a new path.',
      );
    }

    final row = await SupabaseService.client
        .from(_table)
        .insert({
          'user_id': SupabaseService.userId,
          'name': name,
          'order_index': count,
        })
        .select()
        .single();
    return Mountain.fromJson(row);
  }

  Future<void> rename({required String id, required String name}) async {
    await SupabaseService.client
        .from(_table)
        .update({'name': name, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  Future<void> archive(String id) async {
    await SupabaseService.client
        .from(_table)
        .update({'is_archived': true, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  Future<void> restore(String id) async {
    final count = await countActive();
    if (count >= maxActive) {
      throw StateError(
        'You are already climbing $maxActive mountains. Archive one before restoring another.',
      );
    }
    await SupabaseService.client
        .from(_table)
        .update({'is_archived': false, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId);
  }

  /// Progress for a single mountain: (burned pebbles / total pebbles).
  /// Returns 0.0 if no pebbles exist.
  Future<double> getProgress(String mountainId) async {
    final rows = await SupabaseService.client
        .from('nodes')
        .select('is_complete')
        .eq('user_id', SupabaseService.userId)
        .eq('mountain_id', mountainId)
        .eq('node_type', 'pebble');

    final list = rows as List;
    if (list.isEmpty) return 0.0;
    final complete = list.where((r) => r['is_complete'] == true).length;
    return complete / list.length;
  }

  /// Ensures the current user has a profile row (fixes users who signed up before schema).
  /// If the function is missing in Supabase (PGRST202), we skip so the app doesn't crash.
  Future<void> _ensureProfile() async {
    try {
      await SupabaseService.client.rpc('ensure_profile');
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('PGRST202') || msg.contains('ensure_profile')) {
        return;
      }
      rethrow;
    }
  }
}
