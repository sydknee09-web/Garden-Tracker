import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/elias_typography.dart';
import '../../core/state/data_freshness.dart';
import '../../core/enums/day_period.dart' show ScenePeriod;
import '../../providers/time_of_day_provider.dart';
import 'dart:async';
import 'dart:math' as math;
import '../../core/content/elias_dialogue.dart';
import '../../core/services/streak_service.dart';
import '../../providers/sanctuary_initialization_provider.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/narrow_invalidation.dart';
import '../../providers/node_provider.dart';
import '../../providers/elias_provider.dart';
import '../../providers/streak_provider.dart';
import '../../providers/pending_burn_undo_provider.dart';
import '../../providers/hearth_fuel_provider.dart';
import '../../providers/sound_settings_provider.dart';
import '../../providers/whetstone_provider.dart';
import '../../providers/profile_provider.dart';
import '../../providers/repository_providers.dart';
import '../../providers/first_run_provider.dart';
import '../../core/utils/satchel_stone_assets.dart';
import '../../data/models/mountain.dart';
import '../../data/models/satchel_slot.dart';
import '../../widgets/elias_silhouette.dart';
import '../../widgets/hearth_burn_widget.dart';
import '../../widgets/hearth_spark_painter.dart';
import '../../widgets/sanctuary_background.dart';
import '../management/management_menu_sheet.dart';

class SanctuaryScreen extends ConsumerWidget {
  const SanctuaryScreen({super.key, this.focusOnHearth = false});
  final bool focusOnHearth;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(sanctuaryInitializationProvider);
    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    final isNight = period == ScenePeriod.night;
    final satchel = ref.watch(satchelProvider);

    final size = MediaQuery.sizeOf(context);
    final pivotX = size.width * 0.5;
    final pivotY = size.height * 0.65;

