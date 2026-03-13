import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/satchel_provider.dart';
import '../../data/models/satchel_slot.dart';

class SatchelScreen extends ConsumerWidget {
  const SatchelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final satchel = ref.watch(satchelProvider);

    return Scaffold(
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
            const Text(
              'YOUR SATCHEL',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 14,
                letterSpacing: 3,
                color: AppColors.parchment,
              ),
            ),
          ],
        ),
        iconTheme: const IconThemeData(color: AppColors.parchment),
        actions: [
          if (!satchel.isFull)
            TextButton(
              onPressed: () async {
                final message =
                    await ref.read(satchelProvider.notifier).packSatchel();
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
        ],
      ),
      body: satchel.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.ember),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Center(
                  child: Container(
                    color: Colors.black,
                    child: Image.asset(
                      'assets/satchel/satchel_open.png',
                      height: 100,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ...List.generate(6, (i) {
                  final slot = i < satchel.slots.length
                      ? satchel.slots[i]
                      : null;
                  final notifier = ref.read(satchelProvider.notifier);
                  return _SatchelSlotRow(
                    key: ValueKey(slot?.id ?? 'empty-$i'),
                    slotIndex: i + 1,
                    slot: slot,
                    onCheckOff: slot != null && slot.isFilled && !slot.readyToBurn
                        ? () => notifier.markReadyToBurn(slot.id)
                        : null,
                    onRemove: slot != null && slot.isFilled
                        ? () async {
                            final title = slot.node?.title.isEmpty == true
                                ? '(untitled)'
                                : (slot.node?.title ?? 'This task');
                            await notifier.removeFromSatchel(slot.id);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context)
                                  .hideCurrentSnackBar();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    '"$title" removed. Still on your mountain.',
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
                        : null,
                  );
                }),
              ],
            ),
    );
  }
}

class _SatchelSlotRow extends StatelessWidget {
  const _SatchelSlotRow({
    super.key,
    required this.slotIndex,
    this.slot,
    this.onCheckOff,
    this.onRemove,
  });

  final int slotIndex;
  final SatchelSlot? slot;

  /// Called when the user swipes right to mark the task as ready to burn.
  final VoidCallback? onCheckOff;

  /// Called when the user swipes left to remove the task from the satchel.
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final isEmpty = slot?.isEmpty ?? true;
    final isReady = slot?.readyToBurn ?? false;

    final content = Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isEmpty
            ? AppColors.slotEmpty
            : isReady
                ? AppColors.slotFilled.withValues(alpha: 0.95)
                : AppColors.slotFilled,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isReady
              ? AppColors.ember
              : slot?.node?.isStarred == true
                  ? AppColors.gold
                  : AppColors.slotBorder,
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
                color: isEmpty ? AppColors.slotBorder : AppColors.ashGrey,
                fontSize: 11,
                fontFamily: 'Georgia',
              ),
            ),
          ),
          const SizedBox(width: 12),

          if (isEmpty)
            const Expanded(
              child: Text(
                '— empty —',
                style: TextStyle(
                  color: AppColors.slotBorder,
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
                  Text(
                    slot?.node?.title.isEmpty == true
                        ? '(untitled)'
                        : slot?.node?.title ?? '',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  if (slot?.node?.dueDate != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today,
                          size: 10,
                          color: AppColors.ember,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _formatDate(slot!.node!.dueDate!),
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: AppColors.ember),
                        ),
                      ],
                    ),
                  ],
                  if (isReady) ...[
                    const SizedBox(height: 4),
                    const Text(
                      'Ready to burn',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 10,
                        color: AppColors.ember,
                        letterSpacing: 0.5,
                      ),
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
            // Flame icon when ready to burn
            if (isReady)
              const Icon(Icons.local_fire_department, size: 16, color: AppColors.ember),
          ],
        ],
      ),
    );

    if (isEmpty || onRemove == null) {
      return content;
    }

    return Slidable(
      key: ValueKey(slot!.id),
      startActionPane: onCheckOff != null && !isReady
          ? ActionPane(
              motion: const DrawerMotion(),
              extentRatio: 0.35,
              children: [
                SlidableAction(
                  onPressed: (context) => onCheckOff!(),
                  backgroundColor: AppColors.ember.withValues(alpha: 0.85),
                  foregroundColor: AppColors.parchment,
                  icon: Icons.check_circle_outline,
                  label: 'Done',
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
            backgroundColor: AppColors.charcoal,
            foregroundColor: AppColors.parchment,
            icon: Icons.remove_circle_outline,
            label: 'Remove',
          ),
        ],
      ),
      child: content,
    );
  }

  String _formatDate(DateTime date) =>
      '${date.month}/${date.day}/${date.year}';
}
