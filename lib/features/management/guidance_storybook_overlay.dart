import 'dart:ui';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/sound_settings_provider.dart';

/// 3-page Storybook overlay explaining Peak → Satchel → Hearth.
/// Shown from Management menu "How the journey works".
class GuidanceStorybookOverlay extends ConsumerStatefulWidget {
  const GuidanceStorybookOverlay({super.key});

  @override
  ConsumerState<GuidanceStorybookOverlay> createState() =>
      _GuidanceStorybookOverlayState();
}

class _GuidanceStorybookOverlayState
    extends ConsumerState<GuidanceStorybookOverlay> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  final AudioPlayer _weightPlayer = AudioPlayer();

  @override
  void dispose() {
    _pageController.dispose();
    _weightPlayer.dispose();
    super.dispose();
  }

  void _playWeightClink() {
    if (!ref.read(soundEnabledProvider)) return;
    _weightPlayer.stop();
    _weightPlayer.play(AssetSource('sounds/weight.mp3')).catchError((_) {
      _weightPlayer.play(AssetSource('sounds/weight.wav')).ignore();
    });
  }

  void _onDone() {
    _playWeightClink();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Material(
        color: Colors.transparent,
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: PageView(
                  controller: _pageController,
                  onPageChanged: (i) => setState(() => _currentPage = i),
                  children: [
                    _StoryPage(
                      icon: Icons.terrain,
                      title: 'The Peak',
                      body:
                          'Define your peaks. Break them into milestones and tasks.',
                    ),
                    _StoryPage(
                      icon: Icons.backpack_outlined,
                      title: 'The Satchel',
                      body:
                          'Pack your chosen tasks. Carry only what matters today.',
                    ),
                    _StoryPage(
                      icon: Icons.local_fire_department,
                      title: 'The Hearth',
                      body:
                          'Offer finished works to the fire. Each stone burned is ground covered.',
                    ),
                  ],
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                  24,
                  16,
                  24,
                  MediaQuery.of(context).padding.bottom + 24,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (_currentPage > 0)
                      TextButton(
                        onPressed: () {
                          _pageController.previousPage(
                            duration: const Duration(milliseconds: 400),
                            curve: Curves.easeInOutCubic,
                          );
                        },
                        child: const Text(
                          'Back',
                          style: TextStyle(
                            fontFamily: 'Georgia',
                            color: AppColors.ashGrey,
                          ),
                        ),
                      )
                    else
                      const SizedBox.shrink(),
                    const Spacer(),
                    TextButton(
                      onPressed: _currentPage < 2
                          ? () {
                              _pageController.nextPage(
                                duration: const Duration(milliseconds: 400),
                                curve: Curves.easeInOutCubic,
                              );
                            }
                          : _onDone,
                      child: Text(
                        _currentPage < 2 ? 'Next' : 'Done',
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.ember,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StoryPage extends StatelessWidget {
  const _StoryPage({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: AppColors.whetPaper.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppColors.slotBorder.withValues(alpha: 0.5),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: AppColors.ember),
            const SizedBox(height: 24),
            Text(
              title,
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 20,
                letterSpacing: 2,
                color: AppColors.whetInk,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                height: 1.6,
                color: AppColors.whetInk,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