    return Scaffold(
      key: const ValueKey('screen_sanctuary'),
      body: _SanctuaryOnMovementLayer(
        child: Stack(
          fit: StackFit.expand,
          children: [
            const _SanctuaryHomeIntroCoordinator(),
            const _FirstRunQuestBridge(),
            _HearthFuelTimer(),
            // Layer 1 (Environment): Background — ignores SafeArea for bleed
            const SanctuaryBackground(),

            // Layer 2 (Character): Elias first (behind), Hearth second (on top). Zoom pivot (0.5, 0.65), 1.15x, 800ms
            RepaintBoundary(
              child: TweenAnimationBuilder<double>(
                key: ValueKey(focusOnHearth),
                tween: Tween<double>(
                  begin: focusOnHearth ? 1.0 : 1.15,
                  end: focusOnHearth ? 1.15 : 1.0,
                ),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeInOutCubic,
                builder: (context, value, child) {
                  return Transform(
                    transform: Matrix4.identity()
                      ..translateByDouble(pivotX, pivotY, 0, 1)
                      ..scaleByDouble(value, value, 1.0, 1.0)
                      ..translateByDouble(-pivotX, -pivotY, 0, 1),
                    child: child,
                  );
                },
                child: Stack(
                  fit: StackFit.expand,
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: size.width * 0.38,
                      right: size.width * 0.07,
                      bottom: size.height * 0.31,
                      child: Align(
                        alignment: Alignment.bottomRight,
                        child: Semantics(
                          label: 'Elias, your guide',
                          hint:
                              'Counsel and tools — same menu as the Guide button below.',
                          button: true,
                          child: Tooltip(
                            message:
                                'Tap for counsel — plot a path, pack your satchel, and more.',
                            child: _EliasTapTarget(
                              period: period,
                              onTap: () => _openManagement(context, ref),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: size.height * 0.245,
                      child: Semantics(
                        label: 'Hearth',
                        child: Center(
                          child: Transform.translate(
                            offset: Offset(0, -size.height * 0.02),
                            child: _HearthWidget(period: period),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: size.width * 0.38,
                      right: size.width * 0.10,
                      bottom:
                          size.height * 0.31 +
                          (size.height * 0.5).clamp(180.0, 480.0) +
                          12.0,
                      child: Align(
                        alignment: Alignment.bottomRight,
                        child: _EliasBubble(period: period, isNight: isNight),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (isNight)
              Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A1020).withValues(alpha: 0.18),
                    ),
                    child: ColoredBox(
                      color: const Color(0xFFC26D2B).withValues(alpha: 0.05),
                    ),
                  ),
                ),
              ),

            // Layer 3 (UI): SafeArea — dismiss overlay, celebration, camp dock
            Opacity(
              opacity: isNight ? 0.93 : 1.0,
              child: SafeArea(
                child: LayoutBuilder(
                  builder: (context, layerConstraints) {
                    // Shorter footer (~40% less than prior 26% cap); fade zone stacks upward into art.
                    final dockContentHeight = (layerConstraints.maxHeight * 0.155)
                        .clamp(76.0, 124.0);
                    const dockSceneFade = 44.0;
                    final dockTotalHeight = dockContentHeight + dockSceneFade;
                    return Stack(
                      fit: StackFit.expand,
                      children: [
                        const _BurnUndoSnackBarHost(),
                        Positioned(
                          top: 4,
                          left: 0,
                          right: 0,
                          child: const Center(child: _BurnStreakBanner()),
                        ),
                        if (ref.watch(hearthCelebrationProvider))
                          Positioned.fill(
                            child: _CelebrationOverlay(
                              onComplete: () =>
                                  ref
                                          .read(
                                            hearthCelebrationProvider.notifier,
                                          )
                                          .state =
                                      false,
                            ),
                          ),
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: MediaQuery.viewPaddingOf(context).bottom + 8,
                          height: dockTotalHeight,
                          child: _SanctuaryCampDock(
                            sceneFadeHeight: dockSceneFade,
                            contentHeight: dockContentHeight,
                            satchelState: satchel,
                            focusOnHearth: focusOnHearth,
                            onEmptySlotTap: () =>
                                _openManagement(context, ref),
                            onDragStartedWhenLocked: () {
                              ref.read(eliasMessageProvider.notifier).state =
                                  EliasDialogue.markDoneToDrop();
                            },
                            mountains:
                                ref.watch(mountainListProvider).valueOrNull ??
                                [],
                            onMapTap: () => context.push(AppRoutes.scroll),
                            onSatchelTap: () {
                              context.go('/sanctuary');
                              context.push(AppRoutes.satchel);
                            },
                            onWhetstoneTap: () {
                              context.go('/sanctuary');
                              context.push(AppRoutes.whetstone);
                            },
                            onGuideTap: () => _openManagement(context, ref),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openManagement(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final h = MediaQuery.sizeOf(sheetContext).height;
        return SizedBox(
          height: h,
          child: DraggableScrollableSheet(
            initialChildSize: 0.52,
            minChildSize: 0.34,
            maxChildSize: 0.92,
            snap: true,
            snapSizes: const [0.34, 0.52, 0.78, 0.92],
            expand: true,
            builder: (ctx, scrollController) {
              return ManagementMenuSheet(scrollController: scrollController);
            },
          ),
        );
      },
    );
  }
}

/// Listens for [pendingBurnUndoProvider] and shows an undo SnackBar on Sanctuary.
class _BurnUndoSnackBarHost extends ConsumerWidget {
  const _BurnUndoSnackBarHost();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<BurnUndoToken?>(pendingBurnUndoProvider, (prev, next) {
      if (next == null) return;
      final t = next;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        ref.read(pendingBurnUndoProvider.notifier).state = null;
        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        final barWidth = (MediaQuery.sizeOf(context).width - 24.0).clamp(
          280.0,
          560.0,
        );
        messenger.showSnackBar(
          SnackBar(
            width: barWidth,
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            content: Text(
              'Stone burned — "${t.title}".',
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.parchment,
              ),
            ),
            duration: const Duration(seconds: 4),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.charcoal,
            dismissDirection: DismissDirection.horizontal,
            showCloseIcon: true,
            closeIconColor: AppColors.parchment.withValues(alpha: 0.75),
            action: SnackBarAction(
              label: 'UNDO',
              textColor: AppColors.ember,
              onPressed: () async {
                await ref.read(satchelProvider.notifier).undoBurn(
                      slotId: t.slotId,
                      nodeId: t.nodeId,
                      mountainId: t.mountainId,
                    );
              },
            ),
          ),
        );
      });
    });
    return const SizedBox.shrink();
  }
}

/// Current burn streak chip (flame + day count).
class _BurnStreakBanner extends ConsumerWidget {
  const _BurnStreakBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(burnStreakProvider);
    return async.when(
      data: (r) {
        final streak = r.currentStreak;
        if (streak < 1) return const SizedBox.shrink();
        final scale = (0.85 + (streak.clamp(1, 14) / 14) * 0.35).clamp(
          0.85,
          1.2,
        );
        return Tooltip(
          message: EliasDialogue.burnStreakGraceTooltip,
          preferBelow: false,
          verticalOffset: 8,
          textStyle: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 13,
            color: AppColors.parchment,
            height: 1.35,
          ),
          decoration: BoxDecoration(
            color: AppColors.charcoal.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.ember.withValues(alpha: 0.45)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          waitDuration: const Duration(milliseconds: 400),
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.charcoal.withValues(alpha: 0.42),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: AppColors.ember.withValues(alpha: 0.55),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Transform.scale(
                    scale: scale,
                    child: Icon(
                      Icons.local_fire_department,
                      color: AppColors.ember,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(
                    Icons.info_outline,
                    size: 14,
                    color: AppColors.parchment.withValues(alpha: 0.65),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$streak day${streak == 1 ? '' : 's'} burning',
                    style: const TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 12,
                      color: AppColors.parchment,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

/// Full-screen celebration when 4+ stones dropped. Flame gradient, Elias line.
class _CelebrationOverlay extends StatefulWidget {
  const _CelebrationOverlay({required this.onComplete});
  final VoidCallback onComplete;

  @override
  State<_CelebrationOverlay> createState() => _CelebrationOverlayState();
}

class _CelebrationOverlayState extends State<_CelebrationOverlay> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) widget.onComplete();
    });
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              AppColors.ember.withValues(alpha: 0.4),
              AppColors.ember.withValues(alpha: 0.15),
              Colors.transparent,
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/elias/elias_cheering.png',
                height: 220,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.celebration,
                  size: 84,
                  color: AppColors.parchment,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'The fire roars. Well done.',
                style: EliasTypography.style(color: AppColors.parchment),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Invalidates hearthFuelProvider every 60s while Sanctuary is mounted (fuel decay).
class _HearthFuelTimer extends ConsumerStatefulWidget {
  const _HearthFuelTimer();

  @override
  ConsumerState<_HearthFuelTimer> createState() => _HearthFuelTimerState();
}

class _HearthFuelTimerState extends ConsumerState<_HearthFuelTimer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted) ref.invalidate(hearthFuelProvider);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// One-time home intro bubble (then [markSanctuaryHomeIntroSeen]); empty state skips straight to quest/greeting flow.
class _SanctuaryHomeIntroCoordinator extends ConsumerStatefulWidget {
  const _SanctuaryHomeIntroCoordinator();

  @override
  ConsumerState<_SanctuaryHomeIntroCoordinator> createState() =>
      _SanctuaryHomeIntroCoordinatorState();
}

class _SanctuaryHomeIntroCoordinatorState
    extends ConsumerState<_SanctuaryHomeIntroCoordinator> {
  bool _postFrameScheduled = false;

  @override
  Widget build(BuildContext context) {
    ref.listen<String?>(eliasMessageProvider, (prev, next) async {
      if (next != null) return;
      if (prev != EliasDialogue.sanctuaryHomeIntroCombined) return;
      await markSanctuaryHomeIntroSeen();
      if (mounted) ref.invalidate(hasSeenSanctuaryHomeIntroProvider);
    });

    if (_postFrameScheduled) return const SizedBox.shrink();
    _postFrameScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final seen = await ref.read(hasSeenSanctuaryHomeIntroProvider.future);
      if (seen) return;

      final mountains = ref.read(mountainListProvider).valueOrNull ?? [];
      final whetstone = ref.read(whetstoneProvider);
      final isEmpty = mountains.isEmpty && whetstone.items.isEmpty;
      if (isEmpty) {
        await markSanctuaryHomeIntroSeen();
        if (mounted) ref.invalidate(hasSeenSanctuaryHomeIntroProvider);
        return;
      }

      final current = ref.read(eliasMessageProvider);
      if (current != null) return;

      ref.read(eliasMessageProvider.notifier).state =
          EliasDialogue.sanctuaryHomeIntroCombined;
    });

    return const SizedBox.shrink();
  }
}

/// First-run quest handoff:
/// once the traveler marks at least one stone "ready", guide them to the Hearth.
class _FirstRunQuestBridge extends ConsumerStatefulWidget {
  const _FirstRunQuestBridge();

  @override
  ConsumerState<_FirstRunQuestBridge> createState() =>
      _FirstRunQuestBridgeState();
}

class _FirstRunQuestBridgeState extends ConsumerState<_FirstRunQuestBridge> {
  bool _hasScheduledCheck = false;

  @override
  Widget build(BuildContext context) {
    if (!_hasScheduledCheck) {
      _hasScheduledCheck = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        final seenStep1 = await ref.read(hasSeenQuestStep1Provider.future);
        final seenStep3 = await ref.read(hasSeenQuestStep3Provider.future);
        final seenFirstBurn = await ref.read(hasSeenFirstBurnProvider.future);
        if (!seenStep1 || seenStep3 || seenFirstBurn) return;

        final satchel = ref.read(satchelProvider);
        final hasReadyStone = satchel.slots.any((s) => s.readyToBurn);
        if (!hasReadyStone) return;

        ref.read(eliasMessageProvider.notifier).state =
            EliasDialogue.firstLandQuestStep3();
        await markQuestStep3Seen();
        if (mounted) {
          ref.invalidate(hasSeenQuestStep3Provider);
        }
      });
    }
    return const SizedBox.shrink();
  }
}

// ── Elias ────────────────────────────────────────────────────

/// Wraps Elias with a single, reliable tap target (min 80x80) so the menu opens consistently.
class _EliasTapTarget extends StatelessWidget {
  const _EliasTapTarget({required this.period, required this.onTap});
  final ScenePeriod period;
  final VoidCallback onTap;

  static const double _minTapSize = 80;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minWidth: _minTapSize,
          minHeight: _minTapSize,
        ),
        child: _EliasWidget(period: period, showGreeting: false),
      ),
    ).animate().fadeIn(duration: 600.ms, delay: 200.ms);
  }
}

class _EliasWidget extends ConsumerWidget {
  const _EliasWidget({required this.period, this.showGreeting = true});
  final ScenePeriod period;
  final bool showGreeting;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = MediaQuery.sizeOf(context);
    final w = ((size.width * 0.62).clamp(120.0, 300.0)) * 0.72;
    final h = ((size.height * 0.48).clamp(170.0, 460.0)) * 0.72;
    return EliasWidget(
      period: period,
      width: w,
      height: h,
      showGreeting: showGreeting,
      greetingWidth: (w * 0.85).clamp(160.0, 280.0),
    );
  }
}

/// Listener for pan/drag on Sanctuary. Triggers [EliasDialogue.onMovement]
/// (throttled) so movement-based guidance is not spammed.
class _SanctuaryOnMovementLayer extends ConsumerStatefulWidget {
  const _SanctuaryOnMovementLayer({required this.child});
  final Widget child;

  @override
  ConsumerState<_SanctuaryOnMovementLayer> createState() =>
      _SanctuaryOnMovementLayerState();
}

class _SanctuaryOnMovementLayerState
    extends ConsumerState<_SanctuaryOnMovementLayer> {
  static const _throttleMs = 5000;
  int _lastTriggerTime = 0;

  void _onPointerMove(PointerMoveEvent event) {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastTriggerTime < _throttleMs) return;
    _lastTriggerTime = now;
    ref.read(eliasMessageProvider.notifier).state = EliasDialogue.onMovement();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerMove: _onPointerMove,
      behavior: HitTestBehavior.translucent,
      child: widget.child,
    );
  }
}

// ── Hearth ───────────────────────────────────────────────────

class _HearthWidget extends ConsumerStatefulWidget {
  const _HearthWidget({required this.period});
  final ScenePeriod period;

  @override
  ConsumerState<_HearthWidget> createState() => _HearthWidgetState();
}

class _HearthWidgetState extends ConsumerState<_HearthWidget>
    with SingleTickerProviderStateMixin {
  bool _burning = false;
  double _sparkTime = 0;
  Timer? _sparkTimer;
  bool _lastHadCandidate = false;
  final AudioPlayer _stoneDropAudio = AudioPlayer();
  final AudioPlayer _weightAudio = AudioPlayer();
  late AnimationController _brightnessController;
  _PendingBurnContext? _pendingBurn;
  bool _isFinalizingBurn = false;

  @override
  void initState() {
    super.initState();
    _sparkTimer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (mounted) {
        setState(
          () => _sparkTime = DateTime.now().millisecondsSinceEpoch / 1000.0,
        );
      }
    });
    _brightnessController =
        AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 200),
        )..addListener(() {
          if (mounted) setState(() {});
        });
  }

  @override
  void dispose() {
    _sparkTimer?.cancel();
    _brightnessController.dispose();
    _stoneDropAudio.dispose();
    _weightAudio.dispose();
    super.dispose();
  }

  /// Shows a gold ember burst over the Hearth for mountain summit celebration.
  void _showEmberBurst(BuildContext context) {
    final overlay = Overlay.of(context);
    final size = MediaQuery.sizeOf(context);
    // Burst over Hearth (horizontally centered)
    final originX = size.width * 0.5;
    final originY = size.height * 0.66;

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => _EmberBurstOverlay(
        origin: Offset(originX, originY),
        onComplete: () {
          entry.remove();
        },
      ),
    );
    overlay.insert(entry);
  }

  /// Layered drop: thud (primary) + weight (scale by stone count 1–5). Pitch drops 2% per stone.
  /// Haptic is handled by contextual burn haptic (pebble/landmark/mountain).
  void _playStoneDrop(int stoneCount) {
    _stoneDropAudio.stop();
    _weightAudio.stop();
    // Thud: always play — prefer wav (bundled) for reliability
    _stoneDropAudio.play(AssetSource('sounds/stone_drop.wav')).catchError((_) {
      _stoneDropAudio.play(AssetSource('sounds/stone_drop.mp3')).ignore();
    }).ignore();
    // Weight: 30% (1–2), 60% (3–4), 100% (5). Pitch 1.0 down to 0.92.
    final weightVolume = stoneCount <= 2 ? 0.3 : (stoneCount <= 4 ? 0.6 : 1.0);
    final weightPitch =
        1.0 - (stoneCount - 1) * 0.02; // 1.0, 0.98, 0.96, 0.94, 0.92
    _weightAudio.setVolume(weightVolume);
    _weightAudio.setPlaybackRate(weightPitch);
    _weightAudio.play(AssetSource('sounds/weight.wav')).catchError((_) {
      _weightAudio.play(AssetSource('sounds/weight.mp3')).ignore();
    }).ignore();
  }

  Future<void> _finalizeBurnAfterShader() async {
    if (!mounted || _isFinalizingBurn) return;
    final pending = _pendingBurn;
    if (pending == null) return;
    _isFinalizingBurn = true;

    try {
      final burnedMountainId = await ref
          .read(satchelProvider.notifier)
          .burnStone(pending.nodeId);
      if (burnedMountainId != null) {
        invalidateAfterBurn(ref, burnedMountainId);
        final c = ref.read(hearthDropCountProvider);
        ref.read(hearthDropCountProvider.notifier).state = c >= 5 ? 5 : c + 1;
      }

      ref.invalidate(burnStreakProvider);
      ref.invalidate(hearthFuelProvider);

      if (mounted &&
          pending.slotId.isNotEmpty &&
          pending.mountainId.isNotEmpty) {
        HapticFeedback.mediumImpact();
        ref.read(pendingBurnUndoProvider.notifier).state = BurnUndoToken(
          nodeId: pending.nodeId,
          slotId: pending.slotId,
          mountainId: pending.mountainId,
          title: pending.title,
        );
      }

      // Avoid context.go('/sanctuary') when already here — it rebuilds the whole
      // route (TweenAnimationBuilder + hearth state reset) and looks like a
      // refresh with the fire briefly misplaced. Only strip ?focusOnHearth= when needed.
      if (mounted) {
        final uri = GoRouterState.of(context).uri;
        if (uri.queryParameters['focusOnHearth'] == 'true') {
          context.go(AppRoutes.sanctuary);
        }
      }

      final fuelState = await ref.read(hearthFuelProvider.future);
      if (fuelState.shouldCelebrate && context.mounted) {
        ref.read(hearthCelebrationProvider.notifier).state = true;
      }

      final seenFirstBurn = await ref.read(hasSeenFirstBurnProvider.future);
      final prefs = await SharedPreferences.getInstance();
      final d = DateTime.now();
      final dk = '${d.year}-${d.month}-${d.day}';
      final burnCountKey = 'vs_burn_count_$dk';
      final burnN = (prefs.getInt(burnCountKey) ?? 0) + 1;
      await prefs.setInt(burnCountKey, burnN);

      late String eliasLine;
      if (!seenFirstBurn) {
        eliasLine = EliasDialogue.firstStoneBurnedMilestone;
        await markFirstBurnSeen();
      } else if (burnN == 10 &&
          prefs.getBool('vs_elias_ten_burns_$dk') != true) {
        await prefs.setBool('vs_elias_ten_burns_$dk', true);
        eliasLine = EliasDialogue.milestoneTenBurnsOneDay;
      } else if (pending.isLastInMountain &&
          prefs.getBool('vs_elias_first_summit_shown') != true) {
        await prefs.setBool('vs_elias_first_summit_shown', true);
        eliasLine = EliasDialogue.milestoneFirstSummit;
      } else {
        final timestamps = await ref
            .read(nodeRepositoryProvider)
            .fetchBurnTimestamps();
        final streak = computeStreak(timestamps).currentStreak;
        if (streak == 7 && prefs.getBool('vs_elias_burn_streak_7') != true) {
          await prefs.setBool('vs_elias_burn_streak_7', true);
          eliasLine = EliasDialogue.milestoneBurnStreak7;
        } else {
          eliasLine = EliasBurnReflections.getReaction(
            isStarred: pending.isStarred,
            isLast: pending.isLastInMountain,
          );
        }
      }
      ref.read(eliasMessageProvider.notifier).state = eliasLine;

      if (mounted) {
        _showEmberBurst(context);
      }
    } finally {
      if (mounted) {
        setState(() {
          _burning = false;
          _pendingBurn = null;
        });
      }
      _isFinalizingBurn = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return DragTarget<String>(
      onWillAcceptWithDetails: (details) {
        final nodeId = details.data.trim();
        if (nodeId.isEmpty) return false;
        final satchel = ref.read(satchelProvider);
        if (satchel.isBurnInProgress) return false;
        SatchelSlot? slot;
        for (final s in satchel.slots) {
          if ((s.nodeId ?? '').trim() == nodeId) {
            slot = s;
            break;
          }
        }
        return slot?.readyToBurn ?? false;
      },
      onAcceptWithDetails: (details) async {
        final nodeId = details.data;
        // Session intensity for SFX only; hearth art bumps after burn succeeds
        // so the dissolve plays on the current flame, then the stronger fire cross-fades in.
        final nextCount = (ref.read(hearthDropCountProvider) >= 5)
            ? 5
            : ref.read(hearthDropCountProvider) + 1;
        if (ref.read(soundEnabledProvider)) _playStoneDrop(nextCount);
        setState(() => _burning = true);

        // Check if this is the last pebble of its mountain (before burn)
        final satchel = ref.read(satchelProvider);
        SatchelSlot? slot;
        for (final s in satchel.slots) {
          if (s.nodeId == nodeId) {
            slot = s;
            break;
          }
        }
        final mountainId = slot?.node?.mountainId;
        final isLastPebble =
            mountainId != null &&
            (await ref
                    .read(mountainActionsProvider)
                    .countIncompleteLeaves(mountainId)) ==
                1;

        final rawTitle = (slot?.node?.title ?? '').trim();
        _pendingBurn = _PendingBurnContext(
          nodeId: nodeId,
          slotId: slot?.id ?? '',
          mountainId: mountainId ?? '',
          title: rawTitle.isEmpty ? 'Stone' : rawTitle,
          isStarred: slot?.node?.isStarred == true,
          isLastInMountain: isLastPebble,
        );
      },
      builder: (context, candidateData, rejectedData) {
        final isHovering = candidateData.isNotEmpty || _burning;

        // Thud: haptic when stone enters fire's orbit
        if (candidateData.isNotEmpty) {
          if (!_lastHadCandidate) {
            _lastHadCandidate = true;
            HapticFeedback.mediumImpact();
          }
        } else {
          _lastHadCandidate = false;
        }

        // Brightness: animate to 1.5x over 200ms when hovering
        if (isHovering &&
            !_brightnessController.isAnimating &&
            _brightnessController.value < 1) {
          _brightnessController.forward();
        } else if (!isHovering && _brightnessController.value > 0) {
          _brightnessController.reverse();
        }
        final brightnessBoost = 1.0 + 0.5 * _brightnessController.value;

        const double hearthWidth = 286;
        final hearthHeight = hearthWidth * 0.9;
        final fuelAsync = ref.watch(hearthFuelProvider);
        final fuelState = fuelAsync.when(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          data: (s) => s,
          error: (_, __) => const HearthFuelState(effectiveFuel: 0, fireLevel: 0),
          loading: () {
            if (fuelAsync.hasValue) return fuelAsync.requireValue;
            return const HearthFuelState(effectiveFuel: 0, fireLevel: 3);
          },
        );
        final fireLevel = fuelState.fireLevel.clamp(0, 3);
        final scale = _burning ? 1.12 : 1.0;
        final streak =
            ref.watch(burnStreakProvider).valueOrNull?.currentStreak ?? 0;
        final sparkIntensity = math.max(streak, fireLevel);

        final isColdHearth = fireLevel == 0;
        return Semantics(
          label: 'Hearth. Drop stones here to burn.',
          child: Center(
            child: AnimatedScale(
              scale: scale,
              duration: _burning
                  ? const Duration(milliseconds: 120)
                  : const Duration(milliseconds: 200),
              curve: _burning ? Curves.easeOut : Curves.easeInOut,
              child: HearthBurnWidget(
                isBurning: _burning,
                onComplete: _finalizeBurnAfterShader,
                child: _buildHearthStack(
                  hearthWidth: hearthWidth,
                  hearthHeight: hearthHeight,
                  fireLevel: fireLevel,
                  hearthDropCount: ref.watch(hearthDropCountProvider),
                  isHovering: isHovering,
                  burning: _burning,
                  sparkIntensity: sparkIntensity,
                  sparkTime: _sparkTime,
                  brightnessBoost: brightnessBoost,
                  isColdHearth: isColdHearth,
                ),
              ),
            ),
          ),
        );
      },
    ).animate().fadeIn(duration: 800.ms, delay: 400.ms);
  }

  Widget _buildHearthStack({
    required double hearthWidth,
    required double hearthHeight,
    required int fireLevel,
    required int hearthDropCount,
    required bool isHovering,
    required bool burning,
    required int sparkIntensity,
    required double sparkTime,
    required double brightnessBoost,
    required bool isColdHearth,
  }) {
    final isNight = widget.period == ScenePeriod.night;
    final content = Container(
      width: hearthWidth,
      height: hearthHeight,
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: AppColors.ember.withValues(alpha: 0.15),
            blurRadius: isNight ? 60 : 40,
            spreadRadius: -8,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: _HearthLevelImage(
              width: hearthWidth,
              height: hearthHeight,
              fireLevel: fireLevel,
              hearthDropCount: hearthDropCount,
              isHovering: isHovering,
              burning: burning,
            ),
          ),
          Positioned.fill(
            child: ExcludeSemantics(
              child: IgnorePointer(
                child: CustomPaint(
                  painter: HearthSparkPainter(
                    streak: sparkIntensity,
                    timeSeconds: sparkTime,
                    origin: Offset(hearthWidth / 2, hearthHeight * 0.85),
                    brightnessBoost: brightnessBoost,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
    if (isColdHearth) {
      return ColorFiltered(
        colorFilter: const ColorFilter.matrix([
          0.882,
          0.107,
          0.011,
          0.0,
          0.0,
          0.032,
          0.957,
          0.011,
          0.0,
          0.0,
          0.032,
          0.107,
          0.911,
          0.0,
          0.0,
          0.0,
          0.0,
          0.0,
          1.0,
          0.0,
        ]),
        child: content,
      );
    }
    return content;
  }
}

class _PendingBurnContext {
  const _PendingBurnContext({
    required this.nodeId,
    required this.slotId,
    required this.mountainId,
    required this.title,
    required this.isStarred,
    required this.isLastInMountain,
  });

  final String nodeId;
  final String slotId;
  final String mountainId;
  final String title;
  final bool isStarred;
  final bool isLastInMountain;
}

/// Gold ember burst overlay for mountain summit celebration.
class _EmberBurstOverlay extends StatefulWidget {
  const _EmberBurstOverlay({required this.origin, required this.onComplete});

  final Offset origin;
  final VoidCallback onComplete;

  @override
  State<_EmberBurstOverlay> createState() => _EmberBurstOverlayState();
}

class _EmberBurstOverlayState extends State<_EmberBurstOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_EmberParticle> _particles = [];

  @override
  void initState() {
    super.initState();
    final rng = math.Random();
    for (var i = 0; i < 12; i++) {
      final angle = (70 + rng.nextDouble() * 40) * math.pi / 180;
      final speed = 60 + rng.nextDouble() * 90;
      _particles.add(_EmberParticle(angle: angle, speed: speed));
    }
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..forward().whenComplete(widget.onComplete);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Stack(
            clipBehavior: Clip.none,
            children: _particles.map((p) => _buildParticle(p)).toList(),
          );
        },
      ),
    );
  }

  Widget _buildParticle(_EmberParticle p) {
    final t = _controller.value;
    final x = math.cos(p.angle) * p.speed * t;
    final y = -math.sin(p.angle) * p.speed * t;
    final opacity = (1 - t).clamp(0.0, 1.0);
    return Positioned(
      left: widget.origin.dx + x - 4,
      top: widget.origin.dy + y - 4,
      child: Opacity(
        opacity: opacity,
        child: Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.gold,
          ),
        ),
      ),
    );
  }
}

