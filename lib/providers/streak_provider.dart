import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/services/streak_service.dart';
import 'repository_providers.dart';

/// Whetstone (habit) streak. Consecutive days with at least one habit completed.
/// Uses 4:00 AM day boundary and Grace Day (Option A: freeze).
final whetstoneStreakProvider = FutureProvider<StreakResult>((ref) async {
  final repo = ref.watch(whetstoneRepositoryProvider);
  final timestamps = await repo.fetchAllCompletionTimestamps();
  return computeStreak(timestamps);
});

/// Burn streak. Consecutive days with at least one pebble burned.
/// Uses same 4:00 AM boundary and Grace Day logic.
final burnStreakProvider = FutureProvider<StreakResult>((ref) async {
  final repo = ref.watch(nodeRepositoryProvider);
  final timestamps = await repo.fetchBurnTimestamps();
  return computeStreak(timestamps);
});
