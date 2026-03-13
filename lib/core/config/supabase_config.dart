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
