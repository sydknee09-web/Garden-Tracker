import 'dart:async';

import 'package:flutter/material.dart';

import '../core/constants/app_colors.dart';
import 'hearth_spark_painter.dart';

/// Shared loading state: dimmed HearthSparkPainter + "Waiting" (or custom message).
/// Use in Center() on Scroll, Whetstone, Archive for consistent loading UX.
/// GEMINI_RECOMMENDATIONS_BUILD §3 Loading.
class WaitingPulseWidget extends StatefulWidget {
  const WaitingPulseWidget({super.key, this.message = 'Waiting'});

  final String message;

  @override
  State<WaitingPulseWidget> createState() => _WaitingPulseWidgetState();
}

class _WaitingPulseWidgetState extends State<WaitingPulseWidget> {
  double _sparkTime = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (mounted) {
        setState(
          () => _sparkTime = DateTime.now().millisecondsSinceEpoch / 1000.0,
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      height: 100,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 80,
            height: 48,
            child: ExcludeSemantics(
              child: Opacity(
                opacity: 0.4,
                child: CustomPaint(
                  painter: HearthSparkPainter(
                    streak: 1,
                    timeSeconds: _sparkTime * 0.3,
                    origin: const Offset(40, 44),
                    brightnessBoost: 0.6,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            widget.message,
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              letterSpacing: 1,
              color: AppColors.ashGrey,
            ),
          ),
        ],
      ),
    );
  }
}
