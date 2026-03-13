import 'package:supabase_flutter/supabase_flutter.dart';

/// Single access point for the Supabase client throughout the app.
/// Use [SupabaseService.client] anywhere you need to query the database.
class SupabaseService {
  SupabaseService._();

  static SupabaseClient get client => Supabase.instance.client;

  static User? get currentUser => client.auth.currentUser;

  /// Convenience: current user's ID. Throws if not authenticated.
  /// Every DB insert/upsert must include user_id: this value.
  static String get userId {
    final id = currentUser?.id;
    if (id == null) throw StateError('No authenticated user. Cannot perform DB operation.');
    return id;
  }
}
