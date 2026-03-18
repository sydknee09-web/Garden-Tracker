import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../data/models/mountain.dart';
import '../../core/content/elias_dialogue.dart';
import '../../providers/climb_flow_provider.dart';
import '../../providers/elias_context_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/node_provider.dart';
import '../../app.dart';
import '../../providers/sound_settings_provider.dart';
import 'climb_flow_overlay.dart';

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
          // Parchment background
          Positioned.fill(
            child: _ScrollParchmentBackground(),
          ),
          // Content — summary cards only; tap → Detail (Architect lives there)
          mountainsAsync.when(
            data: (mountains) => mountains.isEmpty
                ? _EmptyState(onAdd: canAdd ? () => _openClimbFlow(context) : null)
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 72, 16, 80),
                    itemCount: mountains.length + (canAdd ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (i == mountains.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 24, bottom: 24),
                          child: Center(
                            child: OutlinedButton(
                              onPressed: () => _openClimbFlow(context),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.ember),
                                foregroundColor: AppColors.ember,
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
                        onTap: () => context.push('${AppRoutes.scroll}/${mountains[i].id}'),
                      );
                    },
                  ),
            loading: () =>
                const Center(child: CircularProgressIndicator(color: AppColors.ember)),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      "Can't connect to Sanctuary.\nCheck your connection.",
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
                      child: const Text(
                        'Retry',
                        style: TextStyle(
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
          // Top roller (decorative; ignore pointer so it never steals back-button or list taps)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: _ScrollRoller(isTop: true),
            ),
          ),
          // Bottom roller
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _ScrollRoller(isTop: false),
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
          style: const TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
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
    final progress = progressAsync.valueOrNull ?? 0.0;
    final momentumAsync = ref.watch(mountainMomentumProvider(mountain.id));

    return GestureDetector(
      onTap: onTap,
      child: Container(
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
            Row(
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
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.slotBorder.withValues(alpha: 0.5),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.ember),
              minHeight: 4,
            ),
            const SizedBox(height: 4),
            Text(
              '${(progress * 100).round()}%',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 12,
                color: AppColors.ashGrey,
              ),
            ),
            momentumAsync.when(
              data: (momentum) {
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
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
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

class _ScrollRoller extends StatelessWidget {
  const _ScrollRoller({required this.isTop});
  final bool isTop;

  @override
  Widget build(BuildContext context) {
    final path = isTop ? 'assets/images/scroll_top.png' : 'assets/images/scroll_bottom.png';
    return Image.asset(
      path,
      fit: BoxFit.fitWidth,
      width: double.infinity,
      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
    );
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
            child: const Text(
              'Every great ascent begins with a single peak. Begin below.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                fontStyle: FontStyle.italic,
                color: AppColors.parchment,
              ),
            ),
          ),
          if (onAdd != null) ...[
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: onAdd,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.ember),
                foregroundColor: AppColors.ember,
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

