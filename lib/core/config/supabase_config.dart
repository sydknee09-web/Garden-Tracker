import 'package:flutter/foundation.dart' show kDebugMode;

/// When true, bypasses auth gate — app goes straight to Sanctuary for UI testing.
/// Debug builds default to true (avoids SharedPreferences hang on device). Release defaults to false.
const bool kSkipAuthForTesting = bool.fromEnvironment(
  'SKIP_AUTH',
  defaultValue: kDebugMode,
);

/// Supabase project credentials.
/// The anon/publishable key is safe to ship in the client bundle —
/// Row-Level Security policies are the real auth boundary, not this key.
/// The service_role key must NEVER appear in this codebase.
class SupabaseConfig {
  SupabaseConfig._();

  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://ibfkeovmgnvfdnrpvoxg.supabase.co',
  );

  static const String anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'sb_publishable_3kFcOgv-zDSFl5QVCuhUbw_QqmWAh6w',
  );
}
