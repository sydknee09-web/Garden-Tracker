import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Applies a shader-driven dissolve mask to the child while [isBurning] is true.
/// Used by the Hearth so burn completion feels ritual and tactile.
class HearthBurnWidget extends StatefulWidget {
  const HearthBurnWidget({
    super.key,
    required this.child,
    required this.isBurning,
    required this.onComplete,
  });

  final Widget child;
  final bool isBurning;
  final VoidCallback onComplete;

  @override
  State<HearthBurnWidget> createState() => _HearthBurnWidgetState();
}

class _HearthBurnWidgetState extends State<HearthBurnWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  FragmentShader? _shader;

  @override
  void initState() {
    super.initState();
    _controller =
        AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 1200),
        )..addStatusListener((status) {
          if (status == AnimationStatus.completed) {
            widget.onComplete();
          }
        });
    _loadShader();
  }

  Future<void> _loadShader() async {
    try {
      final program = await FragmentProgram.fromAsset(
        'shaders/hearth_burn.frag',
      );
      if (!mounted) return;
      setState(() => _shader = program.fragmentShader());
    } catch (_) {
      // Graceful fallback: child renders normally if shader is unavailable.
    }
  }

  @override
  void didUpdateWidget(covariant HearthBurnWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isBurning && !oldWidget.isBurning) {
      HapticFeedback.mediumImpact();
      _controller.forward(from: 0);
    } else if (!widget.isBurning && oldWidget.isBurning) {
      _controller.reset();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_shader == null || !widget.isBurning) {
      return widget.child;
    }

    // Keep the final dissolve frame until [isBurning] goes false — avoids the
    // fire "snapping" back to full opacity while the burn is still finalizing.
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.status == AnimationStatus.completed
            ? 1.0
            : _controller.value.clamp(0.0, 1.0);
        return ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (rect) {
            _shader!
              ..setFloat(0, rect.width)
              ..setFloat(1, rect.height)
              ..setFloat(2, t);
            return _shader!;
          },
          child: widget.child,
        );
      },
    );
  }
}
