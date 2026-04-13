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
                widget.message.substring(
                  0,
                  _visibleLength.clamp(0, widget.message.length),
                ),
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

/// Cinematic post-auth arrival wrapper.
/// Keeps the destination mounted underneath while the forest threshold fades out.
class ForestThresholdWrapper extends StatefulWidget {
  const ForestThresholdWrapper({
    super.key,
    required this.child,
    required this.isDataReady,
    this.assetPath = 'assets/backgrounds/forest_threshold.png',
  });

  final Widget child;
  final bool isDataReady;
  final String assetPath;

  @override
  State<ForestThresholdWrapper> createState() => _ForestThresholdWrapperState();
}

class _ForestThresholdWrapperState extends State<ForestThresholdWrapper> {
  bool _isFaded = false;

  @override
  void didUpdateWidget(covariant ForestThresholdWrapper oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isDataReady && !oldWidget.isDataReady) {
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) {
          setState(() => _isFaded = true);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        IgnorePointer(
          ignoring: _isFaded,
          child: AnimatedOpacity(
            opacity: _isFaded ? 0.0 : 1.0,
            duration: const Duration(milliseconds: 2500),
            curve: Curves.easeInOutCubic,
            child: Container(
              color: const Color(0xFF1B2412),
              child: AnimatedScale(
                scale: _isFaded ? 1.1 : 1.0,
                duration: const Duration(milliseconds: 3000),
                curve: Curves.easeInOutCubic,
                child: Image.asset(
                  widget.assetPath,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  errorBuilder: (_, __, ___) => const SizedBox.expand(),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
