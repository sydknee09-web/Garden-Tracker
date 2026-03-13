import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/enums/day_period.dart' show ScenePeriod, ScenePeriodExtension;
import '../../providers/time_of_day_provider.dart';
import 'dart:async';
import '../../core/content/elias_dialogue.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/elias_provider.dart';
import '../../data/models/satchel_slot.dart';
import '../../widgets/elias_silhouette.dart';
import '../management/management_menu_sheet.dart';

class SanctuaryScreen extends ConsumerWidget {
  const SanctuaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    final satchel = ref.watch(satchelProvider);

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Background ──────────────────────────────────
          _Background(period: period),

          // ── Elias (black background preserved from asset) ─
          Positioned(
            left: 24,
            bottom: 180,
            child: Container(
              color: Colors.black,
              child: _EliasWidget(period: period),
            ),
          ),

          // ── Hearth (center drop zone) ───────────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 220,
            child: _HearthWidget(),
          ),

          // ── Top icons: Whetstone + Scroll ───────────────
          Positioned(
            bottom: 180,
            right: 24,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                _SanctuaryIconButton(
                  icon: Icons.auto_fix_high,
                  label: 'Whetstone',
                  onTap: () => context.push(AppRoutes.whetstone),
                ),
                const SizedBox(height: 20),
                _SanctuaryIconButton(
                  icon: Icons.map_outlined,
                  label: 'The Scroll',
                  onTap: () => context.push(AppRoutes.scroll),
                ),
              ],
            ),
          ),

          // ── Elias speech bubble ─────────────────────────
          const Positioned(
            left: 92,
            bottom: 228,
            child: _EliasBubble(),
          ),

          // ── Compact Satchel Tray (bottom) ───────────────
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _CompactSatchelTray(
              satchelState: satchel,
              onBagTap: () => context.push(AppRoutes.satchel),
              onEmptySlotTap: () => _openManagement(context, ref),
            ),
          ),
        ],
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

// ── Background ───────────────────────────────────────────────
//
// Per-period assets: sunrise, midday, dusk, night (.jfif). Gradient fallback
// when asset is missing. Subtle gradient fade on top for depth.

String _backgroundAssetFor(ScenePeriod period) => switch (period) {
      ScenePeriod.dawn   => 'assets/backgrounds/sunrise.jfif',
      ScenePeriod.midday => 'assets/backgrounds/midday.jfif',
      ScenePeriod.sunset => 'assets/backgrounds/dusk.jfif',
      ScenePeriod.night  => 'assets/backgrounds/night.jfif',
    };

class _Background extends StatelessWidget {
  const _Background({required this.period});
  final ScenePeriod period;

  List<Color> get _fallbackGradient => switch (period) {
        ScenePeriod.dawn   => AppColors.dawnGradient,
        ScenePeriod.midday => AppColors.middayGradient,
        ScenePeriod.sunset => AppColors.sunsetGradient,
        ScenePeriod.night  => AppColors.nightGradient,
      };

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(seconds: 2),
      child: KeyedSubtree(
        key: ValueKey<ScenePeriod>(period),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              _backgroundAssetFor(period),
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _GradientFallback(colors: _fallbackGradient),
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
        ),
      ),
    );
  }
}

class _GradientFallback extends StatelessWidget {
  const _GradientFallback({required this.colors});
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: colors,
        ),
      ),
    );
  }
}

// ── Elias ────────────────────────────────────────────────────

class _EliasWidget extends ConsumerWidget {
  const _EliasWidget({required this.period});
  final ScenePeriod period;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        // Show a speech bubble, then open the management menu.
        ref.read(eliasMessageProvider.notifier).state =
            EliasDialogue.onTap();
        showModalBottomSheet(
          context: context,
          backgroundColor: Colors.transparent,
          builder: (_) => const ManagementMenuSheet(),
        );
      },
      child: EliasWidget(
        period: period,
        width: 64,
        height: 96,
        showGreeting: true,
        greetingWidth: 160,
      ),
    ).animate().fadeIn(duration: 600.ms, delay: 200.ms);
  }
}

// ── Hearth ───────────────────────────────────────────────────

class _HearthWidget extends ConsumerStatefulWidget {
  const _HearthWidget();

  @override
  ConsumerState<_HearthWidget> createState() => _HearthWidgetState();
}

class _HearthWidgetState extends ConsumerState<_HearthWidget> {
  bool _burning = false;

  @override
  Widget build(BuildContext context) {
    return DragTarget<String>(
      onWillAcceptWithDetails: (details) => true,
      onAcceptWithDetails: (details) async {
        final nodeId = details.data;
        setState(() => _burning = true);
        final mountainId =
            await ref.read(satchelProvider.notifier).burnStone(nodeId);
        if (mountainId != null) {
          ref.invalidate(mountainProgressProvider(mountainId));
        }
        // Elias reacts to the burn.
        ref.read(eliasMessageProvider.notifier).state =
            EliasDialogue.afterBurn();
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) setState(() => _burning = false);
      },
      builder: (context, candidateData, rejectedData) {
        final isHovering = candidateData.isNotEmpty || _burning;
        return Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: isHovering ? 120 : 96,
            height: isHovering ? 120 : 96,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isHovering
                  ? AppColors.ember.withValues(alpha: _burning ? 0.5 : 0.3)
                  : Colors.black26,
              border: Border.all(
                color: isHovering ? AppColors.ember : AppColors.slotBorder,
                width: isHovering ? 2 : 1,
              ),
              boxShadow: isHovering
                  ? [
                      BoxShadow(
                        color: AppColors.ember.withValues(
                            alpha: _burning ? 0.7 : 0.4),
                        blurRadius: _burning ? 32 : 24,
                        spreadRadius: _burning ? 8 : 4,
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
          ),
        );
      },
    ).animate().fadeIn(duration: 800.ms, delay: 400.ms);
  }
}

