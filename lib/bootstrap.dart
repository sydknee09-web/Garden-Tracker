import 'dart:async' show TimeoutException;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/config/demo_mode.dart';
import 'core/config/supabase_config.dart';
import 'core/utils/retry.dart';
import 'data/demo/demo_storage.dart';
import 'features/onboarding/forest_threshold.dart';
import 'app.dart';
import 'core/constants/app_colors.dart';

/// True if Supabase initialized successfully. False if init timed out or threw.
/// When false, the app shows a connection-error screen with Retry or "Try Demo Mode".
bool get supabaseInitSucceeded => _supabaseInitSucceeded;
bool _supabaseInitSucceeded = true;

bool _initVoyagerSanctuaryCalled = false;

/// Initializes Flutter bindings and Supabase. Call before [runVoyagerSanctuary].
/// Idempotent: safe to call multiple times (e.g. integration test retries). Skips
/// Supabase.initialize if already done to avoid "already initialized" errors.
/// When [kSkipAuthForTesting], uses demo and skips Supabase. Otherwise always inits Supabase (no demo).
/// Wrapped in 8s timeout — on timeout we show connection-error screen so user can Retry.
Future<void> initVoyagerSanctuary() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (_initVoyagerSanctuaryCalled) {
    return;
  }

  try {
    await _initVoyagerSanctuaryImpl().timeout(
      const Duration(seconds: 8),
      onTimeout: () {
        debugPrint('initVoyagerSanctuary timed out — showing connection error');
        throw TimeoutException('Bootstrap init timed out');
      },
    );
  } on TimeoutException {
    debugPrint('[Bootstrap] Init timed out — connection error (no demo)');
    _supabaseInitSucceeded = false;
    _initVoyagerSanctuaryCalled = true;
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    );
    return;
  }

  _initVoyagerSanctuaryCalled = true;

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
}

Future<void> _initVoyagerSanctuaryImpl() async {
  debugPrint(
    '[Bootstrap] _initVoyagerSanctuaryImpl start, kSkipAuthForTesting=$kSkipAuthForTesting',
  );
  // When testing without auth, skip SharedPreferences entirely — default to demo.
  // Avoids loadDemoMode() which can block the platform thread on first launch.
  if (kSkipAuthForTesting) {
    debugPrint('[Bootstrap] SKIP_AUTH: skipping loadDemoMode, using demo');
    isDemoMode = true;
  } else {
    isDemoMode = false; // Production: no demo, always use real login
  }

  if (isDemoMode) {
    _supabaseInitSucceeded = true;
    if (kSkipAuthForTesting) {
      debugPrint(
        '[Bootstrap] SKIP_AUTH: seedInMemoryOnly (no SharedPreferences)',
      );
      DemoStorage.instance.seedInMemoryOnly();
    } else {
      debugPrint('[Bootstrap] DemoStorage.load (SharedPreferences)...');
      try {
        await DemoStorage.instance.load().timeout(
          const Duration(seconds: 5),
          onTimeout: () {
            debugPrint(
              'DemoStorage.load timed out — proceeding with empty storage',
            );
            throw TimeoutException('DemoStorage load timed out');
          },
        );
      } on TimeoutException {
        DemoStorage.instance.seedInMemoryOnly();
      }
    }
  } else {
    try {
      await retryWithBackoff(
        () =>
            Supabase.initialize(
              url: SupabaseConfig.url,
              anonKey: SupabaseConfig.anonKey,
            ).timeout(
              const Duration(seconds: 10),
              onTimeout: () {
                throw TimeoutException('Supabase init timed out');
              },
            ),
        maxAttempts: 2,
        initialDelay: const Duration(milliseconds: 500),
      );
      _supabaseInitSucceeded = true;
    } on AssertionError catch (_) {
      // Supabase already initialized (e.g. retry from previous testWidgets)
      _supabaseInitSucceeded = true;
    } catch (e, st) {
      debugPrint('Supabase init failed: $e');
      debugPrint('$st');
      _supabaseInitSucceeded = false;
    }
  }
}

