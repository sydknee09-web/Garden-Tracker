import 'dart:math';

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
    'The mountain remembers.',
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
    'No stones chosen. Visit the Scroll.',
  ];

  static const List<String> _onTap = [
    'The fire holds as long as you tend it.',
    'You are further along than you think.',
    'The summit does not move. You do.',
    'Each stone burned is ground covered.',
    'Patience and progress are the same thing.',
    'You returned. That is enough for now.',
  ];

  // ── Private helper ─────────────────────────────────────────

  static String _pick(List<String> pool) =>
      pool[_rng.nextInt(pool.length)];

  // ── Public accessors ───────────────────────────────────────

  /// Spoken after a stone is burned in the Hearth.
  static String afterBurn() => _pick(_afterBurn);

  /// Spoken after the Satchel is packed.
  static String afterPack() => _pick(_afterPack);

  /// Spoken when the user opens the Satchel and it is empty.
  static String emptySatchel() => _pick(_emptySatchel);

  /// Spoken when the user taps Elias directly.
  static String onTap() => _pick(_onTap);
}
