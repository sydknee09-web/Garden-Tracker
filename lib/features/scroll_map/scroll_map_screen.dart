import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/offline_copy.dart';
import '../../data/models/mountain.dart';
import '../../core/content/elias_dialogue.dart';
import '../../providers/climb_flow_provider.dart';
import '../../providers/elias_context_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/node_provider.dart';
import '../../app.dart';
import '../../providers/sound_settings_provider.dart';
import '../../widgets/screen_blend_image.dart';
import '../../widgets/waiting_pulse.dart';
import 'climb_flow_overlay.dart';

void _showMountainMarkerBreakdownDialog(
  BuildContext context,
  String mountainName,
  MountainMarkerStats stats,
) {
  showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.parchment,
      title: Text(
        mountainName,
        style: const TextStyle(
          fontFamily: 'Georgia',
          fontSize: 17,
          color: AppColors.charcoal,
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${stats.complete} milestone${stats.complete == 1 ? '' : 's'} done',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              color: AppColors.charcoal,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${stats.inProgress} in progress',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              color: AppColors.charcoal,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${stats.locked} locked (not yet seeded)',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              color: AppColors.charcoal,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text(
            'Close',
            style: TextStyle(fontFamily: 'Georgia'),
          ),
        ),
      ],
    ),
  );
}

// ─────────────────────────────────────────────────────────────
// SCROLL MAP SCREEN
// ─────────────────────────────────────────────────────────────

class ScrollMapScreen extends ConsumerStatefulWidget {
  const ScrollMapScreen({super.key, this.openClimbOnMount = false});

  final bool openClimbOnMount;

  @override
  ConsumerState<ScrollMapScreen> createState() => _ScrollMapScreenState();
}

class _ScrollMapScreenState extends ConsumerState<ScrollMapScreen> {
  final AudioPlayer _scrollAudio = AudioPlayer();

  @override
  void initState() {
    super.initState();
    if (ref.read(soundEnabledProvider)) playScrollOpen();
    if (widget.openClimbOnMount) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && ref.read(canAddMountainProvider)) {
          _openClimbFlow(context);
        }
      });
    }
  }

  /// Scroll opening sound (Benboncan map). Synced to route unroll animation.
  void playScrollOpen() {
    _scrollAudio.stop();
    final rate = 0.95 + (DateTime.now().millisecondsSinceEpoch % 11) / 100;
    _scrollAudio.setPlaybackRate(rate);
    _scrollAudio.play(AssetSource('sounds/scroll_open.mp3')).catchError((_) {
      _scrollAudio.play(AssetSource('sounds/scroll_open.wav')).ignore();
    });
  }

  @override
  void deactivate() {
    ref.read(refineModeProvider.notifier).state = false;
    super.deactivate();
  }

  @override
  void dispose() {
    _scrollAudio.stop();
    _scrollAudio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mountainsAsync = ref.watch(mountainListProvider);
    final canAdd = ref.watch(canAddMountainProvider);

    return Scaffold(
      key: const ValueKey('screen_scroll'),
      backgroundColor: AppColors.parchment,
      appBar: AppBar(
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.sanctuary);
            }
          },
          color: AppColors.charcoal,
        ),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sanctuary ›',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 10,
                letterSpacing: 1,
                color: AppColors.ashGrey,
              ),
            ),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1.5),
              duration: const Duration(milliseconds: 800),
              curve: Curves.easeOutCubic,
              builder: (context, spacing, _) => Text(
                'THE MAP',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 14,
                  letterSpacing: spacing,
                  color: AppColors.charcoal,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.parchment,
        iconTheme: const IconThemeData(color: AppColors.charcoal),
        titleTextStyle: const TextStyle(
          color: AppColors.charcoal,
          fontFamily: 'Georgia',
        ),
        actions: [
          // Add mountain button
          if (canAdd)
            IconButton(
              icon: const Icon(Icons.add, color: AppColors.charcoal),
              onPressed: () => _openClimbFlow(context),
            )
          else
            IconButton(
              icon: const Icon(Icons.add, color: AppColors.ashGrey),
              onPressed: () => _showCapMessage(context),
            ),
        ],
      ),
      body: Stack(
        children: [
          // Backdrop ignores pointers so list/cards/buttons receive taps (Stack hit order).
          Positioned.fill(
            child: IgnorePointer(
              ignoring: true,
              child: const _ScrollMapBackdrop(),
            ),
          ),
          // Content — summary cards only; tap → Detail (Architect lives there)
          Positioned.fill(
            child: mountainsAsync.when(
              data: (mountains) => mountains.isEmpty
                ? _EmptyState(
                    onAdd: canAdd ? () => _openClimbFlow(context) : null,
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 72, 16, 80),
                    itemCount: mountains.length + (canAdd ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (i == mountains.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 24, bottom: 24),
                          child: Center(
                            child: FilledButton(
                              onPressed: () => _openClimbFlow(context),
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.ember,
                                foregroundColor: AppColors.ivoryWhite,
                              ),
                              child: const Text(
                                'Plot a New Path',
                                style: TextStyle(fontFamily: 'Georgia'),
                              ),
                            ),
                          ),
                        );
                      }
                      return _MountainSummaryCard(
                        key: ValueKey(mountains[i].id),
                        mountain: mountains[i],
                        onTap: () => context.push(
                          '${AppRoutes.scroll}/${mountains[i].id}',
                        ),
                      );
                    },
                  ),
              loading: () => const Center(child: WaitingPulseWidget()),
              error: (e, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        OfflineCopy.scrollConnectionMessage,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.ashGrey,
                          fontFamily: 'Georgia',
                          fontStyle: FontStyle.italic,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () {
                          ref.invalidate(mountainListProvider);
                        },
                        child: Text(
                          OfflineCopy.retry,
                          style: const TextStyle(
                            color: AppColors.ember,
                            fontFamily: 'Georgia',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openClimbFlow(BuildContext context) {
    if (!ref.read(canAddMountainProvider)) {
      _showCapMessage(context);
      return;
    }
    ref.invalidate(climbFlowProvider);
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (ctx) => ClimbFlowOverlay(
          onClose: () => Navigator.of(ctx).pop(),
          returnLabel: 'Stow the Map',
        ),
      ),
    );
  }

  void _showCapMessage(BuildContext context) {
    final ctxNotifier = ref.read(eliasContextLastSeenProvider.notifier);
    if (!ctxNotifier.shouldShow(EliasContextKey.atMountainCap)) return;
    ctxNotifier.markShown(EliasContextKey.atMountainCap);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          EliasDialogue.atMountainCap(),
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
          ),
        ),
        backgroundColor: AppColors.charcoal,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// MOUNTAIN SUMMARY CARD (Map = high-level; tap → Detail)
