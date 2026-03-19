import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/enums/day_period.dart' show ScenePeriod;
import '../../core/content/elias_dialogue.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';

/// In-world overlay when the user taps the Whetstone tile in the Satchel.
/// Offers a single action: Sharpen Habits (→ /whetstone). Refine/Edit is on the Map (Peak Detail).
/// BackdropFilter (watercolor blur) so the Satchel fades back; Elias + parchment
/// bubble anchored near the Whetstone tile. Bubble tail points at Whetstone icon via GlobalKey + post-frame callback.
class WhetstoneChoiceOverlay extends ConsumerStatefulWidget {
  const WhetstoneChoiceOverlay({
    super.key,
    required this.whetstoneKey,
    required this.anchorOffset,
    required this.tileSize,
    required this.onDismiss,
  });

  /// GlobalKey on the Whetstone tile for tail anchor (post-frame position).
  final GlobalKey whetstoneKey;
  /// Global offset of the Whetstone tile (top-left) so Elias + bubble sit near it.
  final Offset anchorOffset;
  final Size tileSize;
  final VoidCallback onDismiss;

  @override
  ConsumerState<WhetstoneChoiceOverlay> createState() =>
      _WhetstoneChoiceOverlayState();
}

class _WhetstoneChoiceOverlayState extends ConsumerState<WhetstoneChoiceOverlay> {
  Offset? _tailTipOffset;
  Timer? _idleTimer;

