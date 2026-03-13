import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/enums/day_period.dart' show ScenePeriod, ScenePeriodExtension;
import '../../providers/auth_provider.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';

class EntranceScreen extends ConsumerStatefulWidget {
  const EntranceScreen({super.key});

  @override
  ConsumerState<EntranceScreen> createState() => _EntranceScreenState();
}

class _EntranceScreenState extends ConsumerState<EntranceScreen> {
  @override
  void initState() {
    super.initState();
    // Navigate to Sanctuary after entrance animation completes.
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!mounted) return;
      // Route based on auth state. go_router redirect handles the guard
      // for protected routes, but we need to manually decide the target here
      // because the entrance is a public route.
      final isAuthenticated = ref.read(isAuthenticatedProvider);
      context.go(
        isAuthenticated ? AppRoutes.sanctuary : AppRoutes.auth,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final periodAsync = ref.watch(timeOfDayProvider);

    return periodAsync.when(
      data: (period) => _buildEntrance(period),
      loading: () => _buildEntrance(DateTime.now().hour >= 5 && DateTime.now().hour < 10
          ? ScenePeriod.dawn
          : ScenePeriod.midday),
      error: (error, stack) => _buildEntrance(ScenePeriod.night),
    );
  }

  Widget _buildEntrance(ScenePeriod period) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Watercolor background + multiply overlay (same as Sanctuary)
          _DayPeriodBackground(period: period),

          // Elias placeholder — centered, fades in
          Positioned(
            left: 0,
            right: 0,
            bottom: MediaQuery.of(context).size.height * 0.25,
            child: _EliasPlaceholder(period: period),
          ),

          // Period label — for Test #1 verification
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 0,
            right: 0,
            child: Center(
              child: Text(
                period.label.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white54,
                  fontSize: 11,
                  letterSpacing: 3,
                  fontFamily: 'Georgia',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _backgroundAssetFor(ScenePeriod period) => switch (period) {
      ScenePeriod.dawn   => 'assets/backgrounds/sunrise.jfif',
      ScenePeriod.midday => 'assets/backgrounds/midday.jfif',
      ScenePeriod.sunset => 'assets/backgrounds/dusk.jfif',
      ScenePeriod.night  => 'assets/backgrounds/night.jfif',
    };

class _DayPeriodBackground extends StatelessWidget {
  const _DayPeriodBackground({required this.period});
  final ScenePeriod period;

  List<Color> get _fallbackGradient => switch (period) {
        ScenePeriod.dawn   => AppColors.dawnGradient,
        ScenePeriod.midday => AppColors.middayGradient,
        ScenePeriod.sunset => AppColors.sunsetGradient,
        ScenePeriod.night  => AppColors.nightGradient,
      };

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          _backgroundAssetFor(period),
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: _fallbackGradient,
              ),
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black26,
                Colors.transparent,
                Colors.transparent,
                Colors.black12,
              ],
            ),
          ),
        ),
      ],
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
            width: 80,
            height: 120,
            showGreeting: false,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          period.eliasGreeting,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
            fontFamily: 'Georgia',
            fontStyle: FontStyle.italic,
            letterSpacing: 0.3,
          ),
        ),
      ],
    )
        .animate()
        .fadeIn(duration: 800.ms, delay: 300.ms)
        .slideY(begin: 0.05, end: 0, duration: 800.ms, delay: 300.ms);
  }
}
