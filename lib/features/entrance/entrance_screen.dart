import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/config/supabase_config.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/elias_typography.dart';
import '../../core/enums/day_period.dart'
    show ScenePeriod, ScenePeriodExtension;
import '../../providers/auth_provider.dart';
import '../../providers/sound_settings_provider.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';
import '../../widgets/sanctuary_background.dart';

/// Shared player for app-open snap so playback continues after navigating off splash.
final AudioPlayer _appOpenPlayer = AudioPlayer();

class EntranceScreen extends ConsumerStatefulWidget {
  const EntranceScreen({super.key});

  @override
  ConsumerState<EntranceScreen> createState() => _EntranceScreenState();
}

class _EntranceScreenState extends ConsumerState<EntranceScreen> {
  @override
  void initState() {
    super.initState();
    // Navigate after splash. Play parchment snap at exact moment splash finishes and Sanctuary fades in.
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      final isAuthenticated =
          kSkipAuthForTesting || ref.read(isAuthenticatedProvider);
      if (isAuthenticated) {
        _appOpenPlayer.stop();
        if (ref.read(soundEnabledProvider)) {
          _appOpenPlayer.play(AssetSource('sounds/app_open.mp3')).catchError((
            _,
          ) {
            _appOpenPlayer.play(AssetSource('sounds/app_open.wav')).ignore();
          });
        }
      }
      context.go(isAuthenticated ? AppRoutes.profileGate : AppRoutes.auth);
    });
  }

  @override
  Widget build(BuildContext context) {
    final periodAsync = ref.watch(timeOfDayProvider);

    return periodAsync.when(
      data: (period) => _buildEntrance(period),
      loading: () => _buildEntrance(
        DateTime.now().hour >= 5 && DateTime.now().hour < 10
            ? ScenePeriod.dawn
            : ScenePeriod.midday,
      ),
      error: (error, stack) => _buildEntrance(ScenePeriod.night),
    );
  }

  Widget _buildEntrance(ScenePeriod period) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Layer 1 (Environment): Background — single source of truth (time-of-day blend)
          const SanctuaryBackground(),

          // Layer 2 (Character): Elias
          Positioned(
            left: 0,
            right: 0,
            bottom: MediaQuery.of(context).size.height * 0.25,
            child: _EliasPlaceholder(period: period),
          ),

          // Layer 3 (UI): SafeArea — Period label, dialogue (Thumb Zone)
          SafeArea(
            child: Column(
              children: [
                const SizedBox(height: 16),
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.35),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      period.label.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        letterSpacing: 3,
                        fontFamily: 'Georgia',
                      ),
                    ),
                  ),
                ),
                const Spacer(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EliasPlaceholder extends StatelessWidget {
  const _EliasPlaceholder({required this.period});
  final ScenePeriod period;

  @override
  Widget build(BuildContext context) {
    return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: EliasWidget(
                period: period,
                width: 200,
                height: 300,
                showGreeting: false,
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.whetPaper.withValues(alpha: 0.96),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.whetLine, width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 12,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  period.eliasGreeting,
                  textAlign: TextAlign.center,
                  style: EliasTypography.style(color: AppColors.whetInk),
                ),
              ),
            ),
          ],
        )
        .animate()
        .fadeIn(duration: 800.ms, delay: 300.ms)
        .slideY(begin: 0.05, end: 0, duration: 800.ms, delay: 300.ms);
  }
}
