import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.inkBlack,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.ember,
      secondary: AppColors.gold,
      surface: AppColors.charcoal,
      onPrimary: AppColors.parchment,
      onSurface: AppColors.parchment,
      onSurfaceVariant: AppColors.ashGrey,
    ),
    textTheme: _textTheme,
    iconTheme: const IconThemeData(color: AppColors.ashGrey, size: 22),
    dividerColor: AppColors.slotBorder,
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
    // Global primary actions: rust pill + parchment serif (Journey wizard aesthetic).
    filledButtonTheme: FilledButtonThemeData(
      style: ButtonStyle(
        elevation: const WidgetStatePropertyAll(0),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return AppColors.emberMuted.withValues(alpha: 0.5);
          }
          if (states.contains(WidgetState.pressed)) {
            return AppColors.emberPressed;
          }
          return AppColors.ember;
        }),
        foregroundColor: const WidgetStatePropertyAll(AppColors.parchment),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 28, vertical: 14),
        ),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(
            fontFamily: 'Georgia',
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.85,
          ),
        ),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ButtonStyle(
        elevation: const WidgetStatePropertyAll(0),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return AppColors.emberMuted.withValues(alpha: 0.5);
          }
          if (states.contains(WidgetState.pressed)) {
            return AppColors.emberPressed;
          }
          return AppColors.ember;
        }),
        foregroundColor: const WidgetStatePropertyAll(AppColors.parchment),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 28, vertical: 14),
        ),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(
            fontFamily: 'Georgia',
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.85,
          ),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.ember,
        textStyle: const TextStyle(
          fontFamily: 'Georgia',
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.4,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.parchment,
        side: const BorderSide(color: AppColors.slotBorder, width: 1),
        textStyle: const TextStyle(
          fontFamily: 'Georgia',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.whetPaper,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.whetLine, width: 1),
      ),
      titleTextStyle: const TextStyle(
        fontFamily: 'Georgia',
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.whetInk,
        height: 1.35,
      ),
      contentTextStyle: const TextStyle(
        fontFamily: 'Georgia',
        fontSize: 14,
        height: 1.5,
        color: AppColors.darkWalnut,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.whetPaper.withValues(alpha: 0.95),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.whetLine, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.charcoal,
      contentTextStyle: const TextStyle(
        fontFamily: 'Georgia',
        color: AppColors.parchment,
        fontSize: 14,
      ),
      behavior: SnackBarBehavior.floating,
    ),
    textSelectionTheme: TextSelectionThemeData(
      selectionColor: AppColors.ember.withValues(alpha: 0.28),
      cursorColor: AppColors.ember,
      selectionHandleColor: AppColors.ember,
    ),
  );

  static const TextTheme _textTheme = TextTheme(
    // Large display — mountain names, screen titles
    displayLarge: TextStyle(
      fontFamily: 'Georgia',
      fontSize: 28,
      fontWeight: FontWeight.w400,
      color: AppColors.ivoryWhite,
      letterSpacing: 0.5,
    ),
    // Section headers — boulder names, satchel header
    headlineMedium: TextStyle(
      fontFamily: 'Georgia',
      fontSize: 18,
      fontWeight: FontWeight.w400,
      color: AppColors.parchment,
      letterSpacing: 0.3,
    ),
    // Body — node titles, habit items
    bodyLarge: TextStyle(
      fontFamily: 'Georgia',
      fontSize: 15,
      fontWeight: FontWeight.w400,
      color: AppColors.parchment,
      height: 1.5,
    ),
    bodyMedium: TextStyle(
      fontFamily: 'Georgia',
      fontSize: 13,
      color: AppColors.ashGrey,
      height: 1.4,
    ),
    // Labels — due dates, metadata badges
    labelSmall: TextStyle(
      fontFamily: 'Georgia',
      fontSize: 11,
      fontWeight: FontWeight.w500,
      color: AppColors.ashGrey,
      letterSpacing: 0.8,
    ),
  );
}
