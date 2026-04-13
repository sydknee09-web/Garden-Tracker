import 'package:flutter_test/flutter_test.dart';
import 'package:voyager_sanctuary/core/enums/day_period.dart' show ScenePeriod;
import 'package:voyager_sanctuary/core/extensions/datetime_extensions.dart';

/// First Five — Test #1: Dawn to Midday transition (time-of-day engine).
/// Period boundaries: Dawn 5–9:59, Midday 10–16:59, Sunset 17–19:59, Night 20–4:59.
void main() {
  group('ScenePeriod / dayPeriod (First Five Test #1)', () {
    test('at 09:59 period is dawn', () {
      final t = DateTime(2026, 3, 13, 9, 59);
      expect(t.dayPeriod, ScenePeriod.dawn);
    });

    test('at 10:00 period is midday', () {
      final t = DateTime(2026, 3, 13, 10, 0);
      expect(t.dayPeriod, ScenePeriod.midday);
    });

    test('at 16:59 period is midday', () {
      final t = DateTime(2026, 3, 13, 16, 59);
      expect(t.dayPeriod, ScenePeriod.midday);
    });

    test('at 17:00 period is sunset', () {
      final t = DateTime(2026, 3, 13, 17, 0);
      expect(t.dayPeriod, ScenePeriod.sunset);
    });

    test('at 19:59 period is sunset', () {
      final t = DateTime(2026, 3, 13, 19, 59);
      expect(t.dayPeriod, ScenePeriod.sunset);
    });

    test('at 20:00 period is night', () {
      final t = DateTime(2026, 3, 13, 20, 0);
      expect(t.dayPeriod, ScenePeriod.night);
    });

    test('at 04:59 period is night', () {
      final t = DateTime(2026, 3, 13, 4, 59);
      expect(t.dayPeriod, ScenePeriod.night);
    });

    test('at 05:00 period is dawn', () {
      final t = DateTime(2026, 3, 13, 5, 0);
      expect(t.dayPeriod, ScenePeriod.dawn);
    });
  });
}
