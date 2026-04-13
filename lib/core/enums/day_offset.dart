import 'package:voyager_sanctuary/core/extensions/datetime_extensions.dart';

/// The three-position slider on the Whetstone screen.
enum DayOffset { yesterday, today, tomorrow }

extension DayOffsetExtension on DayOffset {
  String get label {
    switch (this) {
      case DayOffset.yesterday:
        return 'Yesterday';
      case DayOffset.today:
        return 'Today';
      case DayOffset.tomorrow:
        return 'Tomorrow';
    }
  }

  /// Resolves this offset to a concrete local date string (YYYY-MM-DD).
  /// Uses device local time — NOT UTC — to match the Whetstone's midnight reset.
  String toDateString() {
    final now = DateTime.now();
    final DateTime date;
    switch (this) {
      case DayOffset.yesterday:
        date = DateTime(now.year, now.month, now.day - 1);
      case DayOffset.today:
        date = DateTime(now.year, now.month, now.day);
      case DayOffset.tomorrow:
        date = DateTime(now.year, now.month, now.day + 1);
    }
    return date.toDateString();
  }
}
