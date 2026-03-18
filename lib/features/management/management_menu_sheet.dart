import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../core/enums/day_period.dart' show ScenePeriod;
import '../../providers/profile_provider.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/elias_provider.dart';
import '../../providers/node_provider.dart';
import '../../providers/elias_context_provider.dart';
import '../../providers/first_run_provider.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';
import '../scroll_map/climb_flow_overlay.dart';
import 'guidance_storybook_overlay.dart';

class ManagementMenuSheet extends ConsumerWidget {
  const ManagementMenuSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final period = ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight = (viewportHeight * 0.6).clamp(0.0, constraints.maxHeight);
        return Container(
          constraints: BoxConstraints(maxHeight: maxHeight),
          padding: EdgeInsets.fromLTRB(
            24, 12, 24, MediaQuery.of(context).padding.bottom + 24,
          ),
          decoration: BoxDecoration(
            color: AppColors.charcoal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            border: const Border(
              top: BorderSide(color: AppColors.slotBorder, width: 0.5),
            ),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: AppColors.ashGrey,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Chat-bubble header with Elias head
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                EliasWidget(
                  period: period,
                  width: 40,
                  height: 56,
                  showGreeting: false,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.whetPaper.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.slotBorder.withValues(alpha: 0.5),
                        width: 1,
                      ),
                    ),
                    child: Text(
                      EliasDialogue.managementGreeting(ref.watch(profileProvider).valueOrNull?.displayName),
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: AppColors.parchment.withValues(alpha: 0.95),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          _MenuItem(
            icon: Icons.terrain,
            label: 'Plot a New Path',
            onTap: () {
              Navigator.of(context).pop();
              showGeneralDialog<void>(
                context: context,
                barrierDismissible: false,
                barrierColor: Colors.black54,
                pageBuilder: (dialogContext, __, ___) => PopScope(
                  canPop: false,
                  child: ClimbFlowOverlay(
                    onClose: () => Navigator.of(dialogContext).pop(),
                    returnLabel: 'Stow the Map',
                  ),
                ),
              );
            },
          ),

          _MenuItem(
            icon: Icons.shopping_bag_outlined,
            label: 'Pack Satchel',
            onTap: () async {
              Navigator.of(context).pop();
              String message;
              try {
                final notifier = ref.read(satchelProvider.notifier);
                message = await notifier.packSatchel();
                ref.read(hearthDropCountProvider.notifier).state = 0;
                HapticFeedback.mediumImpact(); // pack satchel

                if (message == 'Your satchel is full.') {
                  final ctxNotifier = ref.read(eliasContextLastSeenProvider.notifier);
                  if (ctxNotifier.shouldShow(EliasContextKey.satchelFull)) {
                    ref.read(eliasMessageProvider.notifier).state =
                        EliasDialogue.satchelFull();
                    ctxNotifier.markShown(EliasContextKey.satchelFull);
                  }
                } else {
                  final seen = await ref.read(hasSeenFirstPackProvider.future);
                  if (!seen) {
                    ref.read(eliasMessageProvider.notifier).state =
                        EliasDialogue.firstPackLine();
                    await markFirstPackSeen();
                  } else {
                    ref.read(eliasMessageProvider.notifier).state =
                        EliasDialogue.afterPack();
                  }
                }
              } catch (e, st) {
                debugPrint('Pack Satchel error: $e');
                debugPrint('$st');
                message = 'Could not pack satchel.';
              }

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
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
          ),

          _MenuItem(
            icon: Icons.auto_stories_outlined,
            label: 'Seek Guidance',
            onTap: () {
              Navigator.of(context).pop();
              showGeneralDialog<void>(
                context: context,
                barrierColor: Colors.black54,
                barrierDismissible: true,
                barrierLabel: 'Guidance',
                // ignore: unnecessary_underscores
                pageBuilder: (_, __, ___) => const GuidanceStorybookOverlay(),
              );
            },
          ),

          _MenuItem(
            icon: Icons.inventory_2_outlined,
            label: 'Chronicled Peaks',
            onTap: () {
              Navigator.of(context).pop();
              context.push(AppRoutes.archive);
            },
          ),

          _MenuItem(
            icon: Icons.settings_outlined,
            label: 'Settings',
            onTap: () {
              Navigator.of(context).pop();
              context.push(AppRoutes.settings);
            },
          ),
        ],
        ),
      ),
    );
      },
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.parchment),
            const SizedBox(width: 16),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.parchment,
                    letterSpacing: 0.5,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
