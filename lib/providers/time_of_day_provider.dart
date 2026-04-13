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
    final nextMinute = DateTime(
      now.year,
      now.month,
      now.day,
      now.hour,
      now.minute + 1,
    );
    await Future.delayed(nextMinute.difference(now));
    yield DateTime.now().dayPeriod;
  }
}

/// Yields current time every minute. Used by sanctuary background to compute
/// opacity blend between the four time-of-day layers (smooth 30-min transition).
final currentTimeForBackgroundProvider = StreamProvider<DateTime>((ref) async* {
  yield DateTime.now();
  while (true) {
    final now = DateTime.now();
    final nextMinute = DateTime(
      now.year,
      now.month,
      now.day,
      now.hour,
      now.minute + 1,
    );
    await Future.delayed(nextMinute.difference(now));
    yield DateTime.now();
  }
});
