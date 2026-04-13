import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/config/supabase_config.dart';
import 'core/enums/day_period.dart';
import 'core/constants/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/node_provider.dart';
import 'providers/sound_settings_provider.dart';
import 'providers/streak_provider.dart';
import 'providers/whetstone_provider.dart';
import 'providers/elias_provider.dart';
import 'providers/hearth_fuel_provider.dart';
import 'features/auth/auth_screen.dart';
import 'features/entrance/entrance_screen.dart';
import 'features/intro/forest_crossroads_welcome_screen.dart';
import 'features/intro/intro_screen.dart';
import 'features/intro/profile_gate_screen.dart';
import 'features/sanctuary/sanctuary_screen.dart';
import 'features/scroll_map/mountain_detail_screen.dart';
import 'features/scroll_map/scroll_map_screen.dart';
import 'features/satchel/satchel_screen.dart';
import 'features/whetstone/whetstone_screen.dart';
import 'features/management/archive_screen.dart';
import 'features/management/settings_screen.dart';
import 'features/management/credits_view.dart';

// ── Routes ───────────────────────────────────────────────────

abstract class AppRoutes {
  static const entrance = '/';
  static const auth = '/auth';
  static const profileGate = '/profile-gate';
  static const forestWelcome = '/forest-welcome';
  static const intro = '/intro';
  static const sanctuary = '/sanctuary';
  static const scroll = '/scroll';
  static const satchel = '/satchel';
  static const whetstone = '/whetstone';
  static const archive = '/archive';
  static const settings = '/settings';
  static const credits = '/credits';

  static const _protected = [
    profileGate,
    forestWelcome,
    intro,
    sanctuary,
    scroll,
    satchel,
    whetstone,
    archive,
    settings,
    credits,
  ];

  static bool isProtected(String location) =>
      _protected.any(location.startsWith);
}

// ── Refine-mode audio cue ───────────────────────────────────
// When refineModeProvider flips to true, play at 1.2x for "Sharpening the Map".
// Set true to use scroll_open.wav as placeholder when whetstone.wav is missing.
const bool _usePlaceholderRefineSound = false;
final AudioPlayer _refineWhetstonePlayer = AudioPlayer();
bool _assetsPrecached = false;

// ── Router Notifier ──────────────────────────────────────────
//
// Bridges Riverpod auth state → GoRouter refresh cycle.
// ref.listen must run in build(); we call it there and notify here.

class _RouterNotifier extends ChangeNotifier {
  /// Call when auth or route state changes so GoRouter re-evaluates redirect.
  void refresh() => notifyListeners();

  String? redirect(BuildContext context, GoRouterState state, WidgetRef ref) {
    // Bypass auth gate for UI testing only (demo mode still runs intro flow)
    if (kSkipAuthForTesting) {
      final location = state.matchedLocation;
      if (location == AppRoutes.auth) return AppRoutes.sanctuary;
      return null;
    }

    final authState = ref.read(authProvider);

    // While loading the initial session — hold, don't redirect
    if (authState.isLoading) return null;

    final isAuthenticated = authState.valueOrNull != null;
    final location = state.matchedLocation;

    // Unauthenticated user on a protected route → go to auth
    if (!isAuthenticated && AppRoutes.isProtected(location)) {
      return AppRoutes.auth;
    }

    // Authenticated user on auth or entrance → profile gate (fetches profile, then intro or sanctuary)
    if (isAuthenticated &&
        (location == AppRoutes.auth || location == AppRoutes.entrance)) {
      return AppRoutes.profileGate;
    }

    return null; // no redirect
  }
}

// ── App ──────────────────────────────────────────────────────

class VoyagerSanctuaryApp extends ConsumerStatefulWidget {
  const VoyagerSanctuaryApp({super.key});

  @override
  ConsumerState<VoyagerSanctuaryApp> createState() =>
      _VoyagerSanctuaryAppState();
}

