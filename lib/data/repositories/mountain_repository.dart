import 'package:flutter/foundation.dart';

import '../models/mountain.dart';
import '../supabase_service.dart';

class MountainRepository {
  static const _table = 'mountains';

  /// Maximum active (non-archived) mountains per user.
  static const int maxActive = 3;

  /// Live stream of all active mountains for the current user, ordered by display index.
  /// Fetches initial data first (guarantees list loads even if Realtime is not configured),
  /// then listens to realtime changes. On initial fetch failure, yields cached or empty.
  Stream<List<Mountain>> watchActive() async* {
    List<Mountain> initial;
    try {
      final rows = await SupabaseService.executeWithRetryAndCache(
        () => SupabaseService.client
            .from(_table)
            .select()
            .eq('user_id', SupabaseService.userId)
            .order('order_index')
            .then((r) => r as List),
        'mountains',
      );
      initial = _parseActive(rows);
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
      final rows = await SupabaseService.executeWithRetryAndCache(
        () => SupabaseService.client
            .from(_table)
            .select()
            .eq('user_id', SupabaseService.userId)
            .eq('is_archived', true)
            .order('created_at', ascending: false)
            .then((r) => r as List),
        'mountains_archived',
      );
      initial = _parseArchived(rows);
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

  /// Fetch a single mountain by ID. Returns null if not found.
  Future<Mountain?> getById(String id) async {
    try {
      final row = await SupabaseService.client
          .from(_table)
          .select()
          .eq('id', id)
          .eq('user_id', SupabaseService.userId)
          .maybeSingle();
      if (row == null) return null;
      return Mountain.fromJson(Map<String, dynamic>.from(row));
    } catch (e, st) {
      debugPrint('MountainRepository.getById failed: $e');
      debugPrint('$st');
      return null;
    }
  }

  /// Count of currently active mountains. Used to enforce the cap of 3.
  Future<int> countActive() async {
    final result = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .select('id')
        .eq('user_id', SupabaseService.userId)
        .eq('is_archived', false));
    return (result as List).length;
  }

  /// Create a new mountain. Throws if the user already has [maxActive] active mountains.
  Future<Mountain> create({
    required String name,
    String? intentStatement,
    String layoutType = 'climb',
    String appearanceStyle = 'slate',
  }) async {
    try {
      await _ensureProfile();
    } catch (e, st) {
      debugPrint('MountainRepository.create: ensure_profile failed (non-blocking): $e');
      debugPrint(st.toString());
    }
    final count = await countActive();
    if (count >= maxActive) {
      throw StateError(
        'You are climbing $maxActive mountains. Chronicle one peak before opening a new path.',
      );
    }

    final data = <String, dynamic>{
      'user_id': SupabaseService.userId,
      'name': name,
      'order_index': count,
      'layout_type': layoutType,
      'appearance_style': appearanceStyle,
    };
    if (intentStatement != null && intentStatement.isNotEmpty) {
      data['intent_statement'] = intentStatement;
    }

    final row = await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .insert(data)
        .select()
        .single());
    return Mountain.fromJson(row);
  }

  /// Update intent_statement, layout_type, and/or appearance_style (Bones view).
  Future<void> updateBlueprint({
    required String id,
    String? intentStatement,
    String? layoutType,
    String? appearanceStyle,
  }) async {
    final updates = <String, dynamic>{'updated_at': DateTime.now().toIso8601String()};
    if (intentStatement != null) updates['intent_statement'] = intentStatement;
    if (layoutType != null) updates['layout_type'] = layoutType;
    if (appearanceStyle != null) updates['appearance_style'] = appearanceStyle;
    if (updates.length <= 1) return;

    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update(updates)
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> rename({required String id, required String name}) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({'name': name, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> archive(String id) async {
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({'is_archived': true, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  Future<void> restore(String id) async {
    final count = await countActive();
    if (count >= maxActive) {
      throw StateError(
        'You are already climbing $maxActive mountains. Chronicle one peak before restoring another.',
      );
    }
    await SupabaseService.executeWithRetry(() => SupabaseService.client
        .from(_table)
        .update({'is_archived': false, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', SupabaseService.userId));
  }

  /// Count of incomplete leaves for a mountain. Leaf-only; accurate for haptic feedback.
  /// RPC safety: returns 0 if get_peak_progress is unavailable (migration not applied).
  Future<int> countIncompleteLeaves(String mountainId) async {
    try {
      final rows = await SupabaseService.executeWithRetry(() =>
          SupabaseService.client.rpc(
            'get_peak_progress',
            params: {'p_mountain_id': mountainId},
          ));
      final list = rows as List;
      if (list.isEmpty) return 0;
      final row = list.first as Map<String, dynamic>;
      final total = (row['total_leaves'] as num?)?.toInt() ?? 0;
      final completed = (row['completed_leaves'] as num?)?.toInt() ?? 0;
      return total - completed;
    } catch (e, st) {
      debugPrint('MountainRepository.countIncompleteLeaves failed: $e');
      debugPrint('$st');
      return 0;
    }
  }

  /// Progress for a single mountain: (completed_leaves / total_leaves). Leaf-only.
  /// RPC safety: returns 0.0 if get_peak_progress is unavailable (migration not applied).
  Future<double> getProgress(String mountainId) async {
    try {
      final rows = await SupabaseService.executeWithRetryAndCache(
        () => SupabaseService.client.rpc(
          'get_peak_progress',
          params: {'p_mountain_id': mountainId},
        ),
        'progress_$mountainId',
      );
      if (rows.isEmpty) return 0.0;
      final row = rows.first as Map<String, dynamic>;
      final total = (row['total_leaves'] as num?)?.toInt() ?? 0;
      final completed = (row['completed_leaves'] as num?)?.toInt() ?? 0;
      if (total == 0) return 0.0;
      return completed / total;
    } catch (e, st) {
      debugPrint('MountainRepository.getProgress failed: $e');
      debugPrint('$st');
      return 0.0;
    }
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
