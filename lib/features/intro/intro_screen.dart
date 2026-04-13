import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../onboarding/elias_intro_overlay.dart';

/// Intro screen: full 5-beat Elias intro → New Journey Wizard → Whetstone setup.
/// Shown when has_seen_elias_intro is false. PopScope prevents back.
///
/// Query `postForest=1` when [ForestCrossroadsWelcomeScreen] already showed beat 1.
class IntroScreen extends ConsumerWidget {
  const IntroScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final postForest =
        GoRouterState.of(context).uri.queryParameters['postForest'] == '1';
    return EliasIntroOverlay(skipIntroBeat1: postForest);
  }
}
