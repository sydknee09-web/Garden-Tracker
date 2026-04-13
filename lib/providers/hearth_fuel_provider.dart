import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'repository_providers.dart';

/// Hearth fuel state: effective fuel units and display level (0–3).
class HearthFuelState {
  const HearthFuelState({required this.effectiveFuel, required this.fireLevel});

  /// floor(pebbles_burned_4h + whetstone_completions_2h * 0.5)
  final int effectiveFuel;

  /// Display level 0–3. min(effectiveFuel, 3).
  final int fireLevel;

  /// True when celebration should trigger (drop event only, checked at burn time).
  bool get shouldCelebrate => effectiveFuel >= 4;
}

/// Computes hearth fuel from pebble burns (4h each) and Whetstone completions (2h each).
/// Recompute on build and app-resume. Invalidate after burnStone.
final hearthFuelProvider = FutureProvider<HearthFuelState>((ref) async {
  final nodeRepo = ref.watch(nodeRepositoryProvider);
  final whetstoneRepo = ref.watch(whetstoneRepositoryProvider);

  final now = DateTime.now();
  const pebbleWindow = Duration(hours: 4);
  const whetstoneWindow = Duration(hours: 2);

  final burnTimestamps = await nodeRepo.fetchBurnTimestamps();
  final whetstoneTimestamps = await whetstoneRepo
      .fetchAllCompletionTimestamps();

  final pebbleCount = burnTimestamps
      .where((t) => now.difference(t) < pebbleWindow)
      .length;
  final whetstoneCount = whetstoneTimestamps
      .where((t) => now.difference(t) < whetstoneWindow)
      .length;

  final effectiveFuel = (pebbleCount + 0.5 * whetstoneCount).floor();
  final fireLevel = min(max(0, effectiveFuel), 3);

  return HearthFuelState(effectiveFuel: effectiveFuel, fireLevel: fireLevel);
});

/// Set to true when 4+ stones dropped in one session (celebration overlay).
final hearthCelebrationProvider = StateProvider<bool>((ref) => false);
