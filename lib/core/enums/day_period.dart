/// The four atmospheric scenes driven by device time.
/// Named [ScenePeriod] (not DayPeriod) to avoid collision with Flutter's
/// material.dart DayPeriod class used in TimeOfDay widgets.
enum ScenePeriod {
  dawn,    // 05:00 – 09:59
  midday,  // 10:00 – 16:59
  sunset,  // 17:00 – 19:59
  night,   // 20:00 – 04:59
}

extension ScenePeriodExtension on ScenePeriod {
  String get label {
    switch (this) {
      case ScenePeriod.dawn:   return 'Dawn';
      case ScenePeriod.midday: return 'Midday';
      case ScenePeriod.sunset: return 'Sunset';
      case ScenePeriod.night:  return 'Night';
    }
  }

  /// Asset path for the period-specific Elias pose image.
  String get eliasAssetPath {
    switch (this) {
      case ScenePeriod.dawn:   return 'assets/elias/elias_dawn.png';
      case ScenePeriod.midday: return 'assets/elias/elias_midday.png';
      case ScenePeriod.sunset: return 'assets/elias/elias_sunset.png';
      case ScenePeriod.night:  return 'assets/elias/elias_night.png';
    }
  }

  String get eliasGreeting {
    switch (this) {
      case ScenePeriod.dawn:
        return _dawns[DateTime.now().millisecondsSinceEpoch % _dawns.length];
      case ScenePeriod.midday:
        return _middays[DateTime.now().millisecondsSinceEpoch % _middays.length];
      case ScenePeriod.sunset:
        return _sunsets[DateTime.now().millisecondsSinceEpoch % _sunsets.length];
      case ScenePeriod.night:
        return _nights[DateTime.now().millisecondsSinceEpoch % _nights.length];
    }
  }
}

const _dawns = [
  'The mountain awaits, traveler.',
  'Another day on the path. Good morning.',
  'The fire held through the night. Begin.',
];

const _middays = [
  'The climb continues.',
  'Midday. Keep your footing.',
  'How goes the ascent?',
];

const _sunsets = [
  'The light is fading. Finish strong.',
  'A good day\'s climb. Rest is earned.',
  'The summit does not move. Return tomorrow.',
];

const _nights = [
  'The Sanctuary holds. Rest well.',
  'The fire is yours. Take the quiet.',
  'Tomorrow\'s path begins in tonight\'s stillness.',
];
