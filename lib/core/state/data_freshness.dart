import 'dart:async';

import 'package:flutter/foundation.dart';

/// Tracks whether the app is currently showing cached (stale) data.
/// Uses a 3-second grace period after the last fresh fetch before clearing,
/// so rapid successive fetches don't cause flicker.
class DataFreshness extends ChangeNotifier {
  DataFreshness._();
  static final DataFreshness instance = DataFreshness._();

  bool _isShowingCachedData = false;
  Timer? _clearTimer;

  bool get isShowingCachedData => _isShowingCachedData;

  /// Called when data was served from cache.
  void onCacheHit() {
    _clearTimer?.cancel();
    _clearTimer = null;
    if (!_isShowingCachedData) {
      _isShowingCachedData = true;
      notifyListeners();
    }
  }

  /// Called when fresh data was fetched. Starts a 3-second timer;
  /// only clears after the delay (or when the next fresh fetch restarts it).
  void onFreshFetch() {
    _clearTimer?.cancel();
    _clearTimer = Timer(const Duration(milliseconds: 3000), () {
      if (_isShowingCachedData) {
        _isShowingCachedData = false;
        notifyListeners();
      }
      _clearTimer = null;
    });
  }

}
