import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The current message Elias is "saying."
/// Null = no bubble visible.
/// Set this to show a speech bubble; the bubble auto-clears after 4 seconds.
final eliasMessageProvider = StateProvider<String?>((ref) => null);

/// True once we've shown the period greeting on first Sanctuary load this session.
final hasShownSessionGreetingProvider = StateProvider<bool>((ref) => false);