/// Call from the connection-error screen to retry init. Returns true if init succeeded.
Future<bool> retrySupabaseInit() async {
  try {
    await retryWithBackoff(
      () =>
          Supabase.initialize(
            url: SupabaseConfig.url,
            anonKey: SupabaseConfig.anonKey,
          ).timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              throw TimeoutException('Supabase init timed out');
            },
          ),
      maxAttempts: 3,
      initialDelay: const Duration(milliseconds: 500),
    );
    _supabaseInitSucceeded = true;
    return true;
  } catch (e) {
    debugPrint('Supabase retry init failed: $e');
    return false;
  }
}

/// Runs the app. Call after [initVoyagerSanctuary].
/// If Supabase init failed (timeout/error), shows a connection-error screen with Retry.
void runVoyagerSanctuary() {
  runApp(const ProviderScope(child: _AppLoader()));
}

/// Restarts the app (e.g. after exiting demo mode). Re-runs the loader.
void restartVoyagerSanctuary() {
  runApp(const ProviderScope(child: _AppLoader()));
}

/// Shows VoyagerSanctuaryApp or a connection-error screen when init failed.
/// When init has not run yet (e.g. from main()), runs init in background and shows loading UI.
class _AppLoader extends StatefulWidget {
  const _AppLoader();

  @override
  State<_AppLoader> createState() => _AppLoaderState();
}

class _AppLoaderState extends State<_AppLoader> {
  late bool _initInProgress;
  late bool _showConnectionError;

  @override
  void initState() {
    super.initState();
    if (_initVoyagerSanctuaryCalled) {
      _initInProgress = false;
      _showConnectionError = !_supabaseInitSucceeded;
    } else {
      _initInProgress = true;
      _showConnectionError = false;
      debugPrint('[Bootstrap] _AppLoader: scheduling init');
      // Defer init until AFTER first frame is painted — SharedPreferences can block
      // the platform thread; painting first ensures user sees loading screen.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        debugPrint('[Bootstrap] Post-frame: starting initVoyagerSanctuary');
        initVoyagerSanctuary().then((_) {
          if (mounted) {
            debugPrint('[Bootstrap] Init complete');
            setState(() {
              _initInProgress = false;
              _showConnectionError = !_supabaseInitSucceeded;
            });
          }
        });
      });
    }
  }

  Future<void> _onRetry() async {
    final ok = await retrySupabaseInit();
    if (ok && mounted) setState(() => _showConnectionError = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_initInProgress) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFFB8621A),
            brightness: Brightness.dark,
          ),
        ),
        home: Scaffold(
          body: Stack(
            fit: StackFit.expand,
            children: [
              const ForestThreshold(
                message: '',
                assetPath: 'assets/backgrounds/forest_threshold.png',
              ),
            ],
          ),
        ),
      );
    }
    if (_showConnectionError) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFFB8621A),
            brightness: Brightness.dark,
          ),
        ),
        home: _ConnectionErrorScreen(onRetry: _onRetry),
      );
    }
    return const VoyagerSanctuaryApp();
  }
}

class _ConnectionErrorScreen extends StatefulWidget {
  const _ConnectionErrorScreen({required this.onRetry});
  final Future<void> Function() onRetry;

  @override
  State<_ConnectionErrorScreen> createState() => _ConnectionErrorScreenState();
}

class _ConnectionErrorScreenState extends State<_ConnectionErrorScreen> {
  bool _isRetrying = false;

  Future<void> _handleRetry() async {
    if (_isRetrying) return;
    setState(() => _isRetrying = true);
    await widget.onRetry();
    if (mounted) setState(() => _isRetrying = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFF1A1612),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.wifi_off_rounded,
                size: 72,
                color: Colors.white.withValues(alpha: 0.4),
              ),
              const SizedBox(height: 28),
              Text(
                'Connection unavailable',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontFamily: 'Georgia',
                  letterSpacing: 1,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                "The Sanctuary can't reach the server. Check your network or try again when you're back online.",
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.6),
                  height: 1.4,
                  fontFamily: 'Georgia',
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              FilledButton.icon(
                onPressed: _isRetrying ? null : _handleRetry,
                icon: _isRetrying
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.parchment,
                        ),
                      )
                    : const Icon(Icons.refresh_rounded, size: 20),
                label: Text(_isRetrying ? 'Connecting...' : 'Try again'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
