import 'package:flutter/material.dart';

/// Reveals [text] character by character over [duration] for a typewriter effect.
/// When [onTap] is set, tap during animation skips to full text; tap when complete calls [onTap].
class TypewriterText extends StatefulWidget {
  const TypewriterText({
    super.key,
    required this.text,
    required this.style,
    this.duration = const Duration(milliseconds: 1200),
    this.curve = Curves.easeOutCubic,
    this.onTap,
  });

  final String text;
  final TextStyle style;
  final Duration duration;
  final Curve curve;

  /// When user taps and animation is complete, this is called. Omit to not handle taps.
  final VoidCallback? onTap;

  @override
  State<TypewriterText> createState() => _TypewriterTextState();
}

class _TypewriterTextState extends State<TypewriterText>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = CurvedAnimation(parent: _controller, curve: widget.curve);
    _controller.forward();
  }

  @override
  void didUpdateWidget(TypewriterText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text ||
        oldWidget.duration != widget.duration) {
      _controller.duration = widget.duration;
      _controller.reset();
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTap() {
    if (_controller.value < 1.0) {
      _controller.animateTo(1.0, duration: Duration.zero);
    } else {
      widget.onTap?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = AnimatedBuilder(
      animation: _animation,
      builder: (context, _) {
        final len = widget.text.length;
        final visible = (_animation.value * len).round().clamp(0, len);
        return Text(
          widget.text.substring(0, visible),
          style: widget.style,
          key: ValueKey(widget.text),
        );
      },
    );
    if (widget.onTap != null) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _onTap,
        child: child,
      );
    }
    return child;
  }
}
