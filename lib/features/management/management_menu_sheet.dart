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
import '../../providers/streak_provider.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';
import '../scroll_map/climb_flow_overlay.dart';
import 'guidance_storybook_overlay.dart';

class ManagementMenuSheet extends ConsumerWidget {
  const ManagementMenuSheet({super.key, required this.scrollController});

  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    final longestBurn = ref.watch(longestBurnStreakProvider).valueOrNull ?? 0;
    final bottomInset = MediaQuery.paddingOf(context).bottom + 20;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.whetPaper,
          border: const Border(
            top: BorderSide(color: AppColors.whetLine, width: 1),
            left: BorderSide(color: AppColors.whetLine, width: 0.5),
            right: BorderSide(color: AppColors.whetLine, width: 0.5),
          ),
        ),
        child: ListView(
          controller: scrollController,
          padding: EdgeInsets.fromLTRB(24, 12, 24, bottomInset),
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.whetLine,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: EliasWidget(
                      period: period,
                      width: 92,
                      height: 92,
                      showGreeting: false,
                      assetPathOverride: 'assets/elias/EliasFloatingSmile.png',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.parchment.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.whetLine,
                        width: 1,
                      ),
                    ),
                    child: SelectionContainer.disabled(
                      child: Text(
                        EliasDialogue.managementGreeting(
                          ref.watch(profileProvider).valueOrNull?.displayName,
                        ),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 14,
                          fontStyle: FontStyle.italic,
                          color: AppColors.whetInk,
                          height: 1.45,
                        ),
                      ),
                    ),
                  ),
                  if (longestBurn > 0) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Longest burn streak: $longestBurn days',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 11,
                        color: AppColors.whetInk.withValues(alpha: 0.75),
                      ),
                    ),
                  ],
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
                      showCompassClose: true,
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
                    final ctxNotifier = ref.read(
                      eliasContextLastSeenProvider.notifier,
                    );
                    if (ctxNotifier.shouldShow(
                      EliasContextKey.satchelFull,
                    )) {
                      ref.read(eliasMessageProvider.notifier).state =
                          EliasDialogue.edgeSatchelFull();
                      ctxNotifier.markShown(EliasContextKey.satchelFull);
                    }
                  } else {
                    final seen = await ref.read(
                      hasSeenFirstPackProvider.future,
                    );
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
                      backgroundColor: AppColors.whetInk,
                      behavior: SnackBarBehavior.floating,
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              },
            ),
            _MenuItem(
              icon: Icons.auto_stories_outlined,
              label: 'How the journey works',
              subtitle: 'A short tour: Peak → Satchel → Hearth.',
              onTap: () {
                Navigator.of(context).pop();
                showGeneralDialog<void>(
                  context: context,
                  barrierColor: Colors.black54,
                  barrierDismissible: true,
                  barrierLabel: 'How the journey works',
                  // ignore: unnecessary_underscores
                  pageBuilder: (_, __, ___) =>
                      const GuidanceStorybookOverlay(),
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
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: AppColors.ember.withValues(alpha: 0.12),
        highlightColor: AppColors.ember.withValues(alpha: 0.08),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 20, color: AppColors.whetInk),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.whetInk,
                        letterSpacing: 0.5,
                        fontFamily: 'Georgia',
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 11,
                          height: 1.25,
                          color: AppColors.whetInk.withValues(alpha: 0.62),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
