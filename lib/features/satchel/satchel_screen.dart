import 'dart:async';
import 'dart:math' as math;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../providers/active_pebbles_provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/satchel_stone_assets.dart';
import '../../core/content/elias_dialogue.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/node_provider.dart';
import '../../providers/whetstone_provider.dart';
import '../../providers/first_run_provider.dart';
import '../../providers/elias_provider.dart';
import '../../data/models/satchel_slot.dart';
import '../../data/models/node.dart';
import '../../core/enums/node_type.dart';
import '../../widgets/hearth_spark_painter.dart';
import 'whetstone_choice_overlay.dart';

final _whetstoneTileKey = GlobalKey();

/// Slot IDs currently playing remove (fade-out) animation; cleared after delay.
final _removingSlotIdsProvider = StateProvider<Set<String>>((ref) => {});

/// Walks parent paths until a [NodeType.boulder] ancestor is found.
String? _nearestBoulderTitle(Node leaf, List<Node> mountainNodes) {
  var p = leaf.parentPath;
  while (p != null) {
    Node? ancestor;
    for (final n in mountainNodes) {
      if (n.path == p) {
        ancestor = n;
        break;
      }
    }
    if (ancestor == null) break;
    if (ancestor.nodeType == NodeType.boulder) {
      final t = ancestor.title.trim();
      return t.isEmpty ? null : t;
    }
    p = ancestor.parentPath;
  }
  return null;
}

/// One-line trail: peak name and milestone (boulder), for Satchel context.
String? _satchelTrailLine(String peakName, String? boulderTitle) {
  final peak = peakName.trim();
  final b = boulderTitle?.trim();
  if (peak.isEmpty && (b == null || b.isEmpty)) return null;
  if (b == null || b.isEmpty) return peak.isEmpty ? null : peak;
  if (peak.isEmpty) return b;
  return '$peak › $b';
}

