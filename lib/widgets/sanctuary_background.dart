import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/app_colors.dart';
import '../core/enums/day_period.dart' show ScenePeriod;
import '../providers/time_of_day_provider.dart';

// ── Background ───────────────────────────────────────────────
// One scene per period with a cinematic cross-fade (2s).
// If an asset fails to load, [errorBuilder] uses period gradients.

/// Matches [ScenePeriod] to bundled time-of-day art (see `pubspec.yaml`).
String _backgroundAssetFor(ScenePeriod period) => switch (period) {
  ScenePeriod.dawn => 'assets/backgrounds/sunrise.jfif',
  ScenePeriod.midday => 'assets/backgrounds/midday.jfif',
  ScenePeriod.sunset => 'assets/backgrounds/dusk.jfif',
  ScenePeriod.night => 'assets/backgrounds/night.jfif',
};

List<Color> _fallbackGradientFor(ScenePeriod period) => switch (period) {
  ScenePeriod.dawn => AppColors.dawnGradient,
  ScenePeriod.midday => AppColors.middayGradient,
  ScenePeriod.sunset => AppColors.sunsetGradient,
  ScenePeriod.night => AppColors.nightGradient,
};

/// Time-of-day sanctuary background with period-aware cinematic cross-fade.
class SanctuaryBackground extends ConsumerWidget {
  const SanctuaryBackground({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;

    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: AnimatedSwitcher(
            duration: const Duration(seconds: 2),
            switchInCurve: Curves.easeInOutCubic,
            switchOutCurve: Curves.easeInOutCubic,
            child: SizedBox.expand(
              key: ValueKey(period),
              child: Image.asset(
                _backgroundAssetFor(period),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    _GradientFallback(colors: _fallbackGradientFor(period)),
              ),
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black26,
                Colors.transparent,
                Colors.transparent,
                Colors.black12,
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _GradientFallback extends StatelessWidget {
  const _GradientFallback({required this.colors});
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: colors,
        ),
      ),
    );
  }
}