// ── Compact Satchel Tray ─────────────────────────────────────

class _CompactSatchelTray extends StatelessWidget {
  const _CompactSatchelTray({
    required this.satchelState,
    required this.onBagTap,
    required this.onEmptySlotTap,
  });

  final SatchelState satchelState;
  final VoidCallback onBagTap;
  final VoidCallback onEmptySlotTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        12, 10, 12, MediaQuery.of(context).padding.bottom + 10,
      ),
      decoration: BoxDecoration(
        color: AppColors.inkBlack.withValues(alpha: 0.92),
        border: const Border(
          top: BorderSide(color: AppColors.slotBorder, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          // 6 stone slots
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: satchelState.slots
                  .map((slot) => _CompactSlot(
                        slot: slot,
                        onEmptyTap: onEmptySlotTap,
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(width: 8),
          // Satchel (closed) → full satchel view
          GestureDetector(
            onTap: onBagTap,
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
                ),
              ),
            ),
          ),
        ],
      ),
    ).animate().slideY(begin: 1, end: 0, duration: 400.ms, delay: 300.ms);
  }
}

class _CompactSlot extends StatelessWidget {
  const _CompactSlot({required this.slot, required this.onEmptyTap});
  final SatchelSlot slot;
  final VoidCallback onEmptyTap;

  @override
  Widget build(BuildContext context) {
    if (slot.isEmpty) {
      return GestureDetector(
        onTap: onEmptyTap,
        child: Container(
          width: 40,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.slotEmpty,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: AppColors.slotBorder.withValues(alpha: 0.5),
              width: 1,
            ),
          ),
          child: const Icon(
            Icons.add,
            size: 14,
            color: AppColors.slotBorder,
          ),
        ),
      );
    }

    // Filled slot — only draggable when checked off (readyToBurn)
    final stoneVisual = Container(
      width: 40,
      height: 48,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: slot.readyToBurn
            ? AppColors.slotFilled
            : AppColors.slotFilled.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: slot.readyToBurn
              ? AppColors.ember
              : slot.node?.isStarred == true
                  ? AppColors.gold
                  : AppColors.slotBorder.withValues(alpha: 0.5),
          width: slot.readyToBurn ? 1.5 : 1,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (slot.readyToBurn)
            const Icon(Icons.local_fire_department, size: 10, color: AppColors.ember)
          else ...[
            const Icon(Icons.lock_outline, size: 9, color: AppColors.slotBorder),
            if (slot.node?.isStarred == true)
              const Icon(Icons.star, size: 8, color: AppColors.gold),
            if (slot.node?.dueDate != null)
              const Icon(Icons.calendar_today, size: 8, color: AppColors.ember),
          ],
        ],
      ),
    );

    if (!slot.readyToBurn) {
      // Not checked off — show greyed, non-draggable; tap explains why
      return GestureDetector(
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Open your Satchel and mark this task Done before dropping it in the Hearth.',
                style: TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
              ),
              backgroundColor: AppColors.charcoal,
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 3),
            ),
          );
        },
        child: stoneVisual,
      );
    }

    return Draggable<String>(
      data: slot.nodeId!,
      feedback: _StoneFeedback(title: slot.node?.title ?? ''),
      childWhenDragging: Container(
        width: 40,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.slotEmpty,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: AppColors.slotBorder.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
      ),
      child: stoneVisual,
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
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: AppColors.slotFilled,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.ember, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: AppColors.ember.withValues(alpha: 0.3),
              blurRadius: 12,
              spreadRadius: 2,
            ),
          ],
        ),
        child: const Center(
          child: Icon(Icons.circle, size: 16, color: AppColors.parchment),
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
  const _EliasBubble();

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

  @override
  Widget build(BuildContext context) {
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

class _SpeechBubble extends StatelessWidget {
  const _SpeechBubble({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 190),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: AppColors.charcoal.withValues(alpha: 0.96),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(2),
          topRight: Radius.circular(8),
          bottomRight: Radius.circular(8),
          bottomLeft: Radius.circular(8),
        ),
        border: Border.all(
          color: AppColors.slotBorder,
          width: 0.5,
        ),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            blurRadius: 14,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Text(
        message,
        style: const TextStyle(
          fontFamily: 'Georgia',
          fontSize: 12,
          color: AppColors.parchment,
          fontStyle: FontStyle.italic,
          height: 1.5,
        ),
      ),
    )
        .animate()
        .fadeIn(duration: 350.ms)
        .slideY(begin: 0.08, end: 0, duration: 350.ms);
  }
}

// ── Sanctuary Icon Button ─────────────────────────────────────

class _SanctuaryIconButton extends StatelessWidget {
  const _SanctuaryIconButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.black38,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.slotBorder, width: 1),
            ),
            child: Icon(icon, size: 24, color: AppColors.parchment),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white54,
              fontSize: 9,
              letterSpacing: 1.2,
              fontFamily: 'Georgia',
            ),
          ),
        ],
      ),
    );
  }
}
