import 'package:flutter/material.dart';

/// Refined Architectural Luxury color palette.
/// Marble, aged leather, boucle, worn parchment.
/// Deep neutrals, gold/ember accents. No bright colors.
class AppColors {
  AppColors._();

  // Core neutrals
  static const Color inkBlack = Color(
    0xFF1A1612,
  ); // near-black with warm undertone
  static const Color charcoal = Color(0xFF2C2825);
  static const Color warmGrey = Color(0xFF5C554E);
  static const Color ashGrey = Color(0xFF8C857E);
  static const Color parchment = Color(0xFFEDE3D4); // base background / scroll
  static const Color ivoryWhite = Color(0xFFF5F0E8);

  // Accent: ember/hearth (locked beta palette — warm rust, not Material orange)
  static const Color ember = Color(
    0xFFC26D2B,
  ); // primary actions, hearth highlights
  static const Color emberPressed = Color(0xFF9A5420); // pressed / darker rust
  static const Color emberMuted = Color(
    0xFF7A4320,
  ); // disabled primary (still warm)
  static const Color gold = Color(0xFFC9A84C); // stars, highlights
  static const Color goldenLight = Color(0xFFE8C87A);

  // Time-of-day gradient pairs (top → bottom) — fallback when no image asset
  static const List<Color> dawnGradient = [
    Color(0xFF1F1208),
    Color(0xFF7A3B1E),
    Color(0xFFD4813A),
  ];
  static const List<Color> middayGradient = [
    Color(0xFF3D5A73),
    Color(0xFF8BA7BC),
    Color(0xFFD4C9B0),
  ];
  static const List<Color> sunsetGradient = [
    Color(0xFF1A0A05),
    Color(0xFF6B2810),
    Color(0xFFCC5500),
  ];
  static const List<Color> nightGradient = [
    Color(0xFF05060F),
    Color(0xFF0D1526),
    Color(0xFF1A2540),
  ];

  /// Multiply overlay for watercolor background (BlendMode.multiply).
  /// Midday = no tint; sunset = deep autumn; night = indigo/charcoal.
  static const Color periodOverlayMidday = Color(0xFFFFFFFF);
  static const Color periodOverlayDawn = Color(0xFFE8D4B0);
  static const Color periodOverlaySunset = Color(0xFF5C2A0A);
  static const Color periodOverlayNight = Color(0xFF0D1526);

  // Satchel slot colors
  static const Color slotFilled = Color(0xFF3D342C);
  static const Color slotEmpty = Color(0xFF231E1A);
  static const Color slotBorder = Color(0xFF5C4F3F);

  /// Warm brown variants for Satchel (matches wood plank background).
  /// Empty slots: parchment-tinted background so they blend with wood (not harsh dark).
  static const Color satchelSlotEmpty = Color(
    0xFFB8A890,
  ); // warm parchment / light tan
  static const Color satchelSlotEmptyInk = Color(
    0xFF5C4F3F,
  ); // readable label on parchment
  static const Color satchelSlotFilled = Color(0xFF4A3D2E); // warm wood brown
  static const Color satchelSlotBorder = Color(0xFF6B5A45); // warm brown border
  static const Color satchelTileBg = Color(0xFF4A3D2E); // Map/Whetstone tiles

  // Whetstone parchment
  static const Color whetPaper = Color(0xFFE8DAC5);
  static const Color whetInk = Color(0xFF2C2010);
  static const Color whetLine = Color(0xFFBFAD94);

  /// Deep warm espresso for Sanctuary icon/label legibility on pale watercolor.
  static const Color sanctuaryIcon = Color(0xFF2E2419);

  /// Semantic alias for interactive text and button labels. Avoid ashGrey on cream.
  static const Color darkWalnut = sanctuaryIcon;

  /// Night period: soft amber glow (candlelight-on-parchment).
  static const Color candlelightTint = Color(0x15FFB300);
}