// ─────────────────────────────────────────────────────────────

Widget _momentumLineWidget(MountainMomentum momentum) {
  final label = momentum.burnsThisWeek > 0
      ? '${momentum.burnsThisWeek} burned this week'
      : momentum.daysSinceLastBurn != null
      ? 'Last burn: ${momentum.daysSinceLastBurn} days ago'
      : 'No burns yet';
  return Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Text(
      label,
      style: TextStyle(
        fontFamily: 'Georgia',
        fontSize: 11,
        fontStyle: FontStyle.italic,
        color: AppColors.ashGrey.withValues(alpha: 0.8),
      ),
    ),
  );
}

class _MountainSummaryCard extends ConsumerWidget {
  const _MountainSummaryCard({
    super.key,
    required this.mountain,
    required this.onTap,
  });

  final Mountain mountain;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progressAsync = ref.watch(mountainProgressProvider(mountain.id));
    final progress = progressAsync.when(
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
      data: (v) => v,
      error: (_, __) => 0.0,
      loading: () =>
          progressAsync.hasValue ? progressAsync.requireValue : 0.0,
    );
    final momentumAsync = ref.watch(mountainMomentumProvider(mountain.id));
    final markerStats = ref.watch(mountainMarkerStatsProvider(mountain.id));
    final stats = markerStats ?? const MountainMarkerStats(
      total: 0,
      complete: 0,
      inProgress: 0,
      locked: 0,
    );
    final mTotal = stats.total;
    final mDone = stats.complete;
    final ringFrac = mTotal == 0 ? 0.0 : mDone / mTotal;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.whetPaper.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.slotBorder.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onTap,
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                Icon(
                  Icons.landscape,
                  size: 28,
                  color: _colorForAppearance(mountain.appearanceStyle),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    mountain.name,
                    style: const TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.charcoal,
                    ),
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.ashGrey),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: progress,
            backgroundColor: AppColors.slotBorder.withValues(alpha: 0.5),
            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.ember),
            minHeight: 4,
          ),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () => _showMountainMarkerBreakdownDialog(
              context,
              mountain.name,
              stats,
            ),
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                SizedBox(
                  width: 36,
                  height: 36,
                  child: CircularProgressIndicator(
                    value: ringFrac > 0 ? ringFrac : null,
                    strokeWidth: 3,
                    backgroundColor: AppColors.slotBorder.withValues(
                      alpha: 0.45,
                    ),
                    color: AppColors.ember,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        mTotal == 0
                            ? 'No milestones yet'
                            : '$mDone of $mTotal markers complete',
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.charcoal,
                        ),
                      ),
                      Text(
                        'Tap for breakdown',
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 11,
                          color: AppColors.ashGrey.withValues(alpha: 0.85),
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${(progress * 100).round()}% path cleared (leaves)',
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 11,
              color: AppColors.ashGrey.withValues(alpha: 0.9),
            ),
          ),
          momentumAsync.when(
            skipLoadingOnReload: true,
            skipLoadingOnRefresh: true,
            data: _momentumLineWidget,
            loading: () => momentumAsync.hasValue
                ? _momentumLineWidget(momentumAsync.requireValue)
                : const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Color _colorForAppearance(String style) {
    return switch (style) {
      'dark_walnut' => const Color(0xFF3E2723),
      'navy' => const Color(0xFF1A237E),
      'slate' => const Color(0xFF455A64),
      'charcoal' => const Color(0xFF37474F),
      'burgundy' => const Color(0xFF4A148C),
      'forest' => const Color(0xFF1B5E20),
      _ => AppColors.ember,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// SCROLL PARCHMENT & ROLLERS
// ─────────────────────────────────────────────────────────────

class _ScrollParchmentBackground extends StatelessWidget {
  const _ScrollParchmentBackground();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.parchment,
            AppColors.parchment.withValues(alpha: 0.97),
            AppColors.parchment,
          ],
        ),
      ),
    );
  }
}