class _EmberParticle {
  _EmberParticle({required this.angle, required this.speed});
  final double angle;
  final double speed;
}

/// Hearth image: asset by drop count (Sizzle / High / extra_high), AnimatedSwitcher for smooth transitions.
class _HearthLevelImage extends StatelessWidget {
  const _HearthLevelImage({
    required this.width,
    required this.height,
    required this.fireLevel,
    required this.hearthDropCount,
    required this.isHovering,
    required this.burning,
  });

  final double width;
  final double height;
  final int fireLevel;
  final int hearthDropCount;
  final bool isHovering;
  final bool burning;

  static String _assetForDropCount(int dropCount) {
    if (dropCount >= 3) return 'assets/hearth/hearth_extra_high.png';
    if (dropCount >= 1) return 'assets/hearth/Hearth_High.png';
    return 'assets/hearth/Hearth_Sizzle.png';
  }

  @override
  Widget build(BuildContext context) {
    final assetPath = _assetForDropCount(hearthDropCount);
    return SizedBox(
      width: width,
      height: height,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 700),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        layoutBuilder: (currentChild, previousChildren) {
          return Stack(
            fit: StackFit.expand,
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: <Widget>[
              ...previousChildren,
              ?currentChild,
            ],
          );
        },
        transitionBuilder: (child, animation) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
            reverseCurve: Curves.easeInCubic,
          );
          return FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.88, end: 1.0).animate(curved),
              child: child,
            ),
          );
        },
        child: Image.asset(
          assetPath,
          key: ValueKey(assetPath),
          width: width,
          height: height,
          fit: BoxFit.contain,
          alignment: Alignment.bottomCenter,
          errorBuilder: (_, __, ___) =>
              _HearthFallback(isHovering: isHovering, burning: burning),
        ),
      ),
    );
  }
}

