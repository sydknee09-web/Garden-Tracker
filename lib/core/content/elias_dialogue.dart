import 'dart:math';

import '../enums/day_period.dart';

// ─────────────────────────────────────────────────────────────
// ELIAS DIALOGUE
// All speech copy organised by context.
// Kept separate so copy can be updated without touching UI code.
// ─────────────────────────────────────────────────────────────

class EliasDialogue {
  EliasDialogue._();

  static final _rng = Random();

  // ── Copy pools ─────────────────────────────────────────────

  static const List<String> _afterBurn = [
    'It is done. The path opens.',
    'One stone burned. Keep moving.',
    'Progress is quiet work.',
    'The peak remembers.',
    'Well done. Rest, then return.',
    'A task completed is a debt paid to yourself.',
  ];

  static const List<String> _afterPack = [
    'Your stones are chosen. Make them count.',
    'The satchel is packed. The climb begins.',
    'Carry only what matters.',
    'A full bag and a clear head.',
    'Begin.',
    'These tasks are yours. See them through.',
  ];

  static const List<String> _emptySatchel = [
    'Nothing packed yet.',
    'The bag is empty. Pack your stones.',
    'An empty satchel is a question. Answer it.',
    'No stones chosen. Visit the Map.',
  ];

  static const List<String> _mountainSummit = [
    'The peak is yours.',
    'Summit reached. The peak bows.',
    'Every stone burned. The path is clear.',
  ];

  static const List<String> _burnStreak = [
    'Two days in a row you\'ve fed the fire.',
    'Three days running. The path remembers.',
    'Four days. The peak feels your steps.',
    'Five days. Steady as stone.',
    'A week of burns. The fire knows your name.',
  ];

  static const List<String> _satchelFull = [
    'Your satchel is full. Burn a stone before you add more.',
    'Six stones is the limit. Feed the fire first.',
  ];

  static const List<String> _atMountainCap = [
    "You've got three peaks. Finish one before you start another.",
    'Three peaks at once is the cap. Chronicle one to open a new path.',
  ];

  static const List<String> _returnAfterIdle = [
    "The fire's still here. Whenever you're ready.",
    'You returned. That is enough for now.',
  ];

  static const List<String> _streakFrozen = [
    'The fire is low, but the embers still glow. Return to the path today.',
    'A day of rest is wise, but do not let the stone go cold.',
    'The path is frozen. One more step and the ice will break.',
  ];

  static const List<String> _firstPack = [
    'Your satchel is packed. Drag a stone to the fire when it\'s done.',
  ];

  /// When user tries to drop a not-done stone into the hearth.
  static const List<String> _markDoneToDrop = [
    'Mark the stone as done in your Satchel before dropping it into the fire.',
    'Complete the task in your Satchel first. Then the stone is ready to burn.',
    'Open your Satchel and mark that task done. Then you may drop it here.',
  ];

  static const List<String> _firstBurn = [
    'One stone burned. The path opens.',
  ];

  // ── 5-Beat Cinematic Intro ("The Forest Threshold") ─────────
  // Archivist tone. Ellipses (...) = soft pause for typewriter.
  // Name capture: after Beat 2, two steps (prompt + confirmation); then Beat 3/5 use [Name].

  /// Fallback when user skips name capture. "traveler" keeps the Sanctuary tone without feeling generic.
  static const String defaultTravelerName = 'traveler';

  static const String introBeat1 =
      'Welcome, Traveler. The path has been quiet for a long time...\nthe mountains never forget a friendly face.';
  static const String introBeat2 =
      'You can call me Elias.\nI\'ll walk the path with you and help you find the peace between the peaks.';
  static const String introNamePrompt =
      'And you... every traveler carries a name along with their pack. What shall I call you as we walk?';
  static String introNameConfirmation(String name) =>
      'Ah, $name. A name with weight and worth. Let\'s see if we can\'t lighten the load by the time we reach the summit.';
  static String introBeat3WithName(String name) =>
      'The mountains are the journeys you climb, $name.\nStones block the way. Your Satchel carries what you break. Bring them here... burn them in the Hearth, and the path opens.';
  static const String introBeat3 =
      'The mountains are the journeys you climb.\nStones block the way. Your Satchel carries what you break. Bring them here... burn them in the Hearth, and the path opens.';
  static const String introBeat4 =
      'But even a mountain is moved one pebble at a time.\nStrike a stone with your Hammer to find the manageable steps within.';
  static String introBeat5WithName(String name) =>
      'Burn those pebbles here in the Hearth, and let the weight return to the earth as light.\nTell me, $name... what is calling to you today?';
  static const String introBeat5 =
      'Burn those pebbles here in the Hearth, and let the weight return to the earth as light.\nTell me... what is calling to you today?';
  static const String introBridgeToMap =
      'A fine name. Before we step forward, let us consult the map. Which peak shall we scout first?';
  static const String introPostFirstMountain =
      'This mountain is now carved into our map. You can access it anytime from your satchel here at our campsite. I\'ll keep the fire going.';

