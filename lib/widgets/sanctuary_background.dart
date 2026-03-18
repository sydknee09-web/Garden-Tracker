import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/app_colors.dart';
import '../core/enums/day_period.dart' show ScenePeriod;
import '../providers/time_of_day_provider.dart';

// ── Background ───────────────────────────────────────────────
//
// Four time-of-day layers stacked and cross-faded by opacity (30-min transition).
// Per-period assets: sunrise, midday, dusk, night. Gradient fallback when missing.

const int _blendWindowMinutes = 30;

/// Returns [opacityDawn, opacityMidday, opacitySunset, opacityNight] that sum to 1.
/// Blends over the last [_blendWindowMinutes] of each period.
List<double> _backgroundOpacitiesFor(DateTime now) {
  final h = now.hour;
  final m = now.minute.toDouble();

  double dawn = 0, midday = 0, sunset = 0, night = 0;

  // Dawn 5-10 (300 min). Last 30 min: blend to midday.
  if (h >= 5 && h < 10) {
    final minIntoDawn = (h - 5) * 60 + m;
    if (minIntoDawn >= 270) {
      final t = (minIntoDawn - 270) / _blendWindowMinutes;
      dawn = 1 - t;
      midday = t;
    } else {
      dawn = 1;
    }
  }
  // Midday 10-17 (420 min). Last 30 min: blend to sunset.
  else if (h >= 10 && h < 17) {
    final minIntoMidday = (h - 10) * 60 + m;
    if (minIntoMidday >= 390) {
      final t = (minIntoMidday - 390) / _blendWindowMinutes;
      midday = 1 - t;
      sunset = t;
    } else {
      midday = 1;
    }
  }
  // Sunset 17-20 (180 min). Last 30 min: blend to night.
  else if (h >= 17 && h < 20) {
    final minIntoSunset = (h - 17) * 60 + m;
    if (minIntoSunset >= 150) {
      final t = (minIntoSunset - 150) / _blendWindowMinutes;
      sunset = 1 - t;
      night = t;
    } else {
      sunset = 1;
    }
  }
  // Night 20-5 (540 min). Last 30 min: blend to dawn.
  else {
    final minIntoNight = h >= 20 ? (h - 20) * 60 + m : (h + 4) * 60 + m;
    if (minIntoNight >= 510) {
      final t = (minIntoNight - 510) / _blendWindowMinutes;
      night = 1 - t;
      dawn = t;
    } else {
      night = 1;
    }
  }

  return [dawn, midday, sunset, night];
}

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

/// Time-of-day sanctuary background: four period layers with 30-min opacity blend,
/// asset images with gradient fallback, and a subtle top/bottom vignette.
/// Single source of truth for Sanctuary, intro overlay, and entrance screen.
class SanctuaryBackground extends ConsumerWidget {
  const SanctuaryBackground({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(currentTimeForBackgroundProvider).valueOrNull ?? DateTime.now();
    final opacities = _backgroundOpacitiesFor(now);
    const periods = [ScenePeriod.dawn, ScenePeriod.midday, ScenePeriod.sunset, ScenePeriod.night];

    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < 4; i++)
          if (opacities[i] > 0)
            Positioned.fill(
              child: Opacity(
                opacity: opacities[i].clamp(0.0, 1.0),
                child: Image.asset(
                  _backgroundAssetFor(periods[i]),
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      _GradientFallback(colors: _fallbackGradientFor(periods[i])),
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