/// Fallback when watercolor hearth assets are missing.
class _HearthFallback extends StatelessWidget {
  const _HearthFallback({required this.isHovering, required this.burning});
  final bool isHovering;
  final bool burning;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: isHovering ? 120 : 96,
      height: isHovering ? 120 : 96,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isHovering
            ? AppColors.ember.withValues(alpha: burning ? 0.5 : 0.3)
            : Colors.black26,
        border: Border.all(
          color: isHovering ? AppColors.ember : AppColors.slotBorder,
          width: isHovering ? 2 : 1,
        ),
        boxShadow: isHovering
            ? [
                BoxShadow(
                  color: AppColors.ember.withValues(alpha: burning ? 0.7 : 0.4),
                  blurRadius: burning ? 32 : 24,
                  spreadRadius: burning ? 8 : 4,
                ),
              ]
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.local_fire_department,
            size: isHovering ? 40 : 32,
            color: isHovering ? AppColors.ember : AppColors.ashGrey,
          ),
          const SizedBox(height: 4),
          Text(
            'THE HEARTH',
            style: TextStyle(
              color: isHovering ? AppColors.ember : AppColors.ashGrey,
              fontSize: 8,
              letterSpacing: 2,
              fontFamily: 'Georgia',
            ),
          ),
        ],
      ),
    );
  }
}