  /// Whetstone setup prompt (after closing line).
  static const String introWhetstonePrompt =
      'Before you go—every climber needs a sharp edge. What small ritual keeps you steady?';
  static const String introWhetstoneInsist =
      'Every climber needs a sharp edge. What is the one small ritual that keeps you steady?';

  /// Post–Whetstone (final line before Sanctuary).
  static const String introPostWhetstone =
      'Your edge is sharp. Go to the Campsite when you are ready.';

  /// Stow the Map closing: after save success, before landing on Sanctuary. Narrative bridge.
  static const String stowTheMapClosing =
      'The path is set. Let\'s find our footing and begin the climb.';

  // ── Sanctuary home intro (first landing: Satchel → Path Ahead → Firepit) ──
  static const String sanctuaryHomeIntroSatchel =
      'Your satchel is heavy with intent. Carry only what you mean to finish.';
  static const String sanctuaryHomeIntroPathAhead =
      'These slots hold the stones for your current climb. Keep them close to your heart—and the fire.';
  static const String sanctuaryHomeIntroFirepit =
      'The hearth transforms effort into peace. Feed the fire when a stone has served its purpose.';

  // ── First-run Quest (Guide's Whisper) ─────────────────────

  static const String _firstLandQuestStep1 =
      'Your satchel is light. We must prepare for the ascent. Look within your bag.';
  static const String _firstLandQuestStep3 =
      'The effort of the climb is fuel for the fire. Offer your finished works to the Hearth.';

  static const List<String> _tendingSlopeUntouched = [
    'The weeds are tall on that northern peak, but the earth is still good.',
    'That path has gone quiet. The stones remember.',
  ];

  static const List<String> _coldHearth = [
    'The embers are whispering for more wood.',
  ];

  static const List<String> _onTap = [
    'The fire holds as long as you tend it.',
    'You are further along than you think.',
    'The summit does not move. You do.',
    'Each stone burned is ground covered.',
    'Patience and progress are the same thing.',
    'You returned. That is enough for now.',
  ];

  /// Friend-like lines when user pans/drags on Sanctuary.
  static const List<String> _onMovement = [
    'You move. I notice.',
    'The path rewards those who return.',
    'A small step is still a step.',
    'The fire is glad to see you.',
    'Take your time. I am here.',
    'The summit does not move. You do.',
    'Each stone burned is ground covered.',
    'Patience and progress are the same thing.',
  ];

  // ── Climb flow (6-step wizard: Intent → Identity → Appearance → Logic → Markers → Placing stones) ──

  /// One north-star question so the intent step isn't "prompt overload." Rotates for variety.
  static const List<String> _climbIntentPrompt = [
    "What is your intent for this climb?",
    "What brings you to this peak?",
    "Every journey has a purpose. What is yours?",
  ];

  static const List<String> _intentCapReached = [
    "Keep it focused. The peak is won with clarity, not volume.",
    "A thousand characters is enough. Distill the essence.",
  ];

  static const List<String> _climbIdentityPrompt = [
    "Let's give this journey a name—a title for the peak.",
    "What shall we call this peak?",
    "Name the peak.",
    "Every peak deserves a name. What is yours?",
    "Speak the title into being.",
  ];

  static const List<String> _climbLogicPrompt = [
    "How does this journey unfold? The Climb is step-by-step. The Survey is a collection of areas.",
    "Choose the path: sequential steps or distinct regions?",
    "The Climb: one milestone after another. The Survey: areas to explore.",
    "Step-by-step or by region? Choose.",
  ];

