import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../onboarding/elias_intro_overlay.dart';

/// Intro screen: full 5-beat Elias intro → New Journey Wizard → Whetstone setup.
/// Shown when has_seen_elias_intro is false. PopScope prevents back.
class IntroScreen extends ConsumerWidget {
  const IntroScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const EliasIntroOverlay();
  }
}
