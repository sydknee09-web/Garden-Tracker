import 'package:flutter/material.dart';

import '../core/constants/app_colors.dart';

/// Shared parchment card + pill primary button styling for wizard, modals, overlays.
class VoyagerSurface {
  VoyagerSurface._();

  /// Warm cream card: consistent with Climb wizard and Elias dialogs.
  static BoxDecoration parchmentCard({
    double radius = 12,
    double borderWidth = 1,
    Color? borderColor,
    List<BoxShadow>? boxShadow,
  }) {
    return BoxDecoration(
      color: AppColors.whetPaper.withValues(alpha: 0.96),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: borderColor ?? AppColors.whetLine,
        width: borderWidth,
      ),
      boxShadow:
          boxShadow ??
          [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.28),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
    );
  }

  /// Primary CTA: rust fill, parchment label, pill shape (matches Journey wizard intent).
  static ButtonStyle primaryPillButtonStyle({bool onDarkScaffold = false}) {
    return ButtonStyle(
      elevation: const WidgetStatePropertyAll(0),
      shadowColor: const WidgetStatePropertyAll(Colors.transparent),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return AppColors.emberMuted.withValues(alpha: 0.55);
        }
        if (states.contains(WidgetState.pressed)) {
          return AppColors.emberPressed;
        }
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return AppColors.ember.withValues(alpha: 0.92);
        }
        return AppColors.ember;
      }),
      foregroundColor: const WidgetStatePropertyAll(AppColors.parchment),
      overlayColor: WidgetStatePropertyAll(
        AppColors.parchment.withValues(alpha: 0.12),
      ),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: 28, vertical: 14),
      ),
      textStyle: WidgetStatePropertyAll(
        TextStyle(
          fontFamily: 'Georgia',
          fontSize: onDarkScaffold ? 15 : 15,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.9,
          color: AppColors.parchment,
        ),
      ),
    );
  }

  /// Secondary on parchment (wizard nav): ink text, no harsh Material blue.
  static ButtonStyle secondaryOnParchmentStyle() {
    return TextButton.styleFrom(
      foregroundColor: AppColors.whetInk,
      textStyle: const TextStyle(
        fontFamily: 'Georgia',
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.2,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }
}
