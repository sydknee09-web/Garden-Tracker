import 'dart:async';

import 'package:flutter/material.dart';

/// Forest Threshold — cold-start loading placeholder.
/// Strategic placeholder: lush green gradient + typewriter text.
/// Swap [assetPath] when forest image asset is ready.
class ForestThreshold extends StatefulWidget {
  const ForestThreshold({
    super.key,
    this.message = 'Descending into the sanctuary...',
    this.assetPath,
    this.slowMode = false,
  });

  /// Typewriter message shown during load.
  final String message;

  /// Optional forest image path. When null, uses gradient placeholder.
  final String? assetPath;

  /// Slower typewriter for first-time users (has_seen_elias_intro = false).
  final bool slowMode;

  @override
  State<ForestThreshold> createState() => _ForestThresholdState();
}

class _ForestThresholdState extends State<ForestThreshold> {
  int _visibleLength = 0;

  @override
  void initState() {
    super.initState();
    _runTypewriter();
  }

  Future<void> _runTypewriter() async {
    final delay = widget.slowMode ? 80 : 40;
    for (var i = 0; i <= widget.message.length && mounted; i++) {
      setState(() => _visibleLength = i);
      await Future<void>.delayed(Duration(milliseconds: delay));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF0D2818),
            Color(0xFF1B4332),
            Color(0xFF2D6A4F),
            Color(0xFF1B4332),
          ],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (widget.assetPath != null)
            Image.asset(
              widget.assetPath!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox.expand(),
            )
          else
            const SizedBox.expand(),
          // Gradient overlay for readability
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.3),
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.5),
                ],
              ),
            ),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                widget.message.substring(0, _visibleLength.clamp(0, widget.message.length)),
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 18,
                  color: Color(0xFFD8E2DC),
                  height: 1.5,
                  letterSpacing: 1,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
