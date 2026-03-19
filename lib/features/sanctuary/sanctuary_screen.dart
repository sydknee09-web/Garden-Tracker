import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../providers/active_pebbles_provider.dart';
import '../../providers/sanctuary_initialization_provider.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/narrow_invalidation.dart';
import '../../providers/node_provider.dart';
import '../../providers/elias_provider.dart';
import '../../providers/streak_provider.dart';
import '../../providers/hearth_fuel_provider.dart';
import '../../providers/first_run_provider.dart';
import '../../providers/sound_settings_provider.dart';
import '../../providers/whetstone_provider.dart';
import '../../providers/profile_provider.dart';
import '../../data/models/mountain.dart';
import '../../data/models/satchel_slot.dart';
import '../../widgets/elias_silhouette.dart';
import '../../widgets/hearth_spark_painter.dart';
import '../../widgets/sanctuary_background.dart';
import '../management/management_menu_sheet.dart';

class SanctuaryScreen extends ConsumerWidget {
  const SanctuaryScreen({super.key, this.focusOnHearth = false});
  final bool focusOnHearth;

  static const String _eliasGuidePose = 'assets/elias/elias_guide_pose.png';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(sanctuaryInitializationProvider);
    final period = ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    final satchel = ref.watch(satchelProvider);
    final hasSeenHomeIntro = ref.watch(hasSeenSanctuaryHomeIntroProvider).valueOrNull;
    final showHomeIntro = hasSeenHomeIntro == false;

    final size = MediaQuery.sizeOf(context);
    final pivotX = size.width * 0.5;
    final pivotY = size.height * 0.65;