  static const List<String> _climbPeakPrompt = [
    'Which peak has caught your eye today, traveler?',
    "Mighty fine one you've got your eyes set on. What do they call this peak?",
    'Every journey starts with a name. What shall we call this peak?',
    'A peak without a name is a path without a start. Name it.',
    'Speak the peak into being. What do you see at the top?',
  ];

  static const List<String> _climbLandmarksPrompt = [
    "A peak isn't conquered in a single stride. What markers will define the path to the top?",
    'Break the climb into phases. What do you call them?',
    'Name the waypoints. One to ten.',
    'Every summit has waypoints. What are yours?',
    'The trail divides. Name each marker.',
  ];

  static const List<String> _heavySatchel = [
    'Heavy satchel. Ten markers is the limit. Lighten the load.',
    'Ten waypoints is enough. The path needs clarity, not clutter.',
  ];

  static const List<String> _duplicateLandmark = [
    'Each marker needs a unique name. Clear signage on the path.',
    'No two waypoints share a name. Distinguish them.',
  ];

  static const List<String> _climbPebblesPrompt = [
    'Now break each marker into stones. Tap one to add a pebble.',
    'Each marker holds many pebbles. Tap a stone to add one.',
    'The path is made of small steps. Tap a marker to add its first pebble.',
    'Stone by stone. Tap a marker to begin.',
    'Break the work into pebbles. Tap a stone to add one.',
  ];

  static const List<String> _climbPebbleAdded = [
    'Another? Tap the same stone again or choose another.',
    'One more pebble on the path.',
    'Good. Add more or move to the next marker.',
    'The stone sharpens. Tap again or move on.',
  ];

  static const List<String> _climbNextLandmark = [
    'On to the next marker.',
    'Next stone.',
    'The path continues.',
    'Another marker awaits.',
  ];

  static const List<String> _climbAllDone = [
    'Path is clear. Stow the map when you are ready to climb.',
    'The peak is set... Stow the map when you are ready to begin.',
    'Your path is laid. Go when you are ready.',
  ];

  static const List<String> _climbReturnToMap = [
    'Stow the Map',
    'Stow the Map',
  ];

  // ── Hammer Ritual (Refining Stones) ─────────────────────────

  static const List<String> _hammerPrompt = [
    'A heavy stone is just a collection of pebbles waiting for a strike.',
    'Let us see what this weight is made of. Where shall we strike?',
    'The mountain is moved one pebble at a time. Strike the stone.',
    'Too heavy for today? Break it down into smaller truths.',
  ];

  static const List<String> _afterHammerStrike = [
    'A fine strike. The weight is distributed.',
    'The boulder shatters into manageable paths.',
    'It feels lighter already, doesn\'t it?',
  ];

  // ── Edit (Refine) flow ──────────────────────────────────────

  static const List<String> _openEdit = [
    'What would you change?',
    'Refine the path.',
    'Speak the change.',
  ];

  static const List<String> _afterRename = [
    'Done. The path remembers.',
    'Renamed. As you will it.',
    'It is so.',
  ];

  static const List<String> _afterAddPebble = [
    'Another stone on the path.',
    'Added. Break it down when you are ready.',
    'One more pebble.',
  ];

  static const List<String> _afterDelete = [
    'Cleared. The path adjusts.',
    'It is gone. Move forward.',
    'Removed. The peak remains.',
  ];

  // ── Management menu (Elias header greeting) ──────────────────

  static const List<String> _managementGreetings = [
    'What would you like to do?',
    'How can I help you today?',
    'Where shall we go from here?',
    'What calls to you?',
  ];

  static const List<String> _managementGreetingsWithName = [
    'What would you like to do, %s?',
    'How can I help you today, %s?',
    'Where shall we go from here, %s?',
    'What calls to you, %s?',
  ];

  /// Greeting for the management sheet. If [displayName] is present, uses personalized line; otherwise generic.
  static String managementGreeting(String? displayName) {
    final name = displayName?.trim();
    if (name != null && name.isNotEmpty) {
      final i = _rng.nextInt(_managementGreetingsWithName.length);
      return _managementGreetingsWithName[i].replaceAll('%s', name);
    }
    return _pick(_managementGreetings);
  }

