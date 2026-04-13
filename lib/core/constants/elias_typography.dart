import 'package:flutter/material.dart';

/// Single source of truth for Elias's voice across Sanctuary, Climb flow,
/// overlays, and any Elias dialogue. Refined Architectural Luxury aesthetic.
class EliasTypography {
  EliasTypography._();

  static const String fontFamily = 'Georgia';
  static const FontStyle fontStyle = FontStyle.italic;
  static const double fontSize = 14;
  static const double height = 1.5;
  static const double letterSpacing = 0.3;

  /// Base style for all Elias speech. Use [style] for color overrides.
  static TextStyle style({Color? color}) => TextStyle(
    fontFamily: fontFamily,
    fontStyle: fontStyle,
    fontSize: fontSize,
    height: height,
    letterSpacing: letterSpacing,
    color: color,
  );
}
