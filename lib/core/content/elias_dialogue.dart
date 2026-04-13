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
    'A stone burned is a debt paid to yourself.',
    'One less weight. The path remembers.',
    'Ash to earth. The fire is fed.',
  ];

  static const List<String> _afterPack = [
    'Your stones are chosen. Make them count.',
    'The satchel is packed. The climb begins.',
    'Carry only what matters.',
    'A full bag and a clear head.',
    'Begin.',
    'These stones are yours. See them through.',
  ];

  /// EDGE E1 — empty satchel / caught up / nudge toward Map or next action.
  /// See `docs/CORE_LOOP_SOURCE_OF_TRUTH.md` §14. (Auto-pack is framed as Elias in product copy.)
  static const List<String> _edgeE1EmptySatchelCaughtUp = [
    'Your satchel awaits. Break a stone to begin.',
    'Nothing packed yet.',
    'The bag is empty. Pack your stones.',
    'An empty satchel is a question. Answer it.',
    'No stones chosen. Visit the Map.',
    'An empty bag is a quiet path. Visit the map to find a stone worth carrying.',
    'The path is clear for the moment. Shall we plan the next climb—or tend the blade?',
    "I've set out what needs doing today. The rest waits on your hand.",
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
    'Three peaks at once. Chronicle one to open a new path.',
    'Three peaks at once is the cap. Chronicle one to open a new path.',
  ];

  static const List<String> _returnAfterIdle = [
    "The fire's still here. Whenever you're ready.",
    'You returned. That is enough for now.',
    'The stone stays blunt until the hand moves.',
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
    'Mark the stone done in your Satchel first. Then it is ready to burn.',
    'Open your Satchel and mark the stone done. Then you may drop it here.',
  ];

  static const List<String> _firstBurn = ['One stone burned. The path opens.'];

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

  /// Save failed (404, timeout, or generic persist error). Show in Elias bubble or toast for in-world recovery.
  static const String _saveFailed =
      'The mountain mist is thick right now—let\'s try that choice again.';

  /// Peak Journal / Mountain Detail arrival (when Hero Zoom completes). Elias appears from the side.
  static const String _peakJournalArrival =
      'Welcome to the base of this peak. Let us look at the path you\'ve carved.';

  // ── Sanctuary home intro (first landing: Satchel → Path Ahead → Firepit) ──
  static const String sanctuaryHomeIntroSatchel =
      'Your satchel is heavy with intent. Carry only what you mean to finish.';
  static const String sanctuaryHomeIntroPathAhead =
      'These slots hold the stones for your climb. Keep them close to your heart—and the fire.';
  static const String sanctuaryHomeIntroFirepit =
      'The hearth transforms effort into peace. Feed the fire when a stone has served its purpose.';

  /// Single first-visit bubble (non-empty sanctuary): map, satchel row, hearth, then counsel.
  static const String sanctuaryHomeIntroCombined =
      'Three anchors here: the Map holds your peaks. The stone row is your Satchel—pack work you intend to finish. The Hearth accepts what is done. Tap me anytime for counsel.';

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
    'No stone on the fire yet. When you are ready.',
    'The hearth is patient. Bring a stone when it serves you.',
  ];

  static const List<String> _onTap = [
    'The fire holds as long as you tend it.',
    'You are further along than you think.',
    'The summit does not move. You do.',
    'Each stone burned is ground covered.',
    'Patience and progress are the same thing.',
    'You returned. That is enough for now.',
    'The path waits. So do I.',
    'Every return is a kind of burn.',
    'You are here. That is the step that matters.',
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
    "How does this journey unfold? Climb: step-by-step. Survey: areas to explore.",
    "Choose the path: sequential steps or distinct regions?",
    "The Climb: one milestone after another. The Survey: areas to explore.",
    "Step-by-step or by region? Choose.",
  ];

  static const List<String> _climbPeakPrompt = [
    'Which peak has caught your eye today, traveler?',
    'A fine peak. What do they call it?',
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
  // Preferred ritual lines at start of each pool (Option B from ELIAS_DIALOGUE_AUDIT_RECOMMENDATIONS).

  static const List<String> _openEdit = [
    'Let us look closer at this weight. Where shall we strike?',
    'What would you change?',
    'Refine the path.',
    'Speak the change.',
  ];

  static const List<String> _afterRename = [
    'A new name, a new path. It feels lighter already.',
    'Done. The path remembers.',
    'Renamed. As you will it.',
    'It is so.',
  ];

  static const List<String> _afterAddPebble = [
    'A fine fragment. That is one less burden for the spirit.',
    'Another stone on the path.',
    'Added. Break it down when you are ready.',
    'One more pebble.',
  ];

  static const List<String> _afterDelete = [
    'Let the dust return to the earth. We only carry what is useful.',
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
    'What needs tending, %s?',
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
  static String sanctuaryPeriodGreeting(
    ScenePeriod period,
    String? displayName,
  ) {
    if (period == ScenePeriod.night && DateTime.now().hour < 4) {
      final blueHour =
          'Still awake, Keeper? The ledger can wait for the sun, but the fire is warm if you must stay.';
      return blueHour;
    }
    final name = displayName?.trim();
    final pools = _sanctuaryPeriodPools(period);
    final i = _rng.nextInt(pools.length);
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
          'First light finds the faithful. Walk with me, %s.',
          'The trail is long; the first step is now, %s.',
        ];
      case ScenePeriod.midday:
        return const [
          'The climb continues, %s.',
          'Midday. Keep your footing, %s.',
          'How goes the ascent, %s?',
          'Heat tests the traveler. Steady breath, %s.',
          'What you tend at noon shapes the evening fire, %s.',
        ];
      case ScenePeriod.sunset:
        return const [
          'The light is fading. Finish strong, %s.',
          'A good day\'s climb. Rest is earned, %s.',
          'The summit does not move. Return tomorrow, %s.',
          'Gold on the ridge — honor what you moved today, %s.',
          'Let the hearth receive what you are ready to release, %s.',
        ];
      case ScenePeriod.night:
        return const [
          'The Sanctuary holds. Rest well, %s.',
          'The fire is yours. Take the quiet, %s.',
          'Tomorrow\'s path begins in tonight\'s stillness, %s.',
          'The ledger can sleep. You need not, %s — only breathe.',
          'Darkness keeps its own counsel. So may you, %s.',
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

  static String _pick(List<String> pool) => pool[_rng.nextInt(pool.length)];

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

  /// Spoken when the user opens the Satchel and it is empty (pool = EDGE E1).
  static String emptySatchel() => edgeEmptySatchelCaughtUp();

  /// EDGE E1 — canonical accessor for empty / caught-up satchel copy.
  static String edgeEmptySatchelCaughtUp() =>
      _pick(_edgeE1EmptySatchelCaughtUp);

  /// Spoken when the user taps Elias and fire is cold (fuel 0, no stones dropped).
  static String coldHearth() => _pick(_coldHearth);

  /// Spoken when the user taps Elias directly.
  static String onTap() => _pick(_onTap);

  /// Spoken when the last pebble of a mountain is burned (summit celebration).
  static String mountainSummit() => _pick(_mountainSummit);

  /// Context-aware: satchel full when user tries to pack (EDGE E7).
  static String satchelFull() => _pick(_satchelFull);

  /// EDGE E7 — alias for `satchelFull()` (source-of-truth id).
  static String edgeSatchelFull() => satchelFull();

  /// EDGE E2 — fire reads cold / low fuel (alias of [coldHearth]).
  static String edgeFireCold() => coldHearth();

  /// Context-aware: at mountain cap (3 active) when user tries to climb.
  static String atMountainCap() => _pick(_atMountainCap);

  /// Context-aware: return after long idle (no burn in 3+ days). Whetstone overlay: 30s idle.
  static String returnAfterIdle() => _pick(_returnAfterIdle);

  /// Save failed (404, timeout, generic persist). Wire from save-error handling.
  static String saveFailed() => _saveFailed;

  /// Peak Journal / Mountain Detail arrival when Hero Zoom completes.
  static String peakJournalArrival() => _peakJournalArrival;

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

  /// Subcopy under the Climb / Survey chips: how this relates to the map and packing.
  static const String climbLayoutPackHint =
      'Climb reads as a path—Survey as regions on the map. Pack Satchel still pulls from what is ready to move today.';

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

  // ── EDGE E3 — Map with no active Peaks ──────────────────────

  static const List<String> _edgeE3NoActivePeaks = [
    'Plant your first peak.',
    'Every summit begins with a single step from camp.',
    'The map is quiet. Plot one path — the mountains will answer.',
    'No peaks yet. Name the climb that matters most today.',
  ];

  /// EDGE E3 — scroll / map empty state (rotating pool).
  static String edgeNoActivePeaks() => _pick(_edgeE3NoActivePeaks);

  /// Legacy name — use [edgeNoActivePeaks] in new code.
  static String scrollMapEmptyLine() => edgeNoActivePeaks();

  /// EDGE E4 — long absence / hearth cooled (vision: lighter pack; wire UI later).
  static const List<String> _edgeE4LongAbsenceReturn = [
    'The hearth has cooled. Let\'s start small.',
    'You\'ve been away. The path is still here — one stone at a time.',
    'The embers remember. When you are ready, we begin again.',
  ];

  static String edgeLongAbsenceReturn() => _pick(_edgeE4LongAbsenceReturn);

  // ── v0.1.2: Empty states (fixed copy) ───────────────────────

  /// Satchel body when all slots empty (same pool as EDGE E1).
  static String satchelEmptyEliasLine() => edgeEmptySatchelCaughtUp();

  static const String _whetstoneEmptyV012 =
      'Sharp habits sharpen the climb.';

  static String whetstoneEmptyLine() => _whetstoneEmptyV012;

  // ── v0.1.2: Journal / reflection prompts ────────────────────

  static String reflectionWhyPeakPrompt(String mountainName) =>
      'You\'ve named it $mountainName. But what does this peak represent in your life?';

  static String reflectionPackPrompt(String mountainName) =>
      'You carried the stone to the hearth. What does this achievement mean to you?';

  static const String whetstoneStrugglePrompt =
      'The sharpening isn\'t happening today. Is the stone too heavy, or have you set it down intentionally?';

  static const String whetstoneStruggleOverwhelmed =
      'Then we lighten the pack. One stone at a time. I am here.';

  static const String whetstoneStruggleIntentional =
      'A chosen pause is still part of the climb. Return when the edge calls.';

  // ── v0.1.2: Time-of-day greetings (stoic knight tone) ───────

  static String timeOfDayGreeting(ScenePeriod period) {
    switch (period) {
      case ScenePeriod.dawn:
        return _pick(const [
          'The light returns. So do you.',
          'Dawn breaks. The path remembers those who return.',
          'The mist lifts. Take the step that is yours today.',
          'Birdsong is brief; the climb is long. Begin anyway.',
          'Cool air, clear head — gift yourself one honest hour.',
        ]);
      case ScenePeriod.midday:
        return _pick(const [
          'The sun is high. Your shadow grows short.',
          'Midday clarity. Use it while it lasts.',
          'The slope is steep; pace is its own discipline.',
          'Noon does not ask for drama. It asks for presence.',
          'Half the sky behind you. Half still yours to earn.',
        ]);
      case ScenePeriod.sunset:
        return _pick(const [
          'The light fades but the fire grows. Feed it.',
          'Dusk. The embers reward honest work.',
          'Day\'s labor ends. Let the weight you shed stay shed.',
          'The horizon forgives what the hour could not finish.',
          'Orange on the stones — a soft verdict on the day.',
        ]);
      case ScenePeriod.night:
        return _pick(const [
          'The stars are your map now. The hearth is your anchor.',
          'Night holds the mountain. Rest is not surrender.',
          'The camp is still. What you carried today was enough.',
          'Silence is not empty. It is full of answers you are not ready to hear.',
          'The fire knows your name without you speaking it.',
        ]);
    }
  }

  // ── v0.1.2: Habit-specific encouragement ───────────────────

  static String habitCompleteEncouragement(String habitTitle) {
    final t = habitTitle.toLowerCase();
    if (t.contains('run') ||
        t.contains('walk') ||
        t.contains('gym') ||
        t.contains('exercise') ||
        t.contains('move')) {
      return 'The body wakes before the mind. You\'ve learned this.';
    }
    if (t.contains('read') || t.contains('book')) {
      return 'Knowledge is a tool as valuable as the whetstone.';
    }
    if (t.contains('meditat') ||
        t.contains('still') ||
        t.contains('breathe')) {
      return 'Stillness sharpens. Rest is work.';
    }
    return 'Well tended. The edge holds.';
  }

  static const String setbackThreeHabitsMissed =
      'The blade grows dull. It happens. That\'s why we have the whetstone.';

  static const String setbackDraftDeleted =
      'Not every path leads up the mountain. That\'s wisdom, not failure.';

  /// Shown on Sanctuary streak chip (tooltip) — explains 4 AM streak-day + freeze.
  static const String burnStreakGraceTooltip =
      'Streak freezes when you miss a day. Burn by 4 AM tomorrow = it lives.';

  // ── v0.1.2: Milestones & context (one-shot lines) ───────────

  static const String milestoneFirstSummit =
      'The first summit is always the heaviest. You\'ve proven you can climb.';

  static const String milestoneBurnStreak7 =
      'Seven days of tending. The hearth does not forget a faithful hand.';

  static const String milestoneTenBurnsOneDay =
      'Such urgency. The mountain doesn\'t demand speed, only presence.';

  static const String revisitCompletedMountain =
      'You return to familiar peaks. Wisdom lies there.';

  static const String struggleBrokenStreakReturn =
      'The path grows quiet when we leave it. But quiet isn\'t the end—it\'s just waiting.';

  static const String struggleManyIncomplete =
      'Some days, the edge grows dull. That\'s when we sharpen.';

  static const String encouragementDeepWork =
      'Deep work. The mountains reward those who linger.';

  static const String encouragementImpatientSeed =
      'Impatience can be a guide. Strike while the fire burns.';

  static const String encouragementWeekAway =
      'The sanctuary waits. I wait. Return when you\'re ready.';

  static const String firstPeakCreated =
      'A new peak on the map. Name it well—it will remember you.';

  static const String firstStoneBurnedMilestone =
      'The first burn is a vow kept. The path has begun.';

  static const String firstHabitCompleteMilestone =
      'The first edge you sharpen is always the hardest. The path takes note.';
}

/// Ritual reflections for Hearth completion.
/// Prioritization: last-in-mountain > starred > short burn.
class EliasBurnReflections {
  EliasBurnReflections._();

  static final Random _rng = Random();

  static const List<String> _shortBurn = [
    'One more ember for the hearth.',
    'The path is a little clearer now.',
    'A small stone, but it burned bright.',
    'A fine strike. The mountain feels the weight lift.',
  ];

  static const List<String> _starredBurn = [
    'A star falls, and the fire grows warmer for it.',
    'This was a heavy one. Rest by the fire a moment.',
    'You carried that stone a long way. Let it rest now.',
    'The spirit of your journey is bright tonight.',
  ];

  static const List<String> _lastInMountain = [
    'The peak is reached. Look back at the trail you have carved.',
    'No more stones for this journey. The summit is yours.',
    'A mountain conquered. The stars bear witness to your ritual.',
  ];

  static String getReaction({bool isStarred = false, bool isLast = false}) {
    if (isLast) {
      return _lastInMountain[_rng.nextInt(_lastInMountain.length)];
    }
    if (isStarred) {
      return _starredBurn[_rng.nextInt(_starredBurn.length)];
    }
    return _shortBurn[_rng.nextInt(_shortBurn.length)];
  }
}
