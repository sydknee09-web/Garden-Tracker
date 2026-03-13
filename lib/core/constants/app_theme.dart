import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.inkBlack,
    colorScheme: const ColorScheme.dark(
      primary:   AppColors.ember,
      secondary: AppColors.gold,
      surface:   AppColors.charcoal,
      onPrimary: AppColors.ivoryWhite,
      onSurface: AppColors.parchment,
    ),
    textTheme: _textTheme,
    iconTheme: const IconThemeData(color: AppColors.ashGrey, size: 22),
    dividerColor: AppColors.slotBorder,
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
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
      fontSize: 11,
      fontWeight: FontWeight.w500,
      color: AppColors.ashGrey,
      letterSpacing: 0.8,
    ),
  );
}
