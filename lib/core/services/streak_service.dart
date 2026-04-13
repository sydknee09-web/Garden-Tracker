/// Streak computation with 4:00 AM "day" boundary and Grace Day (Option A: freeze).
///
/// **4:00 AM boundary:** Normalize timestamps by subtracting 4 hours before
/// computing the calendar day. Activity at 1:00 AM counts as "previous day"
/// until 4:00 AM, preserving momentum for late-night workers.
///
/// **Grace Day (Option A):** One missed *streak-day* freezes the counted streak
/// when walking backward through history (the ember holds). Two consecutive
/// empty streak-days without activity reset the streak to 0. This matches the
/// product goal of "miss a day, return soon and the path remembers" without
/// requiring wall-clock 24h tracking in v0.1.2.
library;

/// Hours to subtract from a timestamp to get the "streak day".
/// 4:00 AM boundary: 1:00 AM Tuesday → 9:00 PM Monday → Monday.
const int _streakDayOffsetHours = 4;

/// Converts a timestamp to the "streak day" (YYYY-MM-DD) using the 4 AM boundary.
String _toStreakDay(DateTime timestamp) {
  final local = timestamp.isUtc ? timestamp.toLocal() : timestamp;
  final adjusted = local.subtract(const Duration(hours: _streakDayOffsetHours));
  return '${adjusted.year}-${adjusted.month.toString().padLeft(2, '0')}-${adjusted.day.toString().padLeft(2, '0')}';
}

/// Returns the current "streak day" (4 AM boundary) for the device.
String currentStreakDay() => _toStreakDay(DateTime.now());

/// Result of streak computation.
class StreakResult {
  const StreakResult({
    required this.currentStreak,
    required this.lastActivityDay,
    this.graceUsed = false,
  });

  final int currentStreak;
  final String? lastActivityDay;
  final bool graceUsed;

  bool get hasStreak => currentStreak > 0;
}

/// Computes streak from a list of activity timestamps.
///
/// [timestamps] — activity times (e.g. completion or burn). Will be normalized
/// to local time and 4 AM boundary. Duplicates per day are collapsed.
///
/// **Grace Day (Option A):** One missed day freezes (streak stops, does not reset).
/// Two consecutive missed days reset streak to 0.
StreakResult computeStreak(List<DateTime> timestamps) {
  if (timestamps.isEmpty) {
    return const StreakResult(currentStreak: 0, lastActivityDay: null);
  }

  final distinctDays = timestamps.map((t) => _toStreakDay(t)).toSet().toList()
    ..sort((a, b) => b.compareTo(a)); // newest first

  if (distinctDays.isEmpty) {
    return const StreakResult(currentStreak: 0, lastActivityDay: null);
  }

  final today = currentStreakDay();
  final lastDay = distinctDays.first;

  // Last activity must be today or yesterday (in streak-day terms) or streak is 0
  final daysSinceActivity = _daysBetween(lastDay, today);
  if (daysSinceActivity > 1) {
    return StreakResult(currentStreak: 0, lastActivityDay: lastDay);
  }

  // Count consecutive days from most recent backward. Apply Grace on 1-day gap.
  int streak = 0;
  bool graceUsed = false;
  String expected = lastDay;

  for (final day in distinctDays) {
    if (day == expected) {
      streak++;
      expected = _prevDay(expected);
    } else {
      final gap = _daysBetween(day, expected);
      if (gap == 1) {
        graceUsed = true;
        break; // Freeze: stop counting, keep current streak
      } else {
        streak = 0;
        break; // Gap >= 2: reset
      }
    }
  }

  return StreakResult(
    currentStreak: streak,
    lastActivityDay: lastDay,
    graceUsed: graceUsed,
  );
}

int _daysBetween(String from, String to) {
  final d1 = DateTime.parse(from);
  final d2 = DateTime.parse(to);
  return d2.difference(d1).inDays;
}

String _prevDay(String day) {
  final d = DateTime.parse(day);
  final prev = d.subtract(const Duration(days: 1));
  return '${prev.year}-${prev.month.toString().padLeft(2, '0')}-${prev.day.toString().padLeft(2, '0')}';
}
