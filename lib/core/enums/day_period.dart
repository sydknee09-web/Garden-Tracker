/// The four atmospheric scenes driven by device time.
/// Named [ScenePeriod] (not DayPeriod) to avoid collision with Flutter's
/// material.dart DayPeriod class used in TimeOfDay widgets.
enum ScenePeriod {
  dawn(5, 10, 'The light is thin, but the path is waking.'),
  midday(10, 17, 'The sun is high. The mountain is clear.'),
  sunset(17, 20, 'The shadows grow long. Rest is near.'),
  night(20, 5, 'The fire is your only guide. Speak softly.');

  const ScenePeriod(this.startHour, this.endHour, this.description);

  final int startHour;
  final int endHour;
  final String description;
}

extension ScenePeriodExtension on ScenePeriod {
  String get label {
    switch (this) {
      case ScenePeriod.dawn:
        return 'Dawn';
      case ScenePeriod.midday:
        return 'Midday';
      case ScenePeriod.sunset:
        return 'Sunset';
      case ScenePeriod.night:
        return 'Night';
    }
  }

  /// Asset path for the period-specific Elias pose image.
  String get eliasAssetPath {
    switch (this) {
      case ScenePeriod.dawn:
        return 'assets/elias/Elias_Dawn.png';
      case ScenePeriod.midday:
        return 'assets/elias/Elias_Midday.png';
      case ScenePeriod.sunset:
        return 'assets/elias/Elias_Sunset.png';
      case ScenePeriod.night:
        return 'assets/elias/Elias_Night.png';
    }
  }

  String get eliasGreeting {
    switch (this) {
      case ScenePeriod.dawn:
        return _dawns[DateTime.now().millisecondsSinceEpoch % _dawns.length];
      case ScenePeriod.midday:
        return _middays[DateTime.now().millisecondsSinceEpoch %
            _middays.length];
      case ScenePeriod.sunset:
        return _sunsets[DateTime.now().millisecondsSinceEpoch %
            _sunsets.length];
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
