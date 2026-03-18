import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../core/enums/day_offset.dart';
import '../../providers/first_run_provider.dart';
import '../../providers/streak_provider.dart';
import '../../providers/whetstone_provider.dart';
import '../../data/models/whetstone_item.dart';

class WhetstoneScreen extends ConsumerWidget {
  const WhetstoneScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(whetstoneProvider);

    ref.listen(whetstoneStreakProvider, (prev, next) {
      next.whenData((r) {
        final streak = r.currentStreak;
        if (streak == 7 || streak == 30 || streak == 100) {
          final messenger = ScaffoldMessenger.maybeOf(context);
          if (messenger != null) {
            Future.microtask(() => _showMilestoneIfNeeded(messenger, streak));
          }
        }
      });
    });

    return Scaffold(
      key: const ValueKey('screen_whetstone'),
      backgroundColor: AppColors.whetPaper,
      appBar: AppBar(
        backgroundColor: AppColors.whetPaper,
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
                color: AppColors.warmGrey,
              ),
            ),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'THE WHETSTONE',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 14,
                      letterSpacing: 3,
                      color: AppColors.whetInk,
                    ),
                  ),
                ),
                _StreakBadge(),
              ],
            ),
          ],
        ),
        iconTheme: const IconThemeData(color: AppColors.whetInk),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: AppColors.whetInk),
            onPressed: () => _showAddHabitSheet(context, ref),
          ),
        ],
      ),
      body: Column(
        children: [
          // Day slider
          _DaySlider(selected: state.selectedOffset),
          const Divider(color: AppColors.whetLine, height: 1),
          // Habit list
          Expanded(
            child: state.isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.warmGrey),
                  )
                : state.items.isEmpty
                    ? _emptyState(context, ref)
                    : _habitList(ref, state.items, state),
          ),
        ],
      ),
    );
  }

  Future<void> _showMilestoneIfNeeded(ScaffoldMessengerState messenger, int streak) async {
    final last = await getLastStreakMilestoneShown();
    if (last >= streak) return;
    await markStreakMilestoneShown(streak); // Claim before show to avoid race
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          EliasDialogue.habitStreakMilestone(streak),
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

  Widget _habitList(
    WidgetRef ref,
    List<WhetstoneItem> items,
    WhetstoneState state,
  ) {
    return ReorderableListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: items.length,
      onReorder: (oldIndex, newIndex) {
        if (newIndex > oldIndex) newIndex--;
        final reordered = [...items];
        final item = reordered.removeAt(oldIndex);
        reordered.insert(newIndex, item);
        ref
            .read(whetstoneProvider.notifier)
            .reorderItems(reordered.map((i) => i.id).toList());
      },
      itemBuilder: (context, i) {
        final item = items[i];
        final isComplete = state.isComplete(item.id);
        final notifier = ref.read(whetstoneProvider.notifier);
        return Slidable(
          key: ValueKey(item.id),
          startActionPane: ActionPane(
            motion: const DrawerMotion(),
            extentRatio: 0.35,
            children: [
              SlidableAction(
                onPressed: (_) async {
                  await notifier.toggleItem(item.id);
                  ref.invalidate(whetstoneStreakProvider);
                },
                backgroundColor: AppColors.whetInk.withValues(alpha: 0.85),
                foregroundColor: AppColors.parchment,
                icon: isComplete ? Icons.radio_button_unchecked : Icons.check_circle_outline,
                label: isComplete ? 'Undo' : 'Done',
              ),
            ],
          ),
          endActionPane: ActionPane(
            motion: const DrawerMotion(),
            extentRatio: 0.35,
            children: [
              SlidableAction(
                onPressed: (_) => _confirmDeleteHabit(context, ref, item.title, item.id),
                backgroundColor: AppColors.charcoal,
                foregroundColor: AppColors.parchment,
                icon: Icons.remove_circle_outline,
                label: 'Remove',
              ),
            ],
          ),
          child: _HabitRow(
            item: item,
            isComplete: isComplete,
            onToggle: () async {
              await notifier.toggleItem(item.id);
              ref.invalidate(whetstoneStreakProvider);
            },
          ),
        );
      },
    );
  }

  Widget _emptyState(BuildContext context, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Add a daily habit to begin sharpening.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.warmGrey,
                fontFamily: 'Georgia',
                fontStyle: FontStyle.italic,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => _showAddHabitSheet(context, ref),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add habit'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.ember,
                foregroundColor: AppColors.parchment,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteHabit(
    BuildContext context,
    WidgetRef ref,
    String title,
    String itemId,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.whetPaper,
        title: const Text(
          'Remove habit?',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.whetInk,
            fontSize: 16,
          ),
        ),
        content: Text(
          '"$title" will be removed from your whetstone.',
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.warmGrey,
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.warmGrey),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(whetstoneProvider.notifier).deleteItem(itemId);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'Removed "$title".',
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        color: AppColors.parchment,
                      ),
                    ),
                    backgroundColor: AppColors.whetInk,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            child: const Text(
              'Remove',
              style: TextStyle(
                color: AppColors.whetInk,
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showAddHabitSheet(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.whetPaper,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          24, 24, 24,
          MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'New Habit',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 16,
                color: AppColors.whetInk,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              style: const TextStyle(
                color: AppColors.whetInk,
                fontFamily: 'Georgia',
              ),
              decoration: const InputDecoration(
                hintText: 'e.g. Morning Movement',
                hintStyle: TextStyle(color: AppColors.warmGrey),
                enabledBorder: UnderlineInputBorder(
                  borderSide: BorderSide(color: AppColors.whetLine),
                ),
                focusedBorder: UnderlineInputBorder(
                  borderSide: BorderSide(color: AppColors.whetInk),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(color: AppColors.warmGrey),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: () async {
                    final title = controller.text.trim();
                    if (title.isEmpty) return;
                    Navigator.of(ctx).pop();
                    try {
                      await ref
                          .read(whetstoneProvider.notifier)
                          .addItem(title);
                    } catch (_) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Couldn\'t add habit. Check your connection.',
                              style: TextStyle(
                                fontFamily: 'Georgia',
                                color: AppColors.parchment,
                              ),
                            ),
                            backgroundColor: AppColors.charcoal,
                            behavior: SnackBarBehavior.floating,
                            duration: Duration(seconds: 3),
                          ),
                        );
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.whetInk,
                    foregroundColor: AppColors.parchment,
                  ),
                  child: const Text(
                    'Add',
                    style: TextStyle(fontFamily: 'Georgia'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Streak Badge ─────────────────────────────────────────────

class _StreakBadge extends ConsumerWidget {
  const _StreakBadge();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(whetstoneStreakProvider);
    return async.when(
      data: (result) {
        if (result.currentStreak < 1) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.ember.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: AppColors.ember.withValues(alpha: 0.4),
                width: 1,
              ),
            ),
            child: Text(
              '${result.currentStreak}-day streak',
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 11,
                letterSpacing: 0.5,
                color: AppColors.ember,
                fontWeight: FontWeight.w500,
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

// ── Day Slider ────────────────────────────────────────────────

class _DaySlider extends ConsumerWidget {
  const _DaySlider({required this.selected});
  final DayOffset selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: DayOffset.values.map((offset) {
        final isSelected = offset == selected;
        return Expanded(
          child: GestureDetector(
            onTap: () =>
                ref.read(whetstoneProvider.notifier).selectDay(offset),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.whetInk
                    : Colors.transparent,
              ),
              child: Text(
                offset.label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 13,
                  letterSpacing: 1,
                  color: isSelected
                      ? AppColors.parchment
                      : AppColors.warmGrey,
                  fontWeight: isSelected
                      ? FontWeight.w600
                      : FontWeight.w400,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ── Habit Row ─────────────────────────────────────────────────

class _HabitRow extends StatelessWidget {
  const _HabitRow({
    required this.item,
    required this.isComplete,
    required this.onToggle,
  });

  final WhetstoneItem item;
  final bool isComplete;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isComplete ? AppColors.whetInk : Colors.transparent,
                border: Border.all(
                  color: isComplete
                      ? AppColors.whetInk
                      : AppColors.whetLine,
                  width: 1.5,
                ),
              ),
              child: isComplete
                  ? const Icon(
                      Icons.check,
                      size: 13,
                      color: AppColors.parchment,
                    )
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                item.title,
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 15,
                  color: isComplete
                      ? AppColors.warmGrey
                      : AppColors.whetInk,
                  decoration: isComplete
                      ? TextDecoration.lineThrough
                      : null,
                  decorationColor: AppColors.warmGrey,
                ),
              ),
            ),
            const Icon(
              Icons.drag_handle,
              size: 18,
              color: AppColors.whetLine,
            ),
          ],
        ),
      ),
    );
  }
}
