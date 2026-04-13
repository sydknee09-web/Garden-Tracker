/// Centralized copy for connection/offline states and retry.
/// Use on Scroll, Satchel, Whetstone, Archive for consistent messaging.
/// GEMINI_RECOMMENDATIONS_BUILD §3 Offline.
class OfflineCopy {
  OfflineCopy._();

  /// Generic: can't reach the service. Check connection and retry.
  static const String checkConnection = 'Check your connection.';

  /// Scroll: map/mountains failed to load.
  static const String scrollConnectionMessage =
      "Can't connect to Sanctuary.\n$checkConnection";

  /// Archive: chronicles failed to load.
  static const String archiveConnectionMessage =
      "Can't load the chronicles. $checkConnection";

  /// Whetstone: habit add/save failed.
  static const String whetstoneConnectionMessage =
      "Couldn't add habit. $checkConnection";

  /// Auth: sign-in/sign-up server unreachable.
  static const String authConnectionMessage =
      "Can't reach the server. Check your internet connection and try again.";

  /// Retry button label (shared).
  static const String retry = 'Retry';
}
