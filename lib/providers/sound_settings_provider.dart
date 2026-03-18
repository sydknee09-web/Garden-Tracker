import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _keySoundEnabled = 'sound_enabled';

/// Whether sound effects are enabled. Persists to SharedPreferences.
/// Default true. Loads from storage on first access.
final soundEnabledProvider =
    StateNotifierProvider<SoundSettingsNotifier, bool>((ref) {
  final notifier = SoundSettingsNotifier();
  Future.microtask(() => notifier._load());
  return notifier;
});

class SoundSettingsNotifier extends StateNotifier<bool> {
  SoundSettingsNotifier() : super(true);

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = prefs.getBool(_keySoundEnabled) ?? true;
  }

  Future<void> setEnabled(bool enabled) async {
    if (state == enabled) return;
    state = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keySoundEnabled, enabled);
  }
}