    return Scaffold(
      key: const ValueKey('screen_sanctuary'),
      body: _SanctuaryOnMovementLayer(
        overlayActive: showHomeIntro,
        child: Stack(
          fit: StackFit.expand,
          children: [
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
                children: [
                  Positioned(
                    left: size.width * 0.55,
                    right: size.width * 0.02,
                    bottom: size.height * 0.28,
                    child: Align(
                      alignment: Alignment.bottomRight,
                      child: Semantics(
                        label: 'Elias',
                        button: true,
                        child: _EliasTapTarget(
                          period: period,
                          showHomeIntro: showHomeIntro,
                          eliasGuidePose: _eliasGuidePose,
                          onTap: () => _openManagement(context, ref),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: size.width * 0.06,
                    right: size.width * 0.06,
                    bottom: size.height * 0.26,
                    child: Semantics(
                      label: 'Hearth',
                      child: _HearthWidget(),
                    ),
                  ),
                  Positioned(
                    left: size.width * 0.5,
                    right: size.width * 0.06,
                    bottom: size.height * 0.28 +
                        (size.height * 0.5).clamp(180.0, 480.0) +
                        12.0,
                    child: Align(
                      alignment: Alignment.bottomRight,
                      child: _EliasBubble(period: period),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Layer 3 (UI): SafeArea — EliasBubble, Dismiss, CompactSatchelTray
          SafeArea(
            child: LayoutBuilder(
              builder: (context, layerConstraints) {
                final trayMaxHeight = (layerConstraints.maxHeight * 0.10).clamp(55.0, 80.0);
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    if (ref.watch(eliasMessageProvider) != null)
                      Positioned.fill(
                        child: GestureDetector(
                          onTap: () =>
                              ref.read(eliasMessageProvider.notifier).state = null,
                          behavior: HitTestBehavior.translucent,
                          child: const SizedBox.expand(),
                        ),
                      ),
                    if (ref.watch(hearthCelebrationProvider))
                      Positioned.fill(
                        child: _CelebrationOverlay(
                          onComplete: () =>
                              ref.read(hearthCelebrationProvider.notifier).state = false,
                        ),
                      ),
                    if (showHomeIntro)
                      Positioned.fill(
                        child: _SanctuaryHomeIntroOverlay(
                          onComplete: () async {
                            await markSanctuaryHomeIntroSeen();
                            ref.invalidate(hasSeenSanctuaryHomeIntroProvider);
                          },
                        ),
                      ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: MediaQuery.viewPaddingOf(context).bottom + 40,
                      height: trayMaxHeight,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: trayMaxHeight),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.bottomCenter,
                          child: SizedBox(
                            width: layerConstraints.maxWidth,
                            height: 70,
                            child: _CompactSatchelTray(
                              satchelState: satchel,
                              focusOnHearth: focusOnHearth,
                              overflowCount: ref.watch(packCandidatesProvider).valueOrNull?.length ?? 0,
                              onBagTap: () {
                                context.go('/sanctuary');
                                context.push(AppRoutes.satchel);
                              },
                              onEmptySlotTap: () => _openManagement(context, ref),
                              onDragStartedWhenLocked: () {
                                ref.read(eliasMessageProvider.notifier).state = EliasDialogue.markDoneToDrop();
                              },
                              mountains: ref.watch(mountainListProvider).valueOrNull ?? [],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
      ),
    );
  }

  void _openManagement(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => const ManagementMenuSheet(),
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
          child: Text(
            'The fire roars. Well done.',
            style: EliasTypography.style(color: AppColors.parchment),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

// ── Sanctuary Home Intro (spotlight + gold ring) ─────────────────────────────

class _SanctuarySpotlightPainter extends CustomPainter {
  _SanctuarySpotlightPainter({
    required this.targetRect,
    required this.isCircle,
    required this.pulseValue,
    this.glowColor = AppColors.gold,
  });

  final Rect targetRect;
  final bool isCircle;
  final double pulseValue;
  final Color glowColor;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint scrimPaint = Paint()..color = Colors.black54;
    final Path screenPath = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final Path cutoutPath = Path();
    if (isCircle) {
      cutoutPath.addOval(targetRect);
    } else {
      cutoutPath.addRRect(
        RRect.fromRectAndRadius(targetRect, const Radius.circular(12)),
      );
    }
    final Path mainScrimPath = Path.combine(
      PathOperation.difference,
      screenPath,
      cutoutPath,
    );
    canvas.drawPath(mainScrimPath, scrimPaint);

    final Paint ringPaint = Paint()
      ..color = glowColor.withOpacity(pulseValue)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..maskFilter = const MaskFilter.blur(BlurStyle.outer, 3.0);
    if (isCircle) {
      canvas.drawOval(targetRect, ringPaint);
    } else {
      canvas.drawRRect(
        RRect.fromRectAndRadius(targetRect, const Radius.circular(12)),
        ringPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SanctuarySpotlightPainter oldDelegate) {
    return oldDelegate.targetRect != targetRect ||
        oldDelegate.pulseValue != pulseValue;
  }
}

Rect _homeIntroTargetRect(int step, Size size, EdgeInsets padding) {
  switch (step) {
    case 0:
      return Rect.fromLTWH(
        size.width * 0.78,
        size.height - padding.bottom - (size.height * 0.17),
        size.width * 0.18,
        size.height * 0.12,
      );
    case 1:
      return Rect.fromLTWH(
        size.width * 0.04,
        size.height - padding.bottom - (size.height * 0.17),
        size.width * 0.72,
        size.height * 0.12,
      );
    case 2:
      return Rect.fromCenter(
        center: Offset(size.width * 0.5, size.height * 0.62),
        width: size.width * 0.3,
        height: size.height * 0.2,
      );
    default:
      return Rect.zero;
  }
}

class _SanctuaryHomeIntroOverlay extends StatefulWidget {
  const _SanctuaryHomeIntroOverlay({required this.onComplete});
  final Future<void> Function() onComplete;

  @override
  State<_SanctuaryHomeIntroOverlay> createState() =>
      _SanctuaryHomeIntroOverlayState();
}

class _SanctuaryHomeIntroOverlayState extends State<_SanctuaryHomeIntroOverlay>
    with SingleTickerProviderStateMixin {
  int _step = 0;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  bool _fadeInComplete = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    Future.delayed(const Duration(milliseconds: 200), () {
      if (mounted) setState(() => _fadeInComplete = true);
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _onContinue() {
    if (_step < 2) {
      setState(() => _step++);
      return;
    }
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final padding = MediaQuery.viewPaddingOf(context);
    final rect = _homeIntroTargetRect(_step, size, padding);
    final isCircle = _step == 2;
    final line = _step == 0
        ? EliasDialogue.sanctuaryHomeIntroSatchel
        : _step == 1
            ? EliasDialogue.sanctuaryHomeIntroPathAhead
            : EliasDialogue.sanctuaryHomeIntroFirepit;

    return AnimatedOpacity(
      opacity: _fadeInComplete ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 200),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {},
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                return CustomPaint(
                  painter: _SanctuarySpotlightPainter(
                    targetRect: rect,
                    isCircle: isCircle,
                    pulseValue: _pulseAnimation.value,
                    glowColor: AppColors.gold,
                  ),
                );
              },
            ),
            Positioned(
              left: _step == 0 ? size.width * 0.08 : size.width * 0.2,
              top: _step == 2 ? null : size.height * (_step == 0 ? 0.12 : 0.1),
              bottom: _step == 2 ? size.height * 0.32 : null,
              right: _step == 0 ? size.width * 0.4 : size.width * (_step == 1 ? 0.2 : 0.5),
              child: Text(
                line,
                style: EliasTypography.style(color: AppColors.parchment),
                textAlign: _step == 1 ? TextAlign.center : TextAlign.left,
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: EdgeInsets.only(bottom: padding.bottom + 16),
                  child: FilledButton(
                    onPressed: _onContinue,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ember,
                      foregroundColor: AppColors.parchment,
                    ),
                    child: const Text(
                      'Continue',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
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

// ── Elias ────────────────────────────────────────────────────

/// Wraps Elias with a single, reliable tap target (min 80x80) so the menu opens consistently.
class _EliasTapTarget extends StatelessWidget {
  const _EliasTapTarget({
    required this.period,
    required this.showHomeIntro,
    required this.eliasGuidePose,
    required this.onTap,
  });
  final ScenePeriod period;
  final bool showHomeIntro;
  final String? eliasGuidePose;
  final VoidCallback onTap;

  static const double _minTapSize = 80;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: _minTapSize, minHeight: _minTapSize),
        child: _EliasWidget(
          period: period,
          showGreeting: false,
          assetPathOverride: showHomeIntro ? eliasGuidePose : null,
        ),
      ),
    ).animate().fadeIn(duration: 600.ms, delay: 200.ms);
  }
}

class _EliasWidget extends ConsumerWidget {
  const _EliasWidget({
    required this.period,
    this.showGreeting = true,
    this.assetPathOverride,
  });
  final ScenePeriod period;
  final bool showGreeting;
  /// When set (e.g. during Sanctuary home intro), use this pose instead of time-of-day.
  final String? assetPathOverride;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = MediaQuery.sizeOf(context);
    final w = ((size.width * 0.65).clamp(120.0, 320.0)) * 0.75;
    final h = ((size.height * 0.5).clamp(180.0, 480.0)) * 0.75;
    return EliasWidget(
      period: period,
      width: w,
      height: h,
      showGreeting: showGreeting,
      greetingWidth: (w * 0.85).clamp(160.0, 280.0),
      assetPathOverride: assetPathOverride,
    );
  }
}

/// Listener for pan/drag on Sanctuary. Triggers [EliasDialogue.onMovement] only when
/// [overlayActive] is false (no Spotlight Scrim / Home Intro / Tutorial), so the
/// "Look at" guidance is not overwritten. Throttled to avoid spam.
class _SanctuaryOnMovementLayer extends ConsumerStatefulWidget {
  const _SanctuaryOnMovementLayer({
    required this.overlayActive,
    required this.child,
  });
  final bool overlayActive;
  final Widget child;

  @override
  ConsumerState<_SanctuaryOnMovementLayer> createState() =>
      _SanctuaryOnMovementLayerState();
}

class _SanctuaryOnMovementLayerState extends ConsumerState<_SanctuaryOnMovementLayer> {
  static const _throttleMs = 5000;
  int _lastTriggerTime = 0;

  void _onPointerMove(PointerMoveEvent event) {
    if (widget.overlayActive) return;
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
  const _HearthWidget();

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

  @override
  void initState() {
    super.initState();
    _sparkTimer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (mounted) setState(() => _sparkTime = DateTime.now().millisecondsSinceEpoch / 1000.0);
    });
    _brightnessController = AnimationController(
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
    // Center burst over Hearth area (bottom ~26%, center of screen)
    final originX = size.width * 0.5;
    final originY = size.height * 0.62;

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
    final weightPitch = 1.0 - (stoneCount - 1) * 0.02; // 1.0, 0.98, 0.96, 0.94, 0.92
    _weightAudio.setVolume(weightVolume);
    _weightAudio.setPlaybackRate(weightPitch);
    _weightAudio.play(AssetSource('sounds/weight.wav')).catchError((_) {
      _weightAudio.play(AssetSource('sounds/weight.mp3')).ignore();
    }).ignore();
  }

  @override
  Widget build(BuildContext context) {
    return DragTarget<String>(
      onWillAcceptWithDetails: (details) {
        final nodeId = (details.data ?? '').trim();
        if (nodeId.isEmpty) return false;
        final satchel = ref.read(satchelProvider.notifier).state;
        if (satchel.isBurnInProgress) return false;
        SatchelSlot? slot;
        for (final s in satchel.slots) {
          if ((s.nodeId ?? '').trim() == nodeId) { slot = s; break; }
        }
        return slot?.readyToBurn ?? false;
      },
      onAcceptWithDetails: (details) async {
        final nodeId = details.data;
        final nextCount = (ref.read(hearthDropCountProvider) >= 5)
            ? 5
            : ref.read(hearthDropCountProvider) + 1;
        ref.read(hearthDropCountProvider.notifier).state = nextCount;
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
        final node = slot?.node;
        final isLastPebble = mountainId != null &&
            (await ref.read(mountainActionsProvider).countIncompleteLeaves(mountainId)) == 1;
        final isLastInBoulder = node?.parentPath != null &&
            (await ref.read(nodeActionsProvider).countIncompleteLeavesForBoulder(node!.parentPath!)) == 1;

        if (isLastPebble) {
          HapticFeedback.heavyImpact();
        } else if (isLastInBoulder) {
          HapticFeedback.mediumImpact();
          Future.delayed(const Duration(milliseconds: 100), () {
            HapticFeedback.mediumImpact();
          });
        } else {
          HapticFeedback.lightImpact();
        }

        final burnedMountainId =
            await ref.read(satchelProvider.notifier).burnStone(nodeId);
        if (burnedMountainId != null) {
          invalidateAfterBurn(ref, burnedMountainId);
        }
        ref.invalidate(burnStreakProvider);
        ref.invalidate(hearthFuelProvider);
        if (context.mounted) context.go('/sanctuary');
        final fuelState = await ref.read(hearthFuelProvider.future);
        if (fuelState.shouldCelebrate && context.mounted) {
          ref.read(hearthCelebrationProvider.notifier).state = true;
        }
        final streakResult = await ref.read(burnStreakProvider.future);
        final seenFirstBurn = await ref.read(hasSeenFirstBurnProvider.future);

        final eliasLine = isLastPebble
            ? EliasDialogue.mountainSummit()
            : (!seenFirstBurn
                ? EliasDialogue.firstBurnLine()
                : (streakResult.currentStreak >= 2
                    ? EliasDialogue.burnStreakLine(streakResult.currentStreak)
                    : EliasDialogue.afterBurn()));
        ref.read(eliasMessageProvider.notifier).state = eliasLine;
        if (!seenFirstBurn) await markFirstBurnSeen();

        if (context.mounted) {
          _showEmberBurst(context);
        }

        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) setState(() => _burning = false);
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
        if (isHovering && !_brightnessController.isAnimating && _brightnessController.value < 1) {
          _brightnessController.forward();
        } else if (!isHovering && _brightnessController.value > 0) {
          _brightnessController.reverse();
        }
        final brightnessBoost = 1.0 + 0.5 * _brightnessController.value;

        const double hearthWidth = 200;
        final hearthHeight = hearthWidth * 0.9;
        final fuelState = ref.watch(hearthFuelProvider).valueOrNull;
        final fireLevel = (fuelState?.fireLevel ?? 3).clamp(0, 3);
        final scale = _burning ? 1.12 : 1.0;
        final streak = ref.watch(burnStreakProvider).valueOrNull?.currentStreak ?? 0;
        final sparkIntensity = math.max(streak, fireLevel);

        final isColdHearth = fireLevel == 0;
        return Center(
          child: AnimatedScale(
            scale: scale,
            duration: _burning
                ? const Duration(milliseconds: 120)
                : const Duration(milliseconds: 200),
            curve: _burning ? Curves.easeOut : Curves.easeInOut,
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
    final content = Container(
      width: hearthWidth,
      height: hearthHeight,
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: AppColors.ember.withValues(alpha: 0.15),
            blurRadius: 40,
            spreadRadius: -8,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          _HearthLevelImage(
            fireLevel: fireLevel,
            hearthDropCount: hearthDropCount,
            isHovering: isHovering,
            burning: burning,
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
          0.882, 0.107, 0.011, 0.0, 0.0,
          0.032, 0.957, 0.011, 0.0, 0.0,
          0.032, 0.107, 0.911, 0.0, 0.0,
          0.0, 0.0, 0.0, 1.0, 0.0,
        ]),
        child: content,
      );
    }
    return content;
  }
}

/// Gold ember burst overlay for mountain summit celebration.
class _EmberBurstOverlay extends StatefulWidget {
  const _EmberBurstOverlay({
    required this.origin,
    required this.onComplete,
  });

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
    required this.fireLevel,
    required this.hearthDropCount,
    required this.isHovering,
    required this.burning,
  });

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
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 500),
      child: Image.asset(
        assetPath,
        key: ValueKey(assetPath),
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => _HearthFallback(
          isHovering: isHovering,
          burning: burning,
        ),
      ),
    );
  }
}

/// Fallback when watercolor hearth assets are missing.
class _HearthFallback extends StatelessWidget {
  const _HearthFallback({
    required this.isHovering,
    required this.burning,
  });
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
                )
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

// ── Compact Satchel Tray ─────────────────────────────────────

class _CompactSatchelTray extends StatelessWidget {
  const _CompactSatchelTray({
    required this.satchelState,
    required this.focusOnHearth,
    required this.overflowCount,
    required this.onBagTap,
    required this.onEmptySlotTap,
    this.onDragStartedWhenLocked,
    required this.mountains,
  });

  final SatchelState satchelState;
  final bool focusOnHearth;
  final int overflowCount;
  final VoidCallback onBagTap;
  final VoidCallback onEmptySlotTap;
  final VoidCallback? onDragStartedWhenLocked;
  final List<Mountain> mountains;

  bool get _showPulseOfPurpose => mountains.isEmpty;

  @override
  Widget build(BuildContext context) {
    final filledCount = satchelState.slots.where((s) => !s.isEmpty).length;
    final slotCapacity = 6;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        border: Border(
          top: BorderSide(
            color: AppColors.slotBorder.withValues(alpha: 0.4),
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          if (filledCount < slotCapacity) ...[
            Text(
              '$filledCount/$slotCapacity',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 11,
                color: AppColors.slotBorder.withValues(alpha: 0.85),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: satchelState.slots
                  .map((slot) => Flexible(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: _CompactSlot(
                            slot: slot,
                            focusOnHearth: focusOnHearth,
                            onEmptyTap: onEmptySlotTap,
                            onDragStartedWhenLocked: onDragStartedWhenLocked,
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ),
          if (overflowCount > 0) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.darkWalnut,
                shape: BoxShape.circle,
              ),
              child: Text(
                '$overflowCount',
                style: const TextStyle(
                  color: AppColors.parchment,
                  fontSize: 12,
                  fontFamily: 'Georgia',
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 4),
          ],
          const SizedBox(width: 8),
          ListenableBuilder(
            listenable: DataFreshness.instance,
            builder: (context, _) {
              final showingCached = DataFreshness.instance.isShowingCachedData;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Semantics(
                    label: 'Satchel',
                    button: true,
                    child: GestureDetector(
                      key: const ValueKey('satchel_tap_target'),
                      behavior: HitTestBehavior.opaque,
                      onTap: onBagTap,
                      child: SizedBox(
                        width: 48,
                        height: 56,
                        child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _SatchelIconWithPulse(
                              showPulse: _showPulseOfPurpose,
                              child: Container(
                                width: 36,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Colors.black,
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(color: AppColors.slotBorder, width: 1),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Padding(
                                  padding: const EdgeInsets.all(6),
                                  child: Image.asset(
                                    'assets/satchel/satchel_closed.png',
                                    fit: BoxFit.contain,
                                    errorBuilder: (_, __, ___) => const Icon(
                                      Icons.backpack_outlined,
                                      color: AppColors.ember,
                                      size: 24,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                            'Satchel',
                            style: TextStyle(
                              fontSize: 8,
                              letterSpacing: 0.8,
                              fontFamily: 'Georgia',
                              color: AppColors.sanctuaryIcon.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                        ),
                      ),
                    ),
                    ),
                  ),
                  Positioned(
                    top: -2,
                    right: -2,
                    child: IgnorePointer(
                      ignoring: !showingCached,
                      child: Tooltip(
                        message: 'Showing saved data',
                        child: AnimatedOpacity(
                          opacity: showingCached ? 1 : 0,
                          duration: const Duration(milliseconds: 500),
                          child: Icon(
                            Icons.auto_stories,
                            size: 14,
                            color: AppColors.whetPaper.withValues(alpha: 0.65),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    ).animate().slideY(begin: 1, end: 0, duration: 400.ms, delay: 300.ms);
  }
}

/// Wraps the Satchel icon with a gold breathing pulse (BoxShadow) when empty state.
/// Uses sine wave for organic "breath" — firelight from Hearth reaching the bag.
class _SatchelIconWithPulse extends StatefulWidget {
  const _SatchelIconWithPulse({
    required this.showPulse,
    required this.child,
  });

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
  });
  final SatchelSlot slot;
  final bool focusOnHearth;
  final VoidCallback onEmptyTap;
  final VoidCallback? onDragStartedWhenLocked;

  @override
  Widget build(BuildContext context) {
    if (slot.isEmpty) {
      return GestureDetector(
        onTap: onEmptyTap,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.slotEmpty,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: AppColors.slotBorder.withValues(alpha: 0.85),
              width: 1.5,
            ),
          ),
          child: Icon(
            Icons.lock_outline,
            size: 16,
            color: AppColors.slotBorder.withValues(alpha: 0.9),
          ),
        ),
      );
    }

    final showEmberPulse = focusOnHearth && slot.readyToBurn;
    // Stones always visible: neutral (no ring/bg) when not ready, ember ring when ready.
    final stoneVisual = Container(
      width: 56,
      height: 56,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: slot.readyToBurn
            ? AppColors.slotFilled
            : Colors.transparent,
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
          width: 48,
          height: 48,
          child: Image.asset(
            'assets/stones/stone_medium.png',
            fit: BoxFit.contain,
            opacity: AlwaysStoppedAnimation(slot.readyToBurn ? 1.0 : 0.7),
            errorBuilder: (_, __, ___) => Icon(
              Icons.local_fire_department,
              size: 24,
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
          child: wrapped,
          onSnapBack: onDragStartedWhenLocked,
        ),
      );
    }

    return Semantics(
      label: 'SatchelStoneReady',
      child: Draggable<String>(
        data: slot.nodeId!,
        feedback: _StoneFeedback(title: slot.node?.title ?? ''),
        childWhenDragging: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.slotEmpty,
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
  const _LockedStoneDrag({
    required this.child,
    this.onSnapBack,
  });
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
    ).animate(CurvedAnimation(
      parent: _snapController,
      curve: Curves.easeOut,
    ));
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
    _snapAnimation = Tween<Offset>(begin: from, end: Offset.zero).animate(
      CurvedAnimation(parent: _snapController, curve: Curves.easeOut),
    );
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
          final offset = _snapController.isAnimating ? _snapAnimation.value : _offset;
          return Transform.translate(
            offset: offset,
            child: child,
          );
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
    _blurAnimation = Tween<double>(begin: 4.0, end: 12.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
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
  const _StoneFeedback({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: SizedBox(
        width: 56,
        height: 56,
        child: Image.asset(
          'assets/stones/stone_large.png',
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
  const _EliasBubble({required this.period});
  final ScenePeriod period;

  @override
  ConsumerState<_EliasBubble> createState() => _EliasBubbleState();
}

class _EliasBubbleState extends ConsumerState<_EliasBubble> {
  Timer? _timer;
  bool _hasScheduledGreeting = false;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // One-time: show greeting on first Sanctuary load this session
    // If empty state (0 mountains, 0 habits), show Quest Step 1 instead of period greeting
    if (!_hasScheduledGreeting &&
        !ref.read(hasShownSessionGreetingProvider)) {
      _hasScheduledGreeting = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
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
          ref.read(eliasMessageProvider.notifier).state =
              EliasDialogue.sanctuaryPeriodGreeting(widget.period, displayName);
        }
        if (mounted) {
          ref.read(hasShownSessionGreetingProvider.notifier).state = true;
        }
      });
    }

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

    return _SpeechBubble(message: message);
  }
}

class _SpeechBubble extends StatefulWidget {
  const _SpeechBubble({required this.message});
  final String message;

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
    _charCount = StepTween(begin: 0, end: widget.message.length).animate(
      CurvedAnimation(parent: _controller, curve: Curves.linear),
    );
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
                  maxWidth: math.min(MediaQuery.sizeOf(context).width * 0.75, 320),
                  minWidth: 160,
                ),
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: AppColors.whetPaper,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(2),
                    topRight: Radius.circular(8),
                    bottomRight: Radius.circular(8),
                    bottomLeft: Radius.circular(8),
                  ),
                  border: Border.all(
                    color: AppColors.whetLine,
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 150),
                  child: SingleChildScrollView(
                    child: Text(
                      visible,
                      style: EliasTypography.style(color: AppColors.whetInk),
                      softWrap: true,
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 16,
                bottom: -6,
                child: Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.rotationY(3.14159),
                  child: CustomPaint(
                    size: const Size(12, 8),
                    painter: _SpeechBubbleTailPainter(
                      color: AppColors.whetPaper,
                      borderColor: AppColors.whetLine,
                    ),
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

/// Triangle tail pointing down from bottom-left of speech bubble toward Elias.
class _SpeechBubbleTailPainter extends CustomPainter {
  _SpeechBubbleTailPainter({required this.color, required this.borderColor});
  final Color color;
  final Color borderColor;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.5, size.height)
      ..lineTo(0, 0)
      ..lineTo(size.width, 0)
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
  bool shouldRepaint(covariant _SpeechBubbleTailPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.borderColor != borderColor;
}