Future<void> _onSlotRemove(
  BuildContext context,
  WidgetRef ref,
  SatchelSlot slot,
) async {
  final notifier = ref.read(satchelProvider.notifier);
  ref.read(_removingSlotIdsProvider.notifier).update((s) => {...s, slot.id});
  await Future.delayed(const Duration(milliseconds: 180));
  await notifier.removeFromSatchel(slot.id);
  if (context.mounted) {
    ref
        .read(_removingSlotIdsProvider.notifier)
        .update((s) => s..remove(slot.id));
    final title = slot.node?.title.isEmpty == true
        ? '(untitled)'
        : (slot.node?.title ?? 'This task');
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '"$title" removed. Still on your peak.',
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

class SatchelScreen extends ConsumerWidget {
  const SatchelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final satchel = ref.watch(satchelProvider);
    final mountains = ref.watch(mountainListProvider).valueOrNull ?? [];
    final activePebbles = ref.watch(packCandidatesProvider).valueOrNull ?? [];
    final hasPackedSlot = satchel.slots.any((s) => s.isFilled);
    final hasReadyToBurn = satchel.slots.any((s) => s.readyToBurn);
    final showAscension = hasReadyToBurn || activePebbles.isNotEmpty;
    final seenQuestStep1 =
        ref.watch(hasSeenQuestStep1Provider).valueOrNull ?? false;
    final seenScrollTooltip =
        ref.watch(hasSeenScrollTooltipProvider).valueOrNull ?? false;
    final showScrollTooltip =
        mountains.isEmpty && seenQuestStep1 && !seenScrollTooltip;

    return PopScope(
      canPop: !showAscension,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && showAscension && context.mounted) {
          context.go('/sanctuary?focusOnHearth=true');
        }
      },
      child: Scaffold(
        key: const ValueKey('screen_satchel'),
        backgroundColor: AppColors.inkBlack,
        appBar: AppBar(
          backgroundColor: AppColors.inkBlack,
          elevation: 0,
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
                  'YOUR SATCHEL',
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 14,
                    letterSpacing: spacing,
                    color: AppColors.parchment,
                  ),
                ),
              ),
            ],
          ),
          iconTheme: const IconThemeData(color: AppColors.parchment),
          actions: [
            if (!satchel.isFull)
              Semantics(
                label: 'Pack ${activePebbles.length} pebbles into your satchel',
                button: true,
                child: TextButton(
                  onPressed: () async {
                    final message = await ref
                        .read(satchelProvider.notifier)
                        .packSatchel();
                    ref.read(hearthDropCountProvider.notifier).state =
                        0; // reset weighted-hearth sequence
                    HapticFeedback.mediumImpact(); // pack satchel
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            message,
                            style: const TextStyle(
                              fontFamily: 'Georgia',
                              color: AppColors.parchment,
                            ),
                          ),
                          backgroundColor: AppColors.charcoal,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                      if (message == 'No tasks waiting on your mountains.') {
                        ref.read(eliasMessageProvider.notifier).state =
                            EliasDialogue.edgeEmptySatchelCaughtUp();
                      }
                    }
                  },
                  child: const Text(
                    'Pack',
                    style: TextStyle(
                      color: AppColors.ember,
                      fontFamily: 'Georgia',
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
          ],
        ),
        body: satchel.isLoading
            ? const _WaitingPulseWidget()
            : Stack(
                fit: StackFit.expand,
                children: [
                  const _SatchelLeatherBackdrop(),
                  ListView(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 20),
                    children: [
                      // Quest Step 2: vellum tooltip when empty, points to Map
                      if (showScrollTooltip)
                        GestureDetector(
                          onTap: () async {
                            await markScrollTooltipSeen();
                            ref.invalidate(hasSeenScrollTooltipProvider);
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppColors.whetPaper.withValues(alpha: 0.4),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: AppColors.slotBorder.withValues(
                                  alpha: 0.5,
                                ),
                                width: 1,
                              ),
                            ),
                            child: Text(
                              'Cast your first Peak here to define your journey.',
                              style: const TextStyle(
                                fontFamily: 'Georgia',
                                fontSize: 14,
                                fontStyle: FontStyle.italic,
                                color: AppColors.parchment,
                              ),
                            ),
                          ),
                        ),
                      // Tools row: Scroll + Whetstone (distinct from item slots)
                      _ToolsSection(
                        whetstoneKey: _whetstoneTileKey,
                        showWhetstoneSpark: !ref.watch(
                          hasCompletedAnyHabitTodayProvider,
                        ),
                        onScrollTap: () {
                          ref.read(refineModeProvider.notifier).state = false;
                          context.push(AppRoutes.scroll);
                        },
                        onWhetstoneTap: (BuildContext tileContext) {
                          final box =
                              tileContext.findRenderObject() as RenderBox?;
                          if (box == null || !box.hasSize) return;
                          final offset = box.localToGlobal(Offset.zero);
                          final size = box.size;
                          _showWhetstoneOverlay(context, ref, offset, size);
                        },
                      ),
                      if (satchel.isEmpty && !showScrollTooltip)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            EliasDialogue.satchelEmptyEliasLine(),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 13,
                              fontStyle: FontStyle.italic,
                              color: AppColors.parchment.withValues(alpha: 0.92),
                              height: 1.4,
                            ),
                          ),
                        ),
                      SizedBox(height: hasPackedSlot ? 6 : 14),
                      Center(
                        child: Image.asset(
                          'assets/ui/satchel_open.png',
                          height: hasPackedSlot ? 44 : 76,
                          fit: BoxFit.contain,
                          // Blend away near-white illustration paper so art sits on leather backdrop.
                          color: AppColors.satchelSlotEmpty,
                          colorBlendMode: BlendMode.multiply,
                          // ignore: unnecessary_underscores
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.backpack_outlined,
                            color: AppColors.ember,
                            size: 48,
                          ),
                        ),
                      ),
                      SizedBox(height: hasPackedSlot ? 4 : 8),
                      Stack(
                        children: [
                          Positioned.fill(
                            child: Image.asset(
                              'assets/images/wood_plank.png',
                              fit: BoxFit.cover,
                              // ignore: unnecessary_underscores
                              errorBuilder: (_, __, ___) =>
                                  Container(color: AppColors.satchelSlotEmpty),
                            ),
                          ),
                          Column(
                            children: () {
                              // Display order: filled slots first (by slotIndex), then empty (by slotIndex), so burning row 1 compacts rows.
                              final filled =
                                  satchel.slots
                                      .where((s) => s.isFilled)
                                      .toList()
                                    ..sort(
                                      (a, b) =>
                                          a.slotIndex.compareTo(b.slotIndex),
                                    );
                              final empty =
                                  satchel.slots.where((s) => s.isEmpty).toList()
                                    ..sort(
                                      (a, b) =>
                                          a.slotIndex.compareTo(b.slotIndex),
                                    );
                              final displaySlots = <SatchelSlot?>[
                                ...filled,
                                ...empty,
                              ];
                              return List.generate(6, (i) {
                                final slot = i < displaySlots.length
                                    ? displaySlots[i]
                                    : null;
                                final node = slot?.node;
                                final nodeList = node != null
                                    ? (ref
                                              .watch(
                                                nodeListProvider(
                                                  node.mountainId,
                                                ),
                                              )
                                              .valueOrNull ??
                                          const <Node>[])
                                    : const <Node>[];
                                final hasChildren =
                                    node != null &&
                                    nodeList.any(
                                      (n) =>
                                          n.id != node.id &&
                                          n.path.startsWith('${node.path}.'),
                                    );
                                final canRefine =
                                    slot != null &&
                                    slot.isFilled &&
                                    node != null &&
                                    node.nodeType != NodeType.shard &&
                                    !hasChildren;
                                String? peakContextLine;
                                if (node != null) {
                                  var peakName = '';
                                  for (final m in mountains) {
                                    if (m.id == node.mountainId) {
                                      peakName = m.name;
                                      break;
                                    }
                                  }
                                  peakContextLine = _satchelTrailLine(
                                    peakName,
                                    _nearestBoulderTitle(node, nodeList),
                                  );
                                }
                                return _SatchelSlotRow(
                                  key: ValueKey(slot?.id ?? 'empty-$i'),
                                  slotIndex: i + 1,
                                  slot: slot,
                                  peakContextLine: peakContextLine,
                                  onCheckOff: slot != null && slot.isFilled
                                      ? () {
                                          HapticFeedback.lightImpact(); // pebble check
                                          ref
                                              .read(satchelProvider.notifier)
                                              .toggleReadyToBurn(slot.id);
                                        }
                                      : null,
                                  onRemove: slot != null && slot.isFilled
                                      ? () => _onSlotRemove(context, ref, slot)
                                      : null,
                                  onHammerTap: canRefine
                                      ? () => _showHammerRefineOverlay(
                                          context,
                                          ref,
                                          slot,
                                        )
                                      : null,
                                );
                              });
                            }(),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

Future<void> _showHammerRefineOverlay(
  BuildContext context,
  WidgetRef ref,
  SatchelSlot slot,
) async {
  final node = slot.node;
  if (node == null) return;
  if (!context.mounted) return;
  showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierColor: Colors.black54,
    pageBuilder: (_, __, ___) => _RefineStrikeModal(
      slot: slot,
      onClose: () => Navigator.of(context).pop(),
    ),
  );
}

void _showWhetstoneOverlay(
  BuildContext context,
  WidgetRef ref,
  Offset globalOffset,
  Size tileSize,
) {
  showGeneralDialog<void>(
    context: context,
    barrierColor: Colors.transparent,
    barrierDismissible: true,
    barrierLabel: 'Whetstone choice',
    // ignore: unnecessary_underscores
    pageBuilder: (dialogContext, _, __) {
      return SafeArea(
        child: WhetstoneChoiceOverlay(
          whetstoneKey: _whetstoneTileKey,
          anchorOffset: globalOffset,
          tileSize: tileSize,
          onDismiss: () => Navigator.of(dialogContext).pop(),
        ),
      );
    },
  );
}

/// Map + Whetstone tiles at top of Satchel (Option B: all-in-one hub).
class _ToolsSection extends StatelessWidget {
  const _ToolsSection({
    required this.whetstoneKey,
    required this.showWhetstoneSpark,
    required this.onScrollTap,
    required this.onWhetstoneTap,
  });

  final GlobalKey whetstoneKey;
  final bool showWhetstoneSpark;
  final VoidCallback onScrollTap;
  final void Function(BuildContext tileContext) onWhetstoneTap;

  @override
  Widget build(BuildContext context) {
    // Whetstone left, Map right — matches sanctuary dock thumb reach for the more-used Map.
    return Row(
      children: [
        Expanded(
          child: Builder(
            builder: (ctx) => Semantics(
              label: 'The Whetstone',
              button: true,
              child: _ToolTile(
                key: whetstoneKey,
                icon: Icons.auto_fix_high,
                label: 'The Whetstone',
                subtitle: 'Sharpen your daily habits',
                showSpark: showWhetstoneSpark,
                onTap: () => onWhetstoneTap(ctx),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Semantics(
            label: 'The Map',
            button: true,
            child: _ToolTile(
              icon: Icons.map_outlined,
              label: 'The Map',
              subtitle: 'View your peaks',
              onTap: onScrollTap,
            ),
          ),
        ),
      ],
    );
  }
}

class _ToolTile extends StatelessWidget {
  const _ToolTile({
    super.key,
    required this.icon,
    required this.label,
    this.subtitle,
    this.showSpark = false,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final bool showSpark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    Widget iconWidget = Icon(icon, size: 26, color: AppColors.ember);
    if (showSpark) {
      iconWidget = iconWidget
          .animate(onPlay: (c) => c.repeat())
          .shimmer(
            color: AppColors.ember.withValues(alpha: 0.3),
            duration: 2000.ms,
          )
          .then()
          .scale(
            begin: const Offset(1, 1),
            end: const Offset(1.02, 1.02),
            duration: 2500.ms,
            curve: Curves.easeInOut,
          );
    }

    return Material(
      color: AppColors.satchelTileBg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.satchelSlotBorder, width: 1),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              iconWidget,
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: AppColors.parchment,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 10,
                    color: AppColors.ashGrey,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SatchelSlotRow extends ConsumerWidget {
  const _SatchelSlotRow({
    super.key,
    required this.slotIndex,
    this.slot,
    this.peakContextLine,
    this.onCheckOff,
    this.onRemove,
    this.onHammerTap,
  });

  final int slotIndex;
  final SatchelSlot? slot;

  /// Peak (goal) name and boulder milestone, e.g. `My Peak › Draft manuscript`.
  final String? peakContextLine;

  /// Called when the user swipes right to mark the task as ready to burn.
  final VoidCallback? onCheckOff;

  /// Called when the user swipes left to remove the task from the satchel.
  final VoidCallback? onRemove;

  /// Called when the user taps the Hammer icon to refine (shatter) the stone.
  final VoidCallback? onHammerTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isEmpty = slot?.isEmpty ?? true;
    final isReady = slot?.readyToBurn ?? false;
    final isRemoving = ref
        .watch(_removingSlotIdsProvider)
        .contains(slot?.id ?? '');

    final content = Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: isEmpty
            ? AppColors.whetPaper.withValues(
                alpha: 0.5,
              ) // vellum pocket; SATCHEL_UI_RECOMMENDATIONS
            : isReady
            ? AppColors.satchelSlotFilled.withValues(alpha: 0.95)
            : AppColors.satchelSlotFilled,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isReady
              ? AppColors.ember
              : slot?.node?.isStarred == true
              ? AppColors.gold
              : isEmpty
              ? AppColors.satchelSlotEmptyInk.withValues(alpha: 0.7)
              : AppColors.satchelSlotBorder,
          width: isEmpty ? 0.5 : (isReady ? 1.5 : 1),
        ),
      ),
      child: Row(
        children: [
          // Slot number
          SizedBox(
            width: 24,
            child: Text(
              '$slotIndex',
              style: TextStyle(
                color: isEmpty
                    ? AppColors.satchelSlotEmptyInk
                    : AppColors.ashGrey,
                fontSize: 11,
                fontFamily: 'Georgia',
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Stone icon: always show for filled slots; muted when not ready, ember when ready (activated/rune).
          if (!isEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: SizedBox(
                width: 28,
                height: 28,
                child: Image.asset(
                  satchelStoneImagePath(
                    slot?.node,
                    readyToBurn: isReady,
                  ),
                  fit: BoxFit.contain,
                  color: isReady
                      ? null
                      : AppColors.ashGrey.withValues(alpha: 0.85),
                  colorBlendMode: isReady ? null : BlendMode.modulate,
                  errorBuilder: (_, __, ___) => Icon(
                    isReady
                        ? Icons.local_fire_department
                        : Icons.radio_button_unchecked,
                    size: 22,
                    color: isReady
                        ? AppColors.ember
                        : AppColors.satchelSlotBorder,
                  ),
                ),
              ),
            ),

          if (isEmpty)
            Expanded(
              child: Text(
                '— empty —',
                style: TextStyle(
                  color: AppColors.satchelSlotEmptyInk,
                  fontFamily: 'Georgia',
                  fontStyle: FontStyle.italic,
                  fontSize: 13,
                ),
              ),
            )
          else ...[
            // Stone content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (peakContextLine != null &&
                      peakContextLine!.trim().isNotEmpty) ...[
                    Text(
                      peakContextLine!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 10,
                        height: 1.15,
                        letterSpacing: 0.2,
                        color: AppColors.ashGrey.withValues(alpha: 0.95),
                      ),
                    ),
                    const SizedBox(height: 3),
                  ],
                  Text(
                    slot?.node?.title.isEmpty == true
                        ? '(untitled)'
                        : slot?.node?.title ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontFamily: 'Georgia',
                      fontSize: 14,
                      height: 1.2,
                      color: AppColors.parchment,
                    ),
                  ),
                  if (slot?.node?.dueDate != null || isReady) ...[
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (slot?.node?.dueDate != null) ...[
                          const Icon(
                            Icons.calendar_today,
                            size: 9,
                            color: AppColors.ember,
                          ),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                              _formatDate(slot!.node!.dueDate!),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    fontSize: 10,
                                    color: AppColors.ember,
                                  ),
                            ),
                          ),
                        ],
                        if (slot?.node?.dueDate != null && isReady)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Text(
                              '·',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.ashGrey.withValues(
                                  alpha: 0.7,
                                ),
                              ),
                            ),
                          ),
                        if (isReady)
                          const Text(
                            'Ready to burn',
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 10,
                              color: AppColors.ember,
                              letterSpacing: 0.4,
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            // Star badge
            if (slot?.node?.isStarred == true)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: Icon(Icons.star, size: 14, color: AppColors.gold),
              ),
            if (onHammerTap != null)
              Semantics(
                label: 'Refine this stone',
                button: true,
                child: IconButton(
                  icon: const Icon(
                    Icons.gavel,
                    size: 18,
                    color: AppColors.ember,
                  ),
                  tooltip: 'Refine',
                  onPressed: onHammerTap,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.all(6),
                  constraints: const BoxConstraints(
                    minWidth: 40,
                    minHeight: 40,
                  ),
                ),
              ),
          ],
        ],
      ),
    );

    // Slot-level animations: fill-in scale-up, remove fade-out
    Widget visualContent = content;
    if (!isEmpty) {
      visualContent = TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.85, end: 1.0),
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        builder: (context, scale, child) => Transform.scale(
          scale: scale,
          alignment: Alignment.centerLeft,
          child: child,
        ),
        child: visualContent,
      );
    }
    if (isRemoving) {
      visualContent = AnimatedOpacity(
        opacity: 0,
        duration: const Duration(milliseconds: 180),
        child: AnimatedScale(
          scale: 0.8,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeIn,
          child: visualContent,
        ),
      );
    }

    if (isEmpty || onRemove == null) {
      return visualContent;
    }

    return Slidable(
      key: ValueKey(slot!.id),
      startActionPane: onCheckOff != null
          ? ActionPane(
              motion: const DrawerMotion(),
              extentRatio: 0.35,
              children: [
                SlidableAction(
                  onPressed: (context) => onCheckOff!(),
                  backgroundColor: isReady
                      ? AppColors.satchelSlotFilled.withValues(alpha: 0.9)
                      : AppColors.ember.withValues(alpha: 0.85),
                  foregroundColor: AppColors.parchment,
                  icon: isReady
                      ? Icons.reply_outlined
                      : Icons.check_circle_outline,
                  label: isReady ? 'Unpack' : 'Done',
                ),
              ],
            )
          : null,
      endActionPane: ActionPane(
        motion: const DrawerMotion(),
        extentRatio: 0.35,
        children: [
          SlidableAction(
            onPressed: (context) => onRemove!(),
            backgroundColor: AppColors.satchelSlotFilled,
            foregroundColor: AppColors.parchment,
            icon: Icons.remove_circle_outline,
            label: 'Remove',
          ),
        ],
      ),
      child: visualContent,
    );
  }

  String _formatDate(DateTime date) => '${date.month}/${date.day}/${date.year}';
}

