#include <flutter/runtime_effect.glsl>

uniform vec2 uSize;
uniform float uProgress; // 0.0 to 1.0

out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = FlutterFragCoord().xy / uSize;
  float noise = hash(uv * 10.0);
  float threshold = uProgress * 1.2;

  float edge = threshold - (noise * 0.2 + (1.0 - uv.y) * 0.5);

  // White mask with animated alpha for ShaderMask (dstIn).
  float alpha = 1.0;
  if (edge > 0.1) {
    alpha = 0.0; // already burned
  } else if (edge > 0.0) {
    alpha = 0.35; // ember edge
  }

  fragColor = vec4(1.0, 1.0, 1.0, alpha);
}

