import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/offline_copy.dart';
import '../../core/content/elias_dialogue.dart';
import '../../data/models/climb_draft.dart';
import '../../data/models/mountain.dart';
import '../../providers/climb_draft_provider.dart';
import '../../providers/climb_flow_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../widgets/waiting_pulse.dart';
import '../scroll_map/climb_flow_overlay.dart';

class ArchiveScreen extends ConsumerWidget {
  const ArchiveScreen({super.key});

  static Color _appearanceColor(String style) {
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

  Future<void> _resumeDraft(
    BuildContext context,
    WidgetRef ref,
    ClimbDraft draft,
  ) async {
    final hasMountain =
        draft.mountainId != null && draft.mountainId!.trim().isNotEmpty;
    if (!hasMountain && !ref.read(canAddMountainProvider)) {
      if (context.mounted) {
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
      return;
    }
    ref.invalidate(climbFlowProvider);
    if (!context.mounted) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (ctx) => ClimbFlowOverlay(
          initialDraft: draft,
          onClose: () {
            Navigator.of(ctx).pop();
            ref.invalidate(climbDraftListProvider);
            ref.invalidate(archivedMountainListProvider);
            ref.invalidate(mountainListProvider);
          },
          returnLabel: 'Stow the Map',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archivedAsync = ref.watch(archivedMountainListProvider);
    final draftsAsync = ref.watch(climbDraftListProvider);

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
              'CHRONICLED PEAKS',
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
      ),
      body: archivedAsync.when(
        data: (mountains) {
          final drafts = draftsAsync.maybeWhen(
            data: (d) => d,
            orElse: () => <ClimbDraft>[],
          );

          final entries = <_ChronicleEntry>[];
          for (final m in mountains) {
            entries.add(_MountainEntry(m));
          }
          for (final d in drafts) {
            entries.add(_DraftEntry(d));
          }
          entries.sort((a, b) => b.sortTime.compareTo(a.sortTime));

          if (entries.isEmpty) {
            return const Center(
              child: Text(
                'No chronicled peaks or drafts.',
                style: TextStyle(
                  color: AppColors.ashGrey,
                  fontFamily: 'Georgia',
                  fontStyle: FontStyle.italic,
                ),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: entries.length,
            itemBuilder: (context, i) {
              final e = entries[i];
              return switch (e) {
                final _MountainEntry mountainEntry => _MountainChronicleCard(
                    mountain: mountainEntry.mountain,
                    onRestore: () async {
                      try {
                        await ref
                            .read(mountainActionsProvider)
                            .restore(mountainEntry.mountain.id);
                        ref.invalidate(mountainListProvider);
                        ref.invalidate(archivedMountainListProvider);
                      } catch (err) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                err.toString(),
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
                    },
                  ),
                final _DraftEntry draftEntry => Slidable(
                    key: ValueKey('draft_${draftEntry.draft.id}'),
                    endActionPane: ActionPane(
                      motion: const DrawerMotion(),
                      extentRatio: 0.25,
                      children: [
                        SlidableAction(
                          onPressed: (_) async {
                            await ref
                                .read(climbDraftListProvider.notifier)
                                .deleteDraft(draftEntry.draft.id);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    EliasDialogue.setbackDraftDeleted,
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
                          backgroundColor: AppColors.charcoal,
                          foregroundColor: AppColors.ember,
                          icon: Icons.delete_outline,
                          label: 'Delete',
                        ),
                      ],
                    ),
                    child: _DraftChronicleCard(
                      draft: draftEntry.draft,
                      appearanceColor: _appearanceColor(
                        draftEntry.draft.appearanceStyle,
                      ),
                      onTap: () =>
                          _resumeDraft(context, ref, draftEntry.draft),
                    ),
                  ),
              };
            },
          );
        },
        loading: () => const Center(child: WaitingPulseWidget()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  OfflineCopy.archiveConnectionMessage,
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
                  onPressed: () => ref.invalidate(archivedMountainListProvider),
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
    );
  }
}

sealed class _ChronicleEntry {
  DateTime get sortTime;
}

final class _MountainEntry extends _ChronicleEntry {
  _MountainEntry(this.mountain);
  final Mountain mountain;

  @override
  DateTime get sortTime => mountain.updatedAt;
}

final class _DraftEntry extends _ChronicleEntry {
  _DraftEntry(this.draft);
  final ClimbDraft draft;

  @override
  DateTime get sortTime => draft.updatedAt;
}

class _MountainChronicleCard extends StatelessWidget {
  const _MountainChronicleCard({
    required this.mountain,
    required this.onRestore,
  });

  final Mountain mountain;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.charcoal,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.slotBorder, width: 0.5),
      ),
      child: Row(
        children: [
          Icon(
            Icons.landscape_outlined,
            color: ArchiveScreen._appearanceColor(mountain.appearanceStyle),
            size: 22,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mountain.name,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.parchment,
                        fontFamily: 'Georgia',
                      ),
                ),
                Text(
                  'Chronicled',
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 11,
                    color: AppColors.ashGrey.withValues(alpha: 0.9),
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onRestore,
            child: const Text(
              'Restore',
              style: TextStyle(
                color: AppColors.ember,
                fontFamily: 'Georgia',
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DraftChronicleCard extends StatelessWidget {
  const _DraftChronicleCard({
    required this.draft,
    required this.appearanceColor,
    required this.onTap,
  });

  final ClimbDraft draft;
  final Color appearanceColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                'Swipe left to delete this draft.',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  color: AppColors.parchment,
                ),
              ),
              backgroundColor: AppColors.charcoal,
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
        borderRadius: BorderRadius.circular(8),
        child: Opacity(
          opacity: 0.78,
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.charcoal,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.slotBorder.withValues(alpha: 0.6),
                width: 0.5,
              ),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.edit_note_outlined,
                      color: appearanceColor.withValues(alpha: 0.85),
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            draft.displayName,
                            style: Theme.of(context)
                                .textTheme
                                .bodyLarge
                                ?.copyWith(
                                  color: AppColors.parchment,
                                  fontFamily: 'Georgia',
                                ),
                          ),
                          Text(
                            'Step ${draft.step + 1} of 6 · tap to resume',
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 11,
                              color: AppColors.ashGrey.withValues(alpha: 0.95),
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      color: AppColors.ashGrey,
                      size: 20,
                    ),
                  ],
                ),
                Positioned(
                  right: 0,
                  top: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.ember.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: AppColors.ember.withValues(alpha: 0.45),
                      ),
                    ),
                    child: const Text(
                      'In progress',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 9,
                        letterSpacing: 0.5,
                        color: AppColors.goldenLight,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
