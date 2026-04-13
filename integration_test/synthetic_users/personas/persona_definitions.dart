/// Persona definitions for synthetic user testing.
/// Each persona has skill level, goals, intelligence, and patience
/// that affect how they navigate the app.
library;

enum SkillLevel { beginner, intermediate, expert }

enum Patience { low, medium, high }

/// Patience directly scales pumpAndSettle duration (seconds).
int pumpAndSettleSecondsFor(Patience p) => switch (p) {
      Patience.low => 2,
      Patience.medium => 4,
      Patience.high => 6,
    };

class Persona {
  const Persona({
    required this.id,
    required this.skillLevel,
    required this.goals,
    this.intelligence = 0.8,
    this.patience = Patience.medium,
  });

  final String id;
  final SkillLevel skillLevel;
  final List<String> goals;
  final double intelligence; // 0.0–1.0; higher = fewer dead ends
  final Patience patience;

  Duration get pumpAndSettleDuration =>
      Duration(seconds: pumpAndSettleSecondsFor(patience));

  int get maxRetries => switch (skillLevel) {
        SkillLevel.beginner => 2,
        SkillLevel.intermediate => 1,
        SkillLevel.expert => 0,
      };
}

/// Preset personas for synthetic user testing.
final syntheticPersonas = [
  const Persona(
    id: 'first_time_marcus',
    skillLevel: SkillLevel.beginner,
    goals: ['explore', 'add_task'],
    intelligence: 0.4,
    patience: Patience.medium,
  ),
  const Persona(
    id: 'task_focused_tina',
    skillLevel: SkillLevel.intermediate,
    goals: ['add_task', 'complete_task'],
    intelligence: 0.7,
    patience: Patience.medium,
  ),
  const Persona(
    id: 'power_user_paul',
    skillLevel: SkillLevel.expert,
    goals: ['add_task', 'complete_task', 'whetstone'],
    intelligence: 0.95,
    patience: Patience.low,
  ),
];
