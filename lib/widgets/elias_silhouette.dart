import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../core/enums/day_period.dart';

// ─────────────────────────────────────────────────────────────
// EliasWidget — time-aware image of the guide Elias.
// Uses real pose assets (elias_dawn.png, etc.) when present;
// falls back to painted silhouette if asset load fails.
// ─────────────────────────────────────────────────────────────

class EliasWidget extends StatelessWidget {
  const EliasWidget({
    super.key,
    required this.period,
    this.width = 64.0,
    this.height = 96.0,
    this.showGreeting = true,
    this.greetingWidth = 160.0,
  });

  final ScenePeriod period;
  final double width;
  final double height;
  final bool showGreeting;
  final double greetingWidth;

  Color get _glowColor => switch (period) {
        ScenePeriod.dawn   => const Color(0xFFD4813A),
        ScenePeriod.midday => AppColors.gold,
        ScenePeriod.sunset => AppColors.ember,
        ScenePeriod.night  => const Color(0xFF3B5DA0),
      };

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Elias figure: real asset or silhouette fallback ──
        SizedBox(
          width: width,
          height: height,
          child: Image.asset(
            period.eliasAssetPath,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => CustomPaint(
              painter: _EliasPainter(
                glowColor: _glowColor,
                period: period,
              ),
            ),
          ),
        ),

        if (showGreeting) ...[
          const SizedBox(height: 8),
          SizedBox(
            width: greetingWidth,
            child: Text(
              period.eliasGreeting,
              style: const TextStyle(
                color: Colors.white60,
                fontSize: 11,
                fontFamily: 'Georgia',
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ── CustomPainter ────────────────────────────────────────────

class _EliasPainter extends CustomPainter {
  const _EliasPainter({
    required this.glowColor,
    required this.period,
  });

  final Color glowColor;
  final ScenePeriod period;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Ambient glow behind figure
    final glowPaint = Paint()
      ..color = glowColor.withValues(alpha: 0.12)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(w * 0.5, h * 0.65),
        width: w * 1.2,
        height: h * 0.8,
      ),
      glowPaint,
    );

    final bodyColor = Color.lerp(
      const Color(0xFF0D0B08),
      glowColor,
      0.08,
    )!;

    final bodyPaint = Paint()
      ..color = bodyColor
      ..style = PaintingStyle.fill;

    // ── Head ──────────────────────────────────────────────
    final headRadius = w * 0.18;
    final headCx = w * 0.5;
    final headCy = h * 0.17;
    canvas.drawCircle(Offset(headCx, headCy), headRadius, bodyPaint);

    // ── Hood / cowl arc ───────────────────────────────────
    final hoodPath = Path();
    hoodPath.moveTo(headCx - headRadius * 1.5, headCy + headRadius * 0.4);
    hoodPath.quadraticBezierTo(
      headCx,
      headCy - headRadius * 1.4,
      headCx + headRadius * 1.5,
      headCy + headRadius * 0.4,
    );
    hoodPath.close();
    canvas.drawPath(hoodPath, bodyPaint);

    // ── Cloak body ────────────────────────────────────────
    final cloakPath = Path();
    final shoulderY = headCy + headRadius * 1.1;
    final cloakTopLeft  = Offset(w * 0.18, shoulderY);
    final cloakTopRight = Offset(w * 0.82, shoulderY);
    final cloakBotLeft  = Offset(w * 0.08, h * 0.97);
    final cloakBotRight = Offset(w * 0.92, h * 0.97);

    cloakPath.moveTo(cloakTopLeft.dx, cloakTopLeft.dy);
    cloakPath.lineTo(cloakTopRight.dx, cloakTopRight.dy);
    cloakPath.quadraticBezierTo(
      cloakBotRight.dx + w * 0.05, h * 0.82,
      cloakBotRight.dx, cloakBotRight.dy,
    );
    cloakPath.lineTo(cloakBotLeft.dx, cloakBotLeft.dy);
    cloakPath.quadraticBezierTo(
      cloakBotLeft.dx - w * 0.05, h * 0.82,
      cloakTopLeft.dx, cloakTopLeft.dy,
    );
    cloakPath.close();
    canvas.drawPath(cloakPath, bodyPaint);

    // ── Subtle centre line on cloak ───────────────────────
    final linePaint = Paint()
      ..color = glowColor.withValues(alpha: 0.18)
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(w * 0.5, shoulderY + 4),
      Offset(w * 0.5, h * 0.92),
      linePaint,
    );

    // ── Period indicator dot (tiny) ───────────────────────
    final dotPaint = Paint()
      ..color = glowColor.withValues(alpha: 0.6);
    canvas.drawCircle(Offset(w * 0.5, h * 0.97), 2.5, dotPaint);
  }

  @override
  bool shouldRepaint(_EliasPainter oldDelegate) =>
      oldDelegate.period != period;
}
