import 'package:flutter_test/flutter_test.dart';
import 'package:voyager_sanctuary/core/enums/day_period.dart';
import 'package:voyager_sanctuary/core/extensions/datetime_extensions.dart';

void main() {
  group('ScenePeriod — Time-of-Day Engine', () {
    test('5:00 AM is dawn', () {
      final dt = DateTime(2026, 1, 1, 5, 0);
      expect(dt.dayPeriod, ScenePeriod.dawn);
    });

    test('9:59 AM is still dawn', () {
      final dt = DateTime(2026, 1, 1, 9, 59);
      expect(dt.dayPeriod, ScenePeriod.dawn);
    });

    test('10:00 AM is midday', () {
      final dt = DateTime(2026, 1, 1, 10, 0);
      expect(dt.dayPeriod, ScenePeriod.midday);
    });

    test('4:59 PM is still midday', () {
      final dt = DateTime(2026, 1, 1, 16, 59);
      expect(dt.dayPeriod, ScenePeriod.midday);
    });

    test('5:00 PM is sunset', () {
      final dt = DateTime(2026, 1, 1, 17, 0);
      expect(dt.dayPeriod, ScenePeriod.sunset);
    });

    test('7:59 PM is still sunset', () {
      final dt = DateTime(2026, 1, 1, 19, 59);
      expect(dt.dayPeriod, ScenePeriod.sunset);
    });

    test('8:00 PM is night', () {
      final dt = DateTime(2026, 1, 1, 20, 0);
      expect(dt.dayPeriod, ScenePeriod.night);
    });

    test('4:59 AM is still night', () {
      final dt = DateTime(2026, 1, 1, 4, 59);
      expect(dt.dayPeriod, ScenePeriod.night);
    });

    test('midnight is night', () {
      final dt = DateTime(2026, 1, 1, 0, 0);
      expect(dt.dayPeriod, ScenePeriod.night);
    });
  });
}
