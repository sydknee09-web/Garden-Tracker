import 'package:shared_preferences/shared_preferences.dart';

const _keyDemoMode = 'demo_mode';

/// True when the app is running in demo/offline mode (no Supabase).
/// Set at startup from shared_preferences, or when user taps "Try Demo Mode" on connection error.
bool isDemoMode = false;

/// Load demo mode preference from storage. Call during bootstrap before Supabase init.
Future<bool> loadDemoMode() async {
  final prefs = await SharedPreferences.getInstance();
  isDemoMode = prefs.getBool(_keyDemoMode) ?? false;
  return isDemoMode;
}

/// Persist demo mode and update the in-memory flag.
Future<void> setDemoMode(bool value) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_keyDemoMode, value);
  isDemoMode = value;
}
