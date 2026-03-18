import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

/// Lightweight campfire sparks driven by burn streak.
/// Uses Curves.easeOut so intensity rises at low streaks and tapers at high.
/// Tiny gold pixels drift upward and fade — "Estate Luxury" aesthetic.
class HearthSparkPainter extends CustomPainter {
  HearthSparkPainter({
    required this.streak,
    required this.timeSeconds,
    required this.origin,
    this.brightnessBoost = 1.0,
  });

  final int streak;
  final double timeSeconds;
  final Offset origin;

  /// Multiplier for spark intensity when stone is hovering over Hearth (e.g. 1.5).
  final double brightnessBoost;

  static const _divisor = 14.0;
  static const _particleCount = 18;
  static const _baseLifespan = 1.2;
  static const _maxLifespan = 2.8;
  static const _baseSpeed = 25.0;
  static const _maxSpeed = 85.0;
  static const _horizontalSpread = 12.0;

  @override
  void paint(Canvas canvas, Size size) {
    final scalar = Curves.easeOut.transform((streak / _divisor).clamp(0.0, 1.0));
    if (scalar < 0.05) return;

    final count = (3 + scalar * (_particleCount - 3)).round();
    final lifespan = _baseLifespan + scalar * (_maxLifespan - _baseLifespan);
    final speed = _baseSpeed + scalar * (_maxSpeed - _baseSpeed);

    final paint = Paint()..color = AppColors.gold;

    for (var i = 0; i < count; i++) {
      final phase = (i / count) * lifespan;
      final age = (timeSeconds + phase) % lifespan;

      final opacity = (1 - age / lifespan).clamp(0.0, 1.0);
      final yOffset = -age * speed;
      final jitter = math.sin(timeSeconds * 2 + i) * 3;
      final spread = math.sin((i * 1.7) + timeSeconds * 0.5) * _horizontalSpread * scalar;
      final x = origin.dx + jitter + spread;
      final y = origin.dy + yOffset;

      paint.color = AppColors.gold.withValues(alpha: (opacity * 0.9 * brightnessBoost).clamp(0.0, 1.0));
      canvas.drawRect(Rect.fromCenter(center: Offset(x, y), width: 2, height: 2), paint);
    }
  }

  @override
  bool shouldRepaint(covariant HearthSparkPainter oldDelegate) =>
      oldDelegate.streak != streak ||
      oldDelegate.timeSeconds != timeSeconds ||
      oldDelegate.origin != origin ||
      oldDelegate.brightnessBoost != brightnessBoost;
}
