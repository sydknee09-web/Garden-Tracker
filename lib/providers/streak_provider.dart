import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/services/streak_prefs.dart';
import '../core/services/streak_service.dart';
import 'repository_providers.dart';
import '../data/repositories/whetstone_repository.dart';

/// Whetstone (habit) streak. Consecutive days with at least one habit completed.
/// Uses 4:00 AM day boundary and Grace Day (Option A: freeze).
final whetstoneStreakProvider = FutureProvider<WhetstoneStreakStatus>((
  ref,
) async {
  final repo = ref.watch(whetstoneRepositoryProvider);
  return repo.fetchStreakStatus();
});

/// Burn streak. Consecutive days with at least one pebble burned.
/// Uses same 4:00 AM boundary and Grace Day logic.
final burnStreakProvider = FutureProvider<StreakResult>((ref) async {
  final repo = ref.watch(nodeRepositoryProvider);
  final timestamps = await repo.fetchBurnTimestamps();
  return computeStreak(timestamps);
});

/// Best burn streak ever recorded locally (updated after burns in [SatchelNotifier]).
final longestBurnStreakProvider = FutureProvider<int>((ref) async {
  ref.watch(burnStreakProvider);
  final prefs = await SharedPreferences.getInstance();
  return prefs.getInt(kLongestBurnStreakPrefsKey) ?? 0;
});
