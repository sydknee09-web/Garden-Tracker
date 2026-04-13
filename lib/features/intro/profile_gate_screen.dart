import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app.dart';
import '../../providers/auth_provider.dart';
import '../../providers/profile_provider.dart';
import '../onboarding/forest_threshold.dart';

/// Gate screen: ensures profile exists, fetches it, then redirects to intro or sanctuary.
/// Shown when authenticated user lands from auth or entrance.
class ProfileGateScreen extends ConsumerStatefulWidget {
  const ProfileGateScreen({super.key});

  @override
  ConsumerState<ProfileGateScreen> createState() => _ProfileGateScreenState();
}

class _ProfileGateScreenState extends ConsumerState<ProfileGateScreen> {
  bool _navigationScheduled = false;

  void _scheduleNavigation(bool hasSeenIntro) {
    if (_navigationScheduled) return;
    _navigationScheduled = true;
    Future.delayed(const Duration(milliseconds: 3400), () {
      if (!mounted) return;
      context.go(hasSeenIntro ? AppRoutes.sanctuary : AppRoutes.forestWelcome);
    });
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);
    final authAsync = ref.watch(authProvider);
    final isDataReady = authAsync.hasValue && !profileAsync.isLoading;

    ref.listen<AsyncValue>(profileProvider, (previous, next) {
      next.whenData((profile) {
        if (profile == null) return;
        _scheduleNavigation(profile.hasSeenEliasIntro);
      });
    });

    return ForestThresholdWrapper(
      isDataReady: isDataReady,
      child: Scaffold(
        backgroundColor: const Color(0xFF1A1612),
        body: Center(
          child: profileAsync.when(
            data: (profile) {
              if (profile == null) {
                return const Text(
                  'Unable to load profile',
                  style: TextStyle(
                    color: Colors.white70,
                    fontFamily: 'Georgia',
                  ),
                );
              }
              return Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      color: Color(0xFFB8621A),
                      strokeWidth: 2.5,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    profile.hasSeenEliasIntro
                        ? 'Welcome back...'
                        : 'Preparing your path...',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontFamily: 'Georgia',
                      fontSize: 15,
                    ),
                  ),
                ],
              );
            },
            loading: () => Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    color: Color(0xFFB8621A),
                    strokeWidth: 2.5,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Preparing your path...',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontFamily: 'Georgia',
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            error: (e, _) => Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Something went wrong',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontFamily: 'Georgia',
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () {
                    ref.invalidate(profileProvider);
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
