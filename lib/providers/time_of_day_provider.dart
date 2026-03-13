import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/enums/day_period.dart';
import '../core/extensions/datetime_extensions.dart';

/// Emits the current [ScenePeriod] and updates whenever the minute changes.
/// This is the single source of truth for all time-of-day UI logic:
/// backgrounds, Elias pose, greetings, and Whetstone date boundary detection.
final timeOfDayProvider = StreamProvider<ScenePeriod>((ref) {
  return _scenePeriodStream();
});

Stream<ScenePeriod> _scenePeriodStream() async* {
  yield DateTime.now().dayPeriod;

  while (true) {
    final now = DateTime.now();
    // Wait until the start of the next minute, then re-evaluate.
    // Checking every minute is sufficient — period boundaries are on the hour.
    final nextMinute = DateTime(now.year, now.month, now.day, now.hour, now.minute + 1);
    await Future.delayed(nextMinute.difference(now));
    yield DateTime.now().dayPeriod;
  }
}
