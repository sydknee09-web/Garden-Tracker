import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/constants/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/whetstone_provider.dart';
import 'features/auth/auth_screen.dart';
import 'features/entrance/entrance_screen.dart';
import 'features/sanctuary/sanctuary_screen.dart';
import 'features/scroll_map/scroll_map_screen.dart';
import 'features/satchel/satchel_screen.dart';
import 'features/whetstone/whetstone_screen.dart';
import 'features/management/archive_screen.dart';
import 'features/management/settings_screen.dart';

// ── Routes ───────────────────────────────────────────────────

abstract class AppRoutes {
  static const entrance  = '/';
  static const auth      = '/auth';
  static const sanctuary = '/sanctuary';
  static const scroll    = '/scroll';
  static const satchel   = '/satchel';
  static const whetstone = '/whetstone';
  static const archive   = '/archive';
  static const settings  = '/settings';

  static const _protected = [
    sanctuary, scroll, satchel, whetstone, archive, settings,
  ];

  static bool isProtected(String location) =>
      _protected.any(location.startsWith);
}

// ── Router Notifier ──────────────────────────────────────────
//
// Bridges Riverpod auth state → GoRouter refresh cycle.
// ref.listen must run in build(); we call it there and notify here.

class _RouterNotifier extends ChangeNotifier {
  String? redirect(BuildContext context, GoRouterState state, WidgetRef ref) {
    final authState = ref.read(authProvider);

    // While loading the initial session — hold, don't redirect
    if (authState.isLoading) return null;

    final isAuthenticated = authState.valueOrNull != null;
    final location = state.matchedLocation;

    // Unauthenticated user on a protected route → go to auth
    if (!isAuthenticated && AppRoutes.isProtected(location)) {
      return AppRoutes.auth;
    }

    // Authenticated user on auth screen → send to sanctuary
    if (isAuthenticated && location == AppRoutes.auth) {
      return AppRoutes.sanctuary;
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

class _VoyagerSanctuaryAppState
    extends ConsumerState<VoyagerSanctuaryApp>
    with WidgetsBindingObserver {
  late final _RouterNotifier _notifier;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _notifier = _RouterNotifier();
    _router = GoRouter(
      initialLocation: AppRoutes.entrance,
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
          path: AppRoutes.sanctuary,
          builder: (context, state) => const SanctuaryScreen(),
        ),
        GoRoute(
          path: AppRoutes.scroll,
          builder: (context, state) => const ScrollMapScreen(),
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
      ],
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(whetstoneProvider.notifier).onAppResume();
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
      WidgetsBinding.instance.addPostFrameCallback((_) => _notifier.notifyListeners());
    });
    return MaterialApp.router(
      title: 'Voyager Sanctuary',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: _router,
    );
  }
}