class HammerStrikeWrapper extends StatefulWidget {
  const HammerStrikeWrapper({
    super.key,
    required this.child,
    required this.onStrikeComplete,
  });

  final Widget child;
  final VoidCallback onStrikeComplete;

  @override
  State<HammerStrikeWrapper> createState() => _HammerStrikeWrapperState();
}

class _HammerStrikeWrapperState extends State<HammerStrikeWrapper>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _impactScale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _impactScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 1.0,
          end: 1.1,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.1,
          end: 0.85,
        ).chain(CurveTween(curve: Curves.bounceIn)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: 0.85,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.elasticOut)),
        weight: 30,
      ),
    ]).animate(_controller);
  }

  Future<void> strike() async {
    await HapticFeedback.heavyImpact();
    await _controller.forward(from: 0);
    widget.onStrikeComplete();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(scale: _impactScale, child: widget.child);
  }
}

class StoneShatterPainter extends CustomPainter {
  StoneShatterPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 1.0 - progress)
      ..style = PaintingStyle.fill;
    final random = math.Random(42);

    for (int i = 0; i < 8; i++) {
      final angle = random.nextDouble() * 2 * math.pi;
      final distance = progress * 60;
      final offset = Offset(
        size.width / 2 + math.cos(angle) * distance,
        size.height / 2 + math.sin(angle) * distance,
      );
      final path = Path()
        ..moveTo(offset.dx, offset.dy)
        ..lineTo(offset.dx + 5, offset.dy + 10)
        ..lineTo(offset.dx - 5, offset.dy + 8)
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant StoneShatterPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}

