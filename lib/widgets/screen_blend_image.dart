import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Composites [child] onto the backdrop using [BlendMode.screen].
///
/// Black (0,0,0) pixels let the content behind show through — useful for
/// scroll / illustration art exported on a black matte.
class ScreenBlendComposite extends SingleChildRenderObjectWidget {
  const ScreenBlendComposite({super.key, required Widget super.child});

  @override
  RenderObject createRenderObject(BuildContext context) =>
      RenderScreenBlendComposite();
}

class RenderScreenBlendComposite extends RenderProxyBox {
  RenderScreenBlendComposite();

  @override
  void paint(PaintingContext context, Offset offset) {
    if (child == null) return;
    final size = child!.size;
    final rect = offset & size;
    context.canvas.saveLayer(
      rect,
      Paint()..blendMode = BlendMode.screen,
    );
    context.paintChild(child!, offset);
    context.canvas.restore();
  }
}
