import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Keys for context-aware Elias lines (throttle: don't repeat within 2s).
enum EliasContextKey { satchelFull, atMountainCap, returnAfterIdle, tendingSlope }

/// Last time each context line was shown. Used to throttle repeats.
final eliasContextLastSeenProvider =
    StateNotifierProvider<EliasContextNotifier, Map<EliasContextKey, DateTime>>(
  (ref) => EliasContextNotifier(),
);

class EliasContextNotifier
    extends StateNotifier<Map<EliasContextKey, DateTime>> {
  EliasContextNotifier() : super({});

  static const _throttleDuration = Duration(seconds: 2);

  /// Returns true if we should show a line for this context (not throttled).
  bool shouldShow(EliasContextKey key) {
    final last = state[key];
    if (last == null) return true;
    return DateTime.now().difference(last) >= _throttleDuration;
  }

  void markShown(EliasContextKey key) {
    state = {...state, key: DateTime.now()};
  }
}