// ── Sanctuary bottom dock: stones + nav (Guide / Whetstone / Map / Satchel — frequent pair on the right for thumb reach).

class _SanctuaryCampDock extends StatelessWidget {
  const _SanctuaryCampDock({
    required this.sceneFadeHeight,
    required this.contentHeight,
    required this.satchelState,
    required this.focusOnHearth,
    required this.onEmptySlotTap,
    this.onDragStartedWhenLocked,
    required this.mountains,
    required this.onMapTap,
    required this.onSatchelTap,
    required this.onWhetstoneTap,
    required this.onGuideTap,
  });

  /// Soft vertical bleed painted over the illustration so the dock is not a hard cut.
  final double sceneFadeHeight;
  /// Slots + nav tiles (excludes [sceneFadeHeight]).
  final double contentHeight;
  final SatchelState satchelState;
  final bool focusOnHearth;
  final VoidCallback onEmptySlotTap;
  final VoidCallback? onDragStartedWhenLocked;
  final List<Mountain> mountains;
  final VoidCallback onMapTap;
  final VoidCallback onSatchelTap;
  final VoidCallback onWhetstoneTap;
  final VoidCallback onGuideTap;

  @override
  Widget build(BuildContext context) {
    // All six tray positions: show locked rocks for packed-not-ready, runes when ready, empty cells otherwise.
    final homeTraySlots = List<SatchelSlot>.from(satchelState.slots)
      ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));
    final filledCount = homeTraySlots.where((s) => !s.isEmpty).length;
    const slotCapacity = 6;

    return Stack(
      clipBehavior: Clip.none,
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0.0, 0.18, 0.42, 0.72, 1.0],
                colors: [
                  AppColors.parchment.withValues(alpha: 0.0),
                  const Color(0xFFC4A574).withValues(alpha: 0.14),
                  const Color.fromRGBO(80, 52, 28, 0.42),
                  const Color.fromRGBO(60, 35, 10, 0.72),
                  const Color.fromRGBO(48, 28, 8, 0.9),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: contentHeight,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.parchment.withValues(alpha: 0.06),
                        AppColors.parchment.withValues(alpha: 0.22),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.whetLine.withValues(alpha: 0.28),
                    ),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (filledCount < slotCapacity) ...[
                          Text(
                            '$filledCount/$slotCapacity',
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 9,
                              color: AppColors.whetPaper.withValues(alpha: 0.85),
                            ),
                          ),
                          const SizedBox(width: 4),
                        ],
                        ...homeTraySlots.map(
                          (slot) => Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 1),
                            child: _CompactSlot(
                              slot: slot,
                              focusOnHearth: focusOnHearth,
                              onEmptyTap: onEmptySlotTap,
                              onDragStartedWhenLocked:
                                  onDragStartedWhenLocked,
                              forDock: true,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  height: 2,
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    gradient: LinearGradient(
                      colors: [
                        AppColors.ember.withValues(alpha: 0.0),
                        AppColors.ember.withValues(alpha: 0.55),
                        AppColors.goldenLight.withValues(alpha: 0.35),
                        AppColors.ember.withValues(alpha: 0.55),
                        AppColors.ember.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 3),
                Expanded(
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      // Least-used on the left; Map + Satchel on the right for thumb reach (typical one-hand grip).
                      children: [
                      _CampNavTile(
                        icon: Icons.menu_book_outlined,
                        label: 'Guide',
                        compact: true,
                        selected: false,
                        semanticsHint:
                            'Same counsel as tapping Elias — path, pack, guidance, archive, settings.',
                        tooltip: 'Same menu as tapping Elias on screen.',
                        onTap: onGuideTap,
                      ),
                      _CampNavTile(
                        icon: Icons.auto_fix_high,
                        label: 'Whetstone',
                        compact: true,
                        selected: false,
                        semanticsHint: 'Sharpen daily habits.',
                        tooltip: 'Open the whetstone.',
                        onTap: onWhetstoneTap,
                      ),
                      _CampNavTile(
                        icon: Icons.map_outlined,
                        label: 'Map',
                        compact: true,
                        selected: false,
                        semanticsHint: 'Your peaks and climbing paths.',
                        tooltip: 'Open the map of your peaks.',
                        onTap: onMapTap,
                      ),
                      _CampNavTile(
                        icon: Icons.backpack_outlined,
                        label: 'Satchel',
                        compact: true,
                        selected: false,
                        semanticsHint: 'Stones you carry for the hearth.',
                        tooltip: 'Open your satchel.',
                        onTap: onSatchelTap,
                      ),
                    ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Positioned(
          top: sceneFadeHeight + 2,
          right: 6,
          child: ListenableBuilder(
            listenable: DataFreshness.instance,
            builder: (context, _) {
              final showingCached = DataFreshness.instance.isShowingCachedData;
              return IgnorePointer(
                ignoring: !showingCached,
                child: Tooltip(
                  message: 'Showing saved data',
                  child: AnimatedOpacity(
                    opacity: showingCached ? 1 : 0,
                    duration: const Duration(milliseconds: 500),
                    child: Icon(
                      Icons.auto_stories,
                      size: 16,
                      color: AppColors.whetPaper.withValues(alpha: 0.75),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CampNavTile extends StatelessWidget {
  const _CampNavTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.semanticsHint,
    this.tooltip,
    this.compact = false,
    this.selected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? semanticsHint;
  final String? tooltip;
  final bool compact;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 17.0 : 20.0;
    final fontSize = compact ? 8.0 : 9.0;
    final vPad = compact ? 3.0 : 5.0;
    final surface = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(10),
        splashColor: AppColors.ember.withValues(alpha: 0.15),
        highlightColor: AppColors.ember.withValues(alpha: 0.08),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: selected ? 0.98 : 0.88),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? AppColors.ember.withValues(alpha: 0.55)
                  : AppColors.whetLine.withValues(alpha: 0.65),
              width: selected ? 1.25 : 1,
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.ember.withValues(alpha: 0.22),
                      blurRadius: 8,
                      spreadRadius: 0,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          padding: EdgeInsets.symmetric(vertical: vPad, horizontal: 2),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(
                child: Icon(
                  icon,
                  size: iconSize,
                  color: AppColors.darkWalnut.withValues(
                    alpha: selected ? 1.0 : 0.94,
                  ),
                ),
              ),
              SizedBox(height: compact ? 2 : 3),
              ExcludeSemantics(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: fontSize,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.15,
                    color: AppColors.whetInk.withValues(
                      alpha: selected ? 0.98 : 0.88,
                    ),
                    height: 1.0,
                    decoration: selected
                        ? TextDecoration.underline
                        : TextDecoration.none,
                    decorationColor: AppColors.ember.withValues(alpha: 0.75),
                    decorationThickness: 1,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    final wrapped = tooltip != null && tooltip!.isNotEmpty
        ? Tooltip(message: tooltip!, child: surface)
        : surface;

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Semantics(
          button: true,
          label: label,
          hint: semanticsHint,
          child: wrapped,
        ),
      ),
    );
  }
}

/// Wraps the Satchel icon with a gold breathing pulse (BoxShadow) when empty state.
/// Uses sine wave for organic "breath" — firelight from Hearth reaching the bag.
class _SatchelIconWithPulse extends StatefulWidget {
  const _SatchelIconWithPulse({required this.showPulse, required this.child});

  final bool showPulse;
  final Widget child;

  @override
  State<_SatchelIconWithPulse> createState() => _SatchelIconWithPulseState();
}

class _SatchelIconWithPulseState extends State<_SatchelIconWithPulse>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.showPulse) return widget.child;
    // Sine wave: 0 at start, 1 at middle, 0 at end — organic breath
    final breath = math.sin(_controller.value * math.pi);
    final blur = 8 + breath * 12;
    final spread = breath * 4;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: AppColors.ember.withValues(alpha: 0.4),
            blurRadius: blur,
            spreadRadius: spread,
          ),
        ],
      ),
      child: widget.child,
    );
  }
}

class _CompactSlot extends StatelessWidget {
  const _CompactSlot({
    required this.slot,
    required this.focusOnHearth,
    required this.onEmptyTap,
    this.onDragStartedWhenLocked,
    this.forDock = false,
  });
  final SatchelSlot slot;
  final bool focusOnHearth;
  final VoidCallback onEmptyTap;
  final VoidCallback? onDragStartedWhenLocked;
  /// Smaller, lighter stones on the sanctuary dock (avoids a heavy dark strip).
  final bool forDock;

  @override
  Widget build(BuildContext context) {
    final dim = forDock ? 40.0 : 56.0;
    final innerStone = forDock ? 34.0 : 48.0;
    if (slot.isEmpty) {
      return Semantics(
        label: 'Empty satchel slot, opens guide menu',
        button: true,
        child: GestureDetector(
          onTap: onEmptyTap,
          child: Container(
            width: dim,
            height: dim,
            decoration: BoxDecoration(
              color: forDock
                  ? AppColors.satchelSlotEmpty.withValues(alpha: 0.22)
                  : AppColors.slotEmpty,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(
                color: forDock
                    ? AppColors.whetLine.withValues(alpha: 0.22)
                    : AppColors.slotBorder.withValues(alpha: 0.65),
                width: forDock ? 0.5 : 1,
              ),
            ),
          ),
        ),
      );
    }

    final showEmberPulse = focusOnHearth && slot.readyToBurn;
    // Stones always visible: neutral (no ring/bg) when not ready, ember ring when ready.
    final stoneVisual = Container(
      width: dim,
      height: dim,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: slot.readyToBurn ? AppColors.slotFilled : Colors.transparent,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: slot.readyToBurn
              ? AppColors.ember
              : slot.node?.isStarred == true
              ? AppColors.gold.withValues(alpha: 0.6)
              : AppColors.slotBorder.withValues(alpha: 0.4),
          width: slot.readyToBurn ? 1.5 : 1,
        ),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: SizedBox(
          width: innerStone,
          height: innerStone,
          child: Image.asset(
            satchelStoneImagePath(slot.node, readyToBurn: slot.readyToBurn),
            fit: BoxFit.contain,
            opacity: const AlwaysStoppedAnimation(1),
            errorBuilder: (_, __, ___) => Icon(
              Icons.local_fire_department,
              size: forDock ? 18 : 24,
              color: slot.readyToBurn ? AppColors.ember : AppColors.slotBorder,
            ),
          ),
        ),
      ),
    );

    Widget wrapped = stoneVisual;
    if (showEmberPulse) {
      wrapped = _EmberPulseSlot(child: stoneVisual);
    }

    if (!slot.readyToBurn) {
      return Semantics(
        label: 'SatchelStoneLocked',
        child: _LockedStoneDrag(
          onSnapBack: onDragStartedWhenLocked,
          child: wrapped,
        ),
      );
    }

    return Semantics(
      label: 'SatchelStoneReady',
      child: Draggable<String>(
        data: slot.nodeId!,
        feedback: _StoneFeedback(
          title: slot.node?.title ?? '',
          imagePath: satchelStoneImagePath(slot.node, readyToBurn: true),
        ),
        childWhenDragging: Container(
          width: dim,
          height: dim,
          decoration: BoxDecoration(
            color: forDock
                ? AppColors.satchelSlotEmpty.withValues(alpha: 0.35)
                : AppColors.slotEmpty,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: AppColors.slotBorder.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
        ),
        child: wrapped,
      ),
    );
  }
}