class _RefineStrikeModal extends ConsumerStatefulWidget {
  const _RefineStrikeModal({required this.slot, required this.onClose});

  final SatchelSlot slot;
  final VoidCallback onClose;

  @override
  ConsumerState<_RefineStrikeModal> createState() => _RefineStrikeModalState();
}

class _RefineStrikeModalState extends ConsumerState<_RefineStrikeModal>
    with SingleTickerProviderStateMixin {
  final _strikeKey = GlobalKey<_HammerStrikeWrapperState>();
  final _shardA = TextEditingController(text: 'Shard 1');
  final _shardB = TextEditingController(text: 'Shard 2');
  late final AnimationController _shatterController;
  final AudioPlayer _fx = AudioPlayer();
  bool _submitting = false;
  bool _playedCrack = false;

  @override
  void initState() {
    super.initState();
    _shatterController =
        AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 520),
        )..addListener(() {
          if (!_playedCrack && _shatterController.value >= 0.7) {
            _playedCrack = true;
            _fx.play(AssetSource('sounds/rock_crack.mp3')).catchError((_) {});
          }
        });
  }

  @override
  void dispose() {
    _shardA.dispose();
    _shardB.dispose();
    _shatterController.dispose();
    _fx.dispose();
    super.dispose();
  }

  Future<void> _onStrike() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    await _strikeKey.currentState?.strike();
  }

  Future<void> _onStrikeAnimationComplete() async {
    await _shatterController.forward(from: 0);
    final nodeId = widget.slot.node?.id;
    if (nodeId == null) {
      if (mounted) setState(() => _submitting = false);
      return;
    }
    final names = [_shardA.text, _shardB.text];
    try {
      await ref
          .read(nodeActionsProvider)
          .refineStoneIntoShards(
            parentId: nodeId,
            shardNames: names,
            returnToSatchel: true,
          );
      ref.invalidate(satchelProvider);
      ref.invalidate(packCandidatesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Stone refined into shards.',
              style: TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.parchment,
              ),
            ),
            backgroundColor: AppColors.charcoal,
            behavior: SnackBarBehavior.floating,
          ),
        );
        widget.onClose();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Could not refine this stone.',
              style: TextStyle(
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
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.slot.node?.title.trim().isNotEmpty == true
        ? widget.slot.node!.title
        : '(untitled)';
    return Material(
      color: Colors.transparent,
      child: Center(
        child: Container(
          width: 340,
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.97),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine, width: 1),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Strike the Stone',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 18,
                  color: AppColors.whetInk,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 13,
                  color: AppColors.darkWalnut,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 14),
              Center(
                child: SizedBox(
                  width: 90,
                  height: 90,
                  child: Stack(
                    children: [
                      HammerStrikeWrapper(
                        key: _strikeKey,
                        onStrikeComplete: _onStrikeAnimationComplete,
                        child: Center(
                          child: Image.asset(
                            'assets/stones/stone_large.png',
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.radio_button_unchecked,
                              color: AppColors.whetInk,
                              size: 48,
                            ),
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: IgnorePointer(
                          child: AnimatedBuilder(
                            animation: _shatterController,
                            builder: (context, _) => CustomPaint(
                              painter: StoneShatterPainter(
                                progress: _shatterController.value,
                                color: AppColors.ember,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _shardA,
                decoration: const InputDecoration(labelText: 'Shard 1'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _shardB,
                decoration: const InputDecoration(labelText: 'Shard 2'),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _onStrike,
                child: Text(_submitting ? 'Striking...' : 'Strike'),
              ),
              TextButton(
                onPressed: _submitting ? null : widget.onClose,
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Full-screen weathered leather behind Satchel content (`pubspec.yaml`).
class _SatchelLeatherBackdrop extends StatelessWidget {
  const _SatchelLeatherBackdrop();

  static BoxDecoration _gradientFallback() {
    return BoxDecoration(
      color: AppColors.inkBlack,
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [AppColors.ember.withValues(alpha: 0.10), AppColors.inkBlack],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Image.asset(
        'assets/satchel/satchel_texture.png',
        fit: BoxFit.cover,
        alignment: Alignment.center,
        // ignore: unnecessary_underscores
        errorBuilder: (_, __, ___) =>
            DecoratedBox(decoration: _gradientFallback()),
      ),
    );
  }
}

/// "Waiting" state for Satchel loading: dimmed HearthSparkPainter with sparkTime × 0.3
/// so the Sanctuary feels like it is "inhaling" data. POST_V1_ROADMAP § 4.3.
class _WaitingPulseWidget extends StatefulWidget {
  const _WaitingPulseWidget();

  @override
  State<_WaitingPulseWidget> createState() => _WaitingPulseWidgetState();
}

class _WaitingPulseWidgetState extends State<_WaitingPulseWidget> {
  double _sparkTime = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      if (mounted) {
        setState(
          () => _sparkTime = DateTime.now().millisecondsSinceEpoch / 1000.0,
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final origin = Offset(size.width / 2, size.height * 0.85);
    return Stack(
      fit: StackFit.expand,
      children: [
        const _SatchelLeatherBackdrop(),
        Positioned.fill(
          child: ExcludeSemantics(
            child: AnimatedOpacity(
              opacity: 0.4,
              duration: const Duration(milliseconds: 300),
              child: CustomPaint(
                painter: HearthSparkPainter(
                  streak: 1,
                  timeSeconds: _sparkTime * 0.3,
                  origin: origin,
                  brightnessBoost: 0.6,
                ),
              ),
            ),
          ),
        ),
        const Center(
          child: Text(
            'Waiting',
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              letterSpacing: 1,
              color: AppColors.ashGrey,
            ),
          ),
        ),
      ],
    );
  }
}
