import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

const _prefix = 'supabase_cache_';

/// Caches last successful Supabase responses for offline fallback.
/// Key format: {userId}_{resource} e.g. "user123_mountains", "user123_nodes_mt1"
class SupabaseCache {
  SupabaseCache._();
  static final SupabaseCache instance = SupabaseCache._();

  String _key(String userId, String resource) => '$_prefix${userId}_$resource';

  /// Saves raw JSON (List or Map) for a resource.
  Future<void> save(String userId, String resource, dynamic data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(userId, resource), jsonEncode(data));
  }

  /// Loads cached JSON. Returns null if missing or invalid.
  Future<List<dynamic>?> loadList(String userId, String resource) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(userId, resource));
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is List ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  /// Clears all cache for a user (e.g. on sign out).
  Future<void> clearForUser(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final userPrefix = '$_prefix${userId}_';
    final keys = prefs.getKeys().where((k) => k.startsWith(userPrefix));
    for (final k in keys) {
      await prefs.remove(k);
    }
  }
}