/// Locked stone: user can only drag a little (clamped to [kMaxLockedDragPx]) then it snaps back and [onSnapBack] is called (Elias message).
class _LockedStoneDrag extends StatefulWidget {
  const _LockedStoneDrag({required this.child, this.onSnapBack});
  final Widget child;
  final VoidCallback? onSnapBack;

  static const double kMaxLockedDragPx = 44;

  @override
  State<_LockedStoneDrag> createState() => _LockedStoneDragState();
}

class _LockedStoneDragState extends State<_LockedStoneDrag>
    with SingleTickerProviderStateMixin {
  Offset _offset = Offset.zero;
  late AnimationController _snapController;
  late Animation<Offset> _snapAnimation;

  @override
  void initState() {
    super.initState();
    _snapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _snapAnimation = Tween<Offset>(
      begin: Offset.zero,
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _snapController, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _snapController.dispose();
    super.dispose();
  }

  void _snapBack() {
    if (_offset == Offset.zero) return;
    final from = _offset;
    final didDragEnough = from.distance >= 8;
    _snapAnimation = Tween<Offset>(
      begin: from,
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _snapController, curve: Curves.easeOut));
    _snapController.reset();
    _snapController.forward().then((_) {
      if (didDragEnough) widget.onSnapBack?.call();
    });
    setState(() => _offset = Offset.zero);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: (_) {},
      onPanUpdate: (details) {
        setState(() {
          _offset += details.delta;
          final d = _offset.distance;
          if (d > _LockedStoneDrag.kMaxLockedDragPx) {
            _offset = Offset.fromDirection(
              _offset.direction,
              _LockedStoneDrag.kMaxLockedDragPx,
            );
          }
        });
      },
      onPanEnd: (_) => _snapBack(),
      child: AnimatedBuilder(
        animation: _snapController,
        builder: (context, child) {
          final offset = _snapController.isAnimating
              ? _snapAnimation.value
              : _offset;
          return Transform.translate(offset: offset, child: child);
        },
        child: widget.child,
      ),
    );
  }
}