  /// Period-based greeting for Sanctuary (campsite). If [displayName] is present, uses personalized line.
  static String sanctuaryPeriodGreeting(ScenePeriod period, String? displayName) {
    final name = displayName?.trim();
    final pools = _sanctuaryPeriodPools(period);
    final i = DateTime.now().millisecondsSinceEpoch % pools.length;
    final line = pools[i];
    if (name != null && name.isNotEmpty && line.contains('%s')) {
      return line.replaceAll('%s', name);
    }
    return line.replaceAll(', %s', '').replaceAll('%s', '').trim();
  }

  static List<String> _sanctuaryPeriodPools(ScenePeriod period) {
    switch (period) {
      case ScenePeriod.dawn:
        return const [
          'The mountain awaits, %s.',
          'Another day on the path. Good morning, %s.',
          'The fire held through the night. Begin, %s.',
        ];
      case ScenePeriod.midday:
        return const [
          'The climb continues, %s.',
          'Midday. Keep your footing, %s.',
          'How goes the ascent, %s?',
        ];
      case ScenePeriod.sunset:
        return const [
          'The light is fading. Finish strong, %s.',
          'A good day\'s climb. Rest is earned, %s.',
          'The summit does not move. Return tomorrow, %s.',
        ];
      case ScenePeriod.night:
        return const [
          'The Sanctuary holds. Rest well, %s.',
          'The fire is yours. Take the quiet, %s.',
          'Tomorrow\'s path begins in tonight\'s stillness, %s.',
        ];
    }
  }

  // ── Whetstone choice overlay (bubble tail) ──────────────────

  static const String _whetstoneEntry =
      'A dull blade makes for a dangerous climb. How shall we prepare?';
  static const String _whetstoneHabitNudge =
      'Your daily rituals are the edge of your blade. Keep them sharp.';
  static const String _whetstoneRefineNudge =
      'This stone is too heavy. Let us strike it into smaller truths.';

  // ── Private helper ─────────────────────────────────────────

  static String _pick(List<String> pool) =>
      pool[_rng.nextInt(pool.length)];

  /// Pick from pool, avoiding the same index twice in a row. Returns (line, index).
  /// Pass -1 for lastIndex on first call.
  static (String, int) _pickNoRepeat(List<String> pool, int lastIndex) {
    if (pool.isEmpty) return ('', -1);
    if (pool.length == 1) return (pool.first, 0);
    int idx;
    do {
      idx = _rng.nextInt(pool.length);
    } while (idx == lastIndex);
    return (pool[idx], idx);
  }

  // ── Public accessors ───────────────────────────────────────

  /// Spoken after a stone is burned in the Hearth.
  static String afterBurn() => _pick(_afterBurn);

  /// Spoken after the Satchel is packed.
  static String afterPack() => _pick(_afterPack);

  /// Spoken when the user opens the Satchel and it is empty.
  static String emptySatchel() => _pick(_emptySatchel);

  /// Spoken when the user taps Elias and fire is cold (fuel 0, no stones dropped).
  static String coldHearth() => _pick(_coldHearth);

  /// Spoken when the user taps Elias directly.
  static String onTap() => _pick(_onTap);

  /// Spoken when the last pebble of a mountain is burned (summit celebration).
  static String mountainSummit() => _pick(_mountainSummit);

  /// Context-aware: satchel full when user tries to pack.
  static String satchelFull() => _pick(_satchelFull);

  /// Context-aware: at mountain cap (3 active) when user tries to climb.
  static String atMountainCap() => _pick(_atMountainCap);

  /// Context-aware: return after long idle (no burn in 3+ days).
  static String returnAfterIdle() => _pick(_returnAfterIdle);

  /// Spoken when a user returns during a "Grace Day" (first miss).
  static String streakFrozen() => _pick(_streakFrozen);

  /// Random line when user pans on Sanctuary (throttled).
  static String onMovement() => _pick(_onMovement);

  /// First-run: after first Pack with slots filled.
  static String firstPackLine() => _firstPack.first;

  /// When user tries to drop a not-done stone into the hearth.
  static String markDoneToDrop() => _pick(_markDoneToDrop);

  /// First-run: after first Burn.
  static String firstBurnLine() => _firstBurn.first;

  /// First-run Quest Step 1: empty state, directs user to Satchel.
  static String firstLandQuestStep1() => _firstLandQuestStep1;

