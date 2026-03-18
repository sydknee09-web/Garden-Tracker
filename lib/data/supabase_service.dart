import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/supabase_config.dart';
import '../core/state/data_freshness.dart';
import '../core/utils/retry.dart';
import 'supabase_cache.dart';

/// Single access point for the Supabase client throughout the app.
/// Use [SupabaseService.client] anywhere you need to query the database.
/// Use [executeWithRetry] or [executeWithRetryAndCache] for resilient calls.
class SupabaseService {
  SupabaseService._();

  static SupabaseClient get client => Supabase.instance.client;

  static User? get currentUser => client.auth.currentUser;

  /// Convenience: current user's ID. Throws if not authenticated.
  /// Every DB insert/upsert must include user_id: this value.
  /// When [kSkipAuthForTesting], returns a placeholder to avoid throws (DB calls will still fail).
  static String get userId {
    final id = currentUser?.id;
    if (id != null) return id;
    if (kSkipAuthForTesting) return 'test-bypass-user-id';
    throw StateError('No authenticated user. Cannot perform DB operation.');
  }

  /// Runs [fn] with retry and exponential backoff. Use for Supabase calls that may fail transiently.
  static Future<T> executeWithRetry<T>(Future<T> Function() fn) =>
      retryWithBackoff(fn);

  /// Runs [fn] with retry; on final failure, returns cached data if available.
  /// [resource] identifies the cache key (e.g. 'mountains', 'nodes_mt1').
  static Future<List<dynamic>> executeWithRetryAndCache(
    Future<List<dynamic>> Function() fn,
    String resource,
  ) async {
    final uid = userId;
    try {
      final result = await retryWithBackoff(fn);
      await SupabaseCache.instance.save(uid, resource, result);
      DataFreshness.instance.onFreshFetch();
      return result;
    } catch (e) {
      final cached = await SupabaseCache.instance.loadList(uid, resource);
      if (cached != null) {
        DataFreshness.instance.onCacheHit();
        return cached;
      }
      rethrow;
    }
  }
}