  @override
  void initState() {
    super.initState();
    SchedulerBinding.instance.addPostFrameCallback((_) => _updateTailPosition());
    _idleTimer = Timer(const Duration(seconds: 30), () {
      if (mounted) {
        widget.onDismiss();
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.returnAfterIdle(),
              style: const TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
            ),
            backgroundColor: AppColors.charcoal,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _idleTimer?.cancel();
    super.dispose();
  }

  void _updateTailPosition() {
    final box = widget.whetstoneKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final topLeft = box.localToGlobal(Offset.zero);
    final center = Offset(
      topLeft.dx + box.size.width / 2,
      topLeft.dy + box.size.height / 2,
    );
    if (mounted) setState(() => _tailTipOffset = center);
  }

  @override
  Widget build(BuildContext context) {
    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    final screenSize = MediaQuery.sizeOf(context);

    // Position content above the Whetstone tile, centered relative to the tile.
    const double contentWidth = 280;
    const double eliasHeight = 100;
    const double bubbleSpacing = 8;
    const double buttonHeight = 44;
    const double bubbleVerticalPadding = 20;
    const double totalBubbleHeight = 80 + bubbleVerticalPadding * 2 + buttonHeight + 12 + 36;
    const double totalContentHeight = eliasHeight + bubbleSpacing + totalBubbleHeight;

    double left = widget.anchorOffset.dx + (widget.tileSize.width / 2) - (contentWidth / 2);
    left = left.clamp(16.0, screenSize.width - contentWidth - 16);
    double top = widget.anchorOffset.dy - totalContentHeight - 24;
    if (top < 40) top = 40;

    final isNight = period == ScenePeriod.night;

    return Stack(
      fit: StackFit.expand,
      children: [
        // 1. Watercolor blur — Satchel fades into background, Elias steps forward
        GestureDetector(
          onTap: () {
            _idleTimer?.cancel();
            widget.onDismiss();
          },
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
              child: Container(
                color: AppColors.inkBlack.withValues(alpha: 0.4),
              ),
            ),
          ),
        ),
        if (isNight)
          Positioned.fill(
            child: IgnorePointer(
              child: Container(
                color: AppColors.candlelightTint,
              ),
            ),
          ),
        // 2. Bubble tail (points at Whetstone icon center)
        if (_tailTipOffset != null)
          Positioned.fill(
            child: CustomPaint(
              painter: _BubbleTailPainter(
                bubbleBottomCenter: Offset(left + contentWidth / 2, top + totalContentHeight),
                tailTip: _tailTipOffset!,
              ),
            ),
          ),
        // 3. Elias + bubble anchored near the Whetstone tile
        Positioned(
          left: left,
          top: top,
          width: contentWidth,
          child: GestureDetector(
            onTap: () {}, // absorb tap so tapping content doesn't dismiss
            child: _PopContent(
              period: period,
              onSharpenHabits: () {
                _idleTimer?.cancel();
                widget.onDismiss();
                context.push(AppRoutes.whetstone);
              },
              onDismiss: () {
                _idleTimer?.cancel();
                widget.onDismiss();
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// Draws a parchment-colored bubble tail pointing at the Whetstone icon.
/// Tip has slight rounding for organic feel.
class _BubbleTailPainter extends CustomPainter {
  _BubbleTailPainter({
    required this.bubbleBottomCenter,
    required this.tailTip,
  });

  final Offset bubbleBottomCenter;
  final Offset tailTip;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.whetPaper
      ..style = PaintingStyle.fill;

    const baseWidth = 20.0;

    final dx = tailTip.dx - bubbleBottomCenter.dx;
    final dy = tailTip.dy - bubbleBottomCenter.dy;

    final perp = Offset(-dy, dx);
    final len = math.sqrt(perp.dx * perp.dx + perp.dy * perp.dy);
    final unit = len > 0.001
        ? Offset(perp.dx / len, perp.dy / len)
        : const Offset(1, 0);

    final baseLeft = bubbleBottomCenter + unit * (baseWidth / 2);
    final baseRight = bubbleBottomCenter - unit * (baseWidth / 2);

    final path = Path()
      ..moveTo(baseLeft.dx, baseLeft.dy)
      ..lineTo(baseRight.dx, baseRight.dy)
      ..lineTo(tailTip.dx, tailTip.dy)
      ..close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _BubbleTailPainter oldDelegate) =>
      oldDelegate.bubbleBottomCenter != bubbleBottomCenter ||
      oldDelegate.tailTip != tailTip;
}

class _PopContent extends StatelessWidget {
  const _PopContent({
    required this.period,
    required this.onSharpenHabits,
    required this.onDismiss,
  });

  final ScenePeriod period;
  final VoidCallback onSharpenHabits;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Elias head/shoulders — pop scale 0.95 → 1.05 → 1.0
        SizedBox(
          height: 100,
          child: Center(
            child: EliasWidget(
              period: period,
              width: 80,
              height: 100,
              showGreeting: false,
            ),
          ),
        )
            .animate()
            .scale(
              begin: const Offset(0.95, 0.95),
              end: const Offset(1.0, 1.0),
              curve: Curves.easeOutBack,
              duration: 280.ms,
            )
            .then()
            .scale(
              begin: const Offset(1.0, 1.0),
              end: const Offset(1.05, 1.05),
              duration: 120.ms,
            )
            .then()
            .scale(
              begin: const Offset(1.05, 1.05),
              end: const Offset(1.0, 1.0),
              duration: 180.ms,
            ),
        const SizedBox(height: 8),
        // Parchment bubble with copy + Sharpen Habits + Close
        Container(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
          decoration: BoxDecoration(
            color: AppColors.whetPaper,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine, width: 1),
            boxShadow: [
              BoxShadow(
                color: AppColors.inkBlack.withValues(alpha: 0.35),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                EliasDialogue.whetstoneEntry(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 15,
                  color: AppColors.whetInk,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                height: 44,
                child: FilledButton(
                  onPressed: onSharpenHabits,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ember,
                    foregroundColor: AppColors.parchment,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Sharpen Habits',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: onDismiss,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.ashGrey,
                ),
                child: const Text(
                  'Close',
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
        )
            .animate()
            .scale(
              begin: const Offset(0.95, 0.95),
              end: const Offset(1.0, 1.0),
              curve: Curves.easeOutBack,
              duration: 280.ms,
              delay: 80.ms,
            )
            .then()
            .scale(
              begin: const Offset(1.0, 1.0),
              end: const Offset(1.05, 1.05),
              duration: 120.ms,
            )
            .then()
            .scale(
              begin: const Offset(1.05, 1.05),
              end: const Offset(1.0, 1.0),
              duration: 180.ms,
            ),
      ],
    );
  }
}
