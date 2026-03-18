import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

/// Themed error screen shown when the framework hits an uncaught error.
/// Replaces the default red error screen with a Sanctuary-consistent message and Retry.
class SanctuaryErrorWidget extends StatelessWidget {
  const SanctuaryErrorWidget({
    super.key,
    required this.message,
    this.details,
    this.onRetry,
  });

  final String message;
  final String? details;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.inkBlack,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 56,
                color: AppColors.ember.withValues(alpha: 0.9),
              ),
              const SizedBox(height: 24),
              Text(
                'Something went wrong',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 20,
                  color: AppColors.parchment,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 14,
                  color: AppColors.ashGrey,
                  height: 1.4,
                ),
              ),
              if (details != null && details!.isNotEmpty) ...[
                const SizedBox(height: 16),
                SelectableText(
                  details!,
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 11,
                    color: AppColors.ashGrey.withValues(alpha: 0.7),
                    height: 1.3,
                  ),
                ),
              ],
              if (onRetry != null) ...[
                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  label: const Text(
                    'Retry',
                    style: TextStyle(fontFamily: 'Georgia'),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ember,
                    foregroundColor: AppColors.parchment,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
