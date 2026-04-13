import '../enums/day_period.dart';

extension DateTimeExtensions on DateTime {
  ScenePeriod get dayPeriod {
    final h = hour;
    if (h >= 5 && h < 10) return ScenePeriod.dawn;
    if (h >= 10 && h < 17) return ScenePeriod.midday;
    if (h >= 17 && h < 20) return ScenePeriod.sunset;
    return ScenePeriod.night;
  }

  bool isSameDay(DateTime other) =>
      year == other.year && month == other.month && day == other.day;

  /// Returns a date-only string suitable for Supabase `DATE` columns (YYYY-MM-DD).
  String toDateString() =>
      '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
}