class _VoyagerSanctuaryAppState extends ConsumerState<VoyagerSanctuaryApp>
    with WidgetsBindingObserver {
  late final _RouterNotifier _notifier;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _notifier = _RouterNotifier();
    _router = GoRouter(
      initialLocation: kSkipAuthForTesting
          ? AppRoutes.sanctuary
          : AppRoutes.entrance,
      refreshListenable: _notifier,
      redirect: (context, state) => _notifier.redirect(context, state, ref),
      routes: [
        GoRoute(
          path: AppRoutes.entrance,
          builder: (context, state) => const EntranceScreen(),
        ),
        GoRoute(
          path: AppRoutes.auth,
          builder: (context, state) => const AuthScreen(),
        ),
        GoRoute(
          path: AppRoutes.profileGate,
          builder: (context, state) => const ProfileGateScreen(),
        ),
        GoRoute(
          path: AppRoutes.forestWelcome,
          builder: (context, state) => const ForestCrossroadsWelcomeScreen(),
        ),
        GoRoute(
          path: AppRoutes.intro,
          builder: (context, state) => const IntroScreen(),
        ),
        GoRoute(
          path: AppRoutes.sanctuary,
          builder: (context, state) => SanctuaryScreen(
            focusOnHearth: state.uri.queryParameters['focusOnHearth'] == 'true',
          ),
        ),
        GoRoute(
          path: AppRoutes.scroll,
          pageBuilder: (context, state) => CustomTransitionPage(
            key: state.pageKey,
            child: ScrollMapScreen(
              openClimbOnMount:
                  state.uri.queryParameters['openClimb'] == 'true',
            ),
            transitionsBuilder:
                (context, animation, secondaryAnimation, child) {
                  return SizeTransition(
                    sizeFactor: CurvedAnimation(
                      parent: animation,
                      curve: Curves.easeOut,
                    ),
                    axis: Axis.vertical,
                    axisAlignment: 0,
                    child: child,
                  );
                },
            transitionDuration: const Duration(milliseconds: 800),
          ),
          routes: [
            GoRoute(
              path: ':mountainId',
              builder: (context, state) {
                final mountainId = state.pathParameters['mountainId'] ?? '';
                return MountainDetailScreen(mountainId: mountainId);
              },
            ),
          ],
        ),
        GoRoute(
          path: AppRoutes.satchel,
          builder: (context, state) => const SatchelScreen(),
        ),
        GoRoute(
          path: AppRoutes.whetstone,
          builder: (context, state) => const WhetstoneScreen(),
        ),
        GoRoute(
          path: AppRoutes.archive,
          builder: (context, state) => const ArchiveScreen(),
        ),
        GoRoute(
          path: AppRoutes.settings,
          builder: (context, state) => const SettingsScreen(),
        ),
        GoRoute(
          path: AppRoutes.credits,
          builder: (context, state) => const CreditsView(),
        ),
      ],
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(whetstoneProvider.notifier).onAppResume();
      ref.invalidate(whetstoneStreakProvider);
      ref.invalidate(burnStreakProvider);
      ref.invalidate(hearthFuelProvider);
      ref.read(hasShownSessionGreetingProvider.notifier).state = false;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _notifier.dispose();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue>(authProvider, (previous, next) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _notifier.refresh();
      });
    });
    ref.listen<bool>(refineModeProvider, (previous, next) {
      if (next == true && ref.read(soundEnabledProvider)) {
        _refineWhetstonePlayer.setPlaybackRate(1.2);
        if (_usePlaceholderRefineSound) {
          _refineWhetstonePlayer
              .play(AssetSource('sounds/scroll_open.wav'))
              .catchError(
                (_) => _refineWhetstonePlayer
                    .play(AssetSource('sounds/scroll_open.mp3'))
                    .ignore(),
              )
              .ignore();
        } else {
          _refineWhetstonePlayer
              .play(AssetSource('sounds/whetstone.wav'))
              .catchError(
                (_) => _refineWhetstonePlayer
                    .play(AssetSource('sounds/whetstone.mp3'))
                    .ignore(),
              )
              .ignore();
        }
      }
    });
    return MaterialApp.router(
      title: 'Voyager Sanctuary',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: _router,
      builder: (context, child) {
        if (!_assetsPrecached) {
          _assetsPrecached = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              for (final p in ScenePeriod.values) {
                precacheImage(AssetImage(p.eliasAssetPath), context);
              }
              precacheImage(
                const AssetImage('assets/hearth/Hearth_Sizzle.png'),
                context,
              );
              precacheImage(
                const AssetImage('assets/hearth/Hearth_High.png'),
                context,
              );
              precacheImage(
                const AssetImage('assets/hearth/hearth_extra_high.png'),
                context,
              );
            }
          });
        }
        return child ?? const SizedBox.shrink();
      },
    );
  }
}