/// Ember Pulse: blur 4->12->4 over 2.5s when focusOnHearth AND slot readyToBurn.
class _EmberPulseSlot extends StatefulWidget {
  const _EmberPulseSlot({required this.child});
  final Widget child;

  @override
  State<_EmberPulseSlot> createState() => _EmberPulseSlotState();
}

class _EmberPulseSlotState extends State<_EmberPulseSlot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _blurAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);
    _blurAnimation = Tween<double>(
      begin: 4.0,
      end: 12.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _blurAnimation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            boxShadow: [
              BoxShadow(
                color: const Color(0x88FF8C00).withValues(alpha: 0.5),
                blurRadius: _blurAnimation.value,
                spreadRadius: 0,
              ),
            ],
          ),
          child: widget.child,
        );
      },
    );
  }
}

class _StoneFeedback extends StatelessWidget {
  const _StoneFeedback({required this.title, required this.imagePath});
  final String title;
  final String imagePath;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: SizedBox(
        width: 56,
        height: 56,
        child: Image.asset(
          imagePath,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.darkWalnut,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const SizedBox(width: 16, height: 16),
          ),
        ),
      ),
    );
  }
}

// ── Sanctuary Icon Button ─────────────────────────────────────

// ── Elias Speech Bubble ───────────────────────────────────────
//
// Watches eliasMessageProvider and shows an animated bubble
// when a message is set. Auto-clears after 4 seconds.