/// Horizontal unroll (side rollers); falls back to [_SegmentedScrollBackdrop].
class _ScrollMapBackdrop extends StatelessWidget {
  const _ScrollMapBackdrop();

  @override
  Widget build(BuildContext context) {
    return ScreenBlendComposite(
      child: Image.asset(
        'assets/ui/scroll_horizontal_open.png',
        fit: BoxFit.cover,
        alignment: Alignment.center,
        errorBuilder: (_, __, ___) => const _SegmentedScrollBackdrop(),
      ),
    );
  }
}

/// Three-piece scroll: rollers + center body (tiles vertically with list length).
class _SegmentedScrollBackdrop extends StatelessWidget {
  const _SegmentedScrollBackdrop();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        IgnorePointer(child: _ScrollRoller(isTop: true)),
        Expanded(
          child: ScreenBlendComposite(
            child: Image.asset(
              'assets/ui/scroll_texture.png',
              fit: BoxFit.fill,
              width: double.infinity,
              alignment: Alignment.topCenter,
              errorBuilder: (_, __, ___) => Image.asset(
                'assets/ui/scroll_center.png',
                fit: BoxFit.fill,
                width: double.infinity,
                alignment: Alignment.topCenter,
                errorBuilder: (_, __, ___) => ScreenBlendComposite(
                  child: Image.asset(
                    'assets/ui/scroll_full_open.png',
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    errorBuilder: (_, __, ___) =>
                        const _ScrollParchmentBackground(),
                  ),
                ),
              ),
            ),
          ),
        ),
        IgnorePointer(child: _ScrollRoller(isTop: false)),
      ],
    );
  }
}

class _ScrollRoller extends StatelessWidget {
  const _ScrollRoller({required this.isTop});
  final bool isTop;

  @override
  Widget build(BuildContext context) {
    final path = isTop
        ? 'assets/ui/scroll_top.png'
        : 'assets/ui/scroll_bottom.png';
    final image = Image.asset(
      path,
      fit: BoxFit.fitWidth,
      width: double.infinity,
      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
    );
    // Top/bottom art use a black matte; screen-blend so black reads as transparent on parchment.
    return ScreenBlendComposite(child: image);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({this.onAdd});
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.whetPaper.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.slotBorder.withValues(alpha: 0.5),
                width: 1,
              ),
            ),
            child: Text(
              EliasDialogue.edgeNoActivePeaks(),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                fontStyle: FontStyle.italic,
                color: AppColors.parchment,
              ),
            ),
          ),
          if (onAdd != null) ...[
            const SizedBox(height: 24),
            FilledButton(
              onPressed: onAdd,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.ember,
                foregroundColor: AppColors.ivoryWhite,
              ),
              child: const Text(
                'Plot a New Path',
                style: TextStyle(fontFamily: 'Georgia'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