  /// First-run Quest Step 3: return with packed stone, directs to Hearth.
  static String firstLandQuestStep3() => _firstLandQuestStep3;

  /// Mountain untouched 7+ days — encourages return, no guilt.
  static String tendingSlopeUntouched() => _pick(_tendingSlopeUntouched);

  static const List<String> _habitStreak7 = [
    'Seven days. The stone is sharp.',
    'A week of tending. Well done.',
  ];
  static const List<String> _habitStreak30 = [
    'Thirty days. The path knows your steps.',
    'A month of discipline. The peak bows.',
  ];
  static const List<String> _habitStreak100 = [
    'One hundred days. You are the stone.',
    'A hundred days. The fire remembers.',
  ];

  /// Habit streak milestone (7, 30, or 100 days).
  static String habitStreakMilestone(int days) {
    if (days >= 100) return _pick(_habitStreak100);
    if (days >= 30) return _pick(_habitStreak30);
    return _pick(_habitStreak7);
  }

  /// Spoken after a burn when streak >= 2.
  static String burnStreakLine(int days) {
    if (days <= 1) return _pick(_afterBurn);
    final idx = (days - 2).clamp(0, _burnStreak.length - 1);
    return _burnStreak[idx];
  }

  // ── Climb flow accessors (6-step wizard) ──────────────────────

  /// Step 0: Intent (The "Why"). Returns (line, index).
  static (String, int) climbIntentPromptWithIndex(int lastEliasIndex) =>
      _pickNoRepeat(_climbIntentPrompt, lastEliasIndex);

  /// When intent exceeds 1000 chars.
  static String intentCapReached() => _pick(_intentCapReached);

  /// Step 1: Identity (The "Name"). Returns (line, index).
  static (String, int) climbIdentityPromptWithIndex(int lastEliasIndex) =>
      _pickNoRepeat(_climbIdentityPrompt, lastEliasIndex);

  /// Step 3: Logic (Climb vs Survey). Returns (line, index).
  static (String, int) climbLogicPromptWithIndex(int lastEliasIndex) =>
      _pickNoRepeat(_climbLogicPrompt, lastEliasIndex);

  /// Peak prompt (legacy / fallback).
  static (String, int) climbPeakPromptWithIndex(int lastEliasIndex) =>
      _pickNoRepeat(_climbPeakPrompt, lastEliasIndex);

  /// Step 4: Landmarks.
  static (String, int) climbLandmarksPromptWithIndex(int lastEliasIndex) =>
      _pickNoRepeat(_climbLandmarksPrompt, lastEliasIndex);

  /// Step 5: Pebbles / Placing stones. Returns (line, index).
  static (String, int) climbPebblesPromptWithIndex(int lastEliasIndex) =>
      _pickNoRepeat(_climbPebblesPrompt, lastEliasIndex);

  static String climbPebbleAdded() => _pick(_climbPebbleAdded);
  static String climbNextLandmark() => _pick(_climbNextLandmark);
  static String climbAllDone() => _pick(_climbAllDone);
  static String climbReturnToMap() => _pick(_climbReturnToMap);

  /// When user tries to add 11th landmark.
  static String heavySatchel() => _pick(_heavySatchel);

  /// When landmark names are duplicated.
  static String duplicateLandmark() => _pick(_duplicateLandmark);

  // ── Hammer ritual accessors ──────────────────────────────────

  /// Spoken when opening the Refine modal via the Hammer icon.
  static String hammerPrompt() => _pick(_hammerPrompt);

  /// Spoken after a Stone is successfully split into Pebbles.
  static String afterHammerStrike() => _pick(_afterHammerStrike);

  // ── Edit flow accessors ─────────────────────────────────────

  static String openEdit() => _pick(_openEdit);
  static String afterRename() => _pick(_afterRename);
  static String afterAddPebble() => _pick(_afterAddPebble);
  static String afterDelete() => _pick(_afterDelete);

  /// Whetstone overlay: general prompt when user taps Whetstone icon.
  static String whetstoneEntry() => _whetstoneEntry;

  /// Whetstone overlay: tooltip for Sharpen Habits.
  static String whetstoneHabitNudge() => _whetstoneHabitNudge;

  /// Whetstone overlay: tooltip for Refine Path (Hammer).
  static String whetstoneRefineNudge() => _whetstoneRefineNudge;
}