class _EliasBubble extends ConsumerStatefulWidget {
  const _EliasBubble({required this.period, required this.isNight});
  final ScenePeriod period;
  final bool isNight;

  @override
  ConsumerState<_EliasBubble> createState() => _EliasBubbleState();
}

class _EliasBubbleState extends ConsumerState<_EliasBubble> {
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Session greeting / quest step 1 — only after home intro is done ([hasSeenSanctuaryHomeIntroProvider] true).
  Future<void> _emitSessionGreeting() async {
    if (!mounted || ref.read(hasShownSessionGreetingProvider)) return;
    final mountains = ref.read(mountainListProvider).valueOrNull ?? [];
    final whetstone = ref.read(whetstoneProvider);
    final isEmpty = mountains.isEmpty && whetstone.items.isEmpty;
    if (isEmpty) {
      ref.read(eliasMessageProvider.notifier).state =
          EliasDialogue.firstLandQuestStep1();
      await markQuestStep1Seen();
    } else {
      final displayName = ref.read(profileProvider).valueOrNull?.displayName;
      ref.read(eliasMessageProvider.notifier).state = math.Random().nextBool()
          ? EliasDialogue.timeOfDayGreeting(widget.period)
          : EliasDialogue.sanctuaryPeriodGreeting(
              widget.period,
              displayName,
            );
    }
    if (mounted) {
      ref.read(hasShownSessionGreetingProvider.notifier).state = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<bool>>(hasSeenSanctuaryHomeIntroProvider, (
      AsyncValue<bool>? prev,
      AsyncValue<bool> next,
    ) {
      final now = next.valueOrNull;
      if (now != true) return;
      final was = prev?.valueOrNull;
      if (was == true) return;
      if (ref.read(hasShownSessionGreetingProvider)) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || ref.read(hasShownSessionGreetingProvider)) return;
        _emitSessionGreeting();
      });
    });

    ref.listen<String?>(eliasMessageProvider, (prev, next) {
      if (next != null) {
        _timer?.cancel();
        _timer = Timer(const Duration(seconds: 4), () {
          if (mounted) {
            ref.read(eliasMessageProvider.notifier).state = null;
          }
        });
      }
    });

    final message = ref.watch(eliasMessageProvider);
    if (message == null) return const SizedBox.shrink();

    return _SpeechBubble(
      message: message,
      isNight: widget.isNight,
      onDismiss: () {
        ref.read(eliasMessageProvider.notifier).state = null;
      },
    );
  }
}

class _SpeechBubble extends StatefulWidget {
  const _SpeechBubble({
    required this.message,
    required this.isNight,
    required this.onDismiss,
  });
  final String message;
  final bool isNight;
  final VoidCallback onDismiss;

  @override
  State<_SpeechBubble> createState() => _SpeechBubbleState();
}

class _SpeechBubbleState extends State<_SpeechBubble>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<int> _charCount;

  @override
  void initState() {
    super.initState();
    _setupAnimation();
  }

  @override
  void didUpdateWidget(covariant _SpeechBubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message != widget.message) {
      _controller.reset();
      _setupAnimation();
      _controller.forward();
    }
  }

  void _setupAnimation() {
    _controller = AnimationController(
      vsync: this,
      duration: Duration(
        milliseconds: (widget.message.length * 25).clamp(300, 3000),
      ),
    );
    _charCount = StepTween(
      begin: 0,
      end: widget.message.length,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.linear));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
          liveRegion: true,
          label: widget.message,
          child: AnimatedBuilder(
            animation: _charCount,
            builder: (context, _) {
              final n = _charCount.value.clamp(0, widget.message.length);
              final visible = widget.message.substring(0, n);
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    constraints: BoxConstraints(
                      maxWidth: math.min(
                        MediaQuery.sizeOf(context).width * 0.75,
                        320,
                      ),
                      minWidth: 160,
                    ),
                    padding: const EdgeInsets.fromLTRB(8, 4, 8, 10),
                    decoration: BoxDecoration(
                      color: AppColors.whetPaper,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(2),
                        topRight: Radius.circular(8),
                        bottomRight: Radius.circular(8),
                        bottomLeft: Radius.circular(8),
                      ),
                      border: Border.all(color: AppColors.whetLine, width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Align(
                          alignment: Alignment.topRight,
                          child: Semantics(
                            label: 'Dismiss Elias message',
                            button: true,
                            child: IconButton(
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                minWidth: 36,
                                minHeight: 32,
                              ),
                              icon: Icon(
                                Icons.close,
                                size: 18,
                                color: AppColors.whetInk.withValues(
                                  alpha: 0.65,
                                ),
                              ),
                              tooltip: 'Dismiss',
                              onPressed: widget.onDismiss,
                            ),
                          ),
                        ),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 150),
                          child: SingleChildScrollView(
                            child: SelectionContainer.disabled(
                              child: Text(
                                visible,
                                style: EliasTypography.style(
                                  color: widget.isNight
                                      ? AppColors.whetInk.withValues(
                                          alpha: 0.86,
                                        )
                                      : AppColors.whetInk,
                                ),
                                softWrap: true,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    right: 4,
                    bottom: -14,
                    child: CustomPaint(
                      size: const Size(40, 16),
                      painter: _SpeechBubbleTailToEliasPainter(
                        color: AppColors.whetPaper,
                        borderColor: AppColors.whetLine,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        )
        .animate()
        .fadeIn(duration: 350.ms, curve: Curves.easeInOut)
        .slideY(begin: 0.08, end: 0, duration: 350.ms, curve: Curves.easeInOut);
  }
}

/// Tail from the bubble’s bottom-right toward Elias (below / slightly left).
class _SpeechBubbleTailToEliasPainter extends CustomPainter {
  _SpeechBubbleTailToEliasPainter({
    required this.color,
    required this.borderColor,
  });
  final Color color;
  final Color borderColor;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width, 0)
      ..lineTo(size.width - 26, 0)
      ..lineTo(size.width - 6, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(
      path,
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(covariant _SpeechBubbleTailToEliasPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.borderColor != borderColor;
}
