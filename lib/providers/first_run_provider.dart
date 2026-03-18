import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _keyFirstPack = 'has_seen_first_pack';
const _keyFirstBurn = 'has_seen_first_burn';
const _keyLastStreakMilestone = 'last_streak_milestone_shown';
const _keyQuestStep1 = 'has_seen_quest_step_1';
const _keyQuestStep3 = 'has_seen_quest_step_3';
const _keyScrollTooltip = 'has_seen_scroll_tooltip';

/// Whether the user has seen the first-pack Elias line.
final hasSeenFirstPackProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_keyFirstPack) ?? false;
});

/// Whether the user has seen the first-burn Elias line.
final hasSeenFirstBurnProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_keyFirstBurn) ?? false;
});

/// Mark first-pack line as seen.
Future<void> markFirstPackSeen() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_keyFirstPack, true);
}

/// Mark first-burn line as seen.
Future<void> markFirstBurnSeen() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_keyFirstBurn, true);
}

/// Whether the user has seen Quest Step 1 (empty-state "Look within your bag").
final hasSeenQuestStep1Provider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_keyQuestStep1) ?? false;
});

/// Whether the user has seen Quest Step 3 (Hearth instruction).
final hasSeenQuestStep3Provider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_keyQuestStep3) ?? false;
});

/// Whether the user has seen the Scroll tooltip in Satchel.
final hasSeenScrollTooltipProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(_keyScrollTooltip) ?? false;
});

Future<void> markQuestStep1Seen() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_keyQuestStep1, true);
}

Future<void> markQuestStep3Seen() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_keyQuestStep3, true);
}

Future<void> markScrollTooltipSeen() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_keyScrollTooltip, true);
}

/// Last habit streak milestone shown (7, 30, or 100).
Future<int> getLastStreakMilestoneShown() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getInt(_keyLastStreakMilestone) ?? 0;
}

/// Mark streak milestone as shown.
Future<void> markStreakMilestoneShown(int days) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setInt(_keyLastStreakMilestone, days);
}
