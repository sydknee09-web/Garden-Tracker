import 'package:flutter/foundation.dart';

import '../models/profile.dart';
import '../supabase_service.dart';

/// Common interface for profile operations (Supabase or Demo).
abstract class ProfileRepositoryInterface {
  Future<void> ensureProfile();
  Future<Profile?> fetchProfile();
  Future<Profile?> ensureAndFetchProfile();
  Future<void> setHasSeenEliasIntro();
  Future<void> updateDisplayName(String name);
}

class ProfileRepository implements ProfileRepositoryInterface {
  static const _table = 'profiles';

  /// Ensures profile row exists (handles trigger lag). Safe to call before fetch.
  @override
  Future<void> ensureProfile() async {
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

  /// Fetches the current user's profile. Call ensureProfile first if profile may not exist.
  @override
  Future<Profile?> fetchProfile() async {
    try {
      final row = await SupabaseService.client
          .from(_table)
          .select()
          .eq('id', SupabaseService.userId)
          .maybeSingle();
      if (row == null) return null;
      // ignore: unnecessary_cast - Supabase returns dynamic
      return Profile.fromJson(row as Map<String, dynamic>);
    } catch (e, st) {
      debugPrint('ProfileRepository.fetchProfile failed: $e');
      debugPrint('$st');
      return null;
    }
  }

  /// Ensures profile exists, then fetches. Returns null on failure.
  @override
  Future<Profile?> ensureAndFetchProfile() async {
    await ensureProfile();
    return fetchProfile();
  }

  /// Sets has_seen_elias_intro to true for the current user.
  @override
  Future<void> setHasSeenEliasIntro() async {
    await SupabaseService.client
        .from(_table)
        .update({'has_seen_elias_intro': true})
        .eq('id', SupabaseService.userId);
  }

  /// Persists display name (used by Elias in intro and later dialogue).
  @override
  Future<void> updateDisplayName(String name) async {
    await SupabaseService.client
        .from(_table)
        .update({'display_name': name})
        .eq('id', SupabaseService.userId);
  }
}
