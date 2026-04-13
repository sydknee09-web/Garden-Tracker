import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../data/models/mountain.dart';
import '../../data/models/node.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/narrow_invalidation.dart';
import '../../providers/node_provider.dart';
import 'edit_flow_overlay.dart';

/// Peak Journal — technical ledger for a single mountain.
/// Architect Mode (Mallet) lives here; Map shows summary cards only.
class MountainDetailScreen extends ConsumerStatefulWidget {
  const MountainDetailScreen({super.key, required this.mountainId});

  final String mountainId;

  @override
  ConsumerState<MountainDetailScreen> createState() =>
      _MountainDetailScreenState();
}

class _MountainDetailScreenState extends ConsumerState<MountainDetailScreen> {
  bool _hasShownPeakArrival = false;

  @override
  Widget build(BuildContext context) {
    final mountainAsync = ref.watch(mountainProvider(widget.mountainId));
    final ledgerAsync = ref.watch(mountainLedgerProvider(widget.mountainId));

    return mountainAsync.when(
      data: (mountain) {
        if (mountain == null) {
          return Scaffold(
            appBar: AppBar(
              leading: IconButton(
                icon: const Icon(Icons.map_outlined),
                tooltip: 'Stow the Map',
                onPressed: () => context.go(AppRoutes.scroll),
              ),
              title: const Text(
                'Peak not found',
                style: TextStyle(fontFamily: 'Georgia'),
              ),
            ),
            body: const Center(child: Text('This peak could not be found.')),
          );
        }
        return _buildDetail(context, mountain, ledgerAsync);
      },
      loading: () => Scaffold(
        backgroundColor: AppColors.parchment,
        appBar: AppBar(
          backgroundColor: AppColors.parchment,
          leading: IconButton(
            icon: const Icon(Icons.map_outlined, color: AppColors.charcoal),
            tooltip: 'Stow the Map',
            onPressed: () => context.go(AppRoutes.scroll),
          ),
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.ember),
        ),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.map_outlined),
            tooltip: 'Stow the Map',
            onPressed: () => context.go(AppRoutes.scroll),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Something went wrong',
                style: TextStyle(color: AppColors.ashGrey),
              ),
              TextButton(
                onPressed: () =>
                    ref.invalidate(mountainProvider(widget.mountainId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetail(
    BuildContext context,
    Mountain mountain,
    AsyncValue<MountainLedgerData> ledgerAsync,
  ) {
    final ledger = ledgerAsync.valueOrNull;
    final nodes = ledger?.nodes ?? const <Node>[];
    final progress = ledger?.progress ?? 0.0;

    if (!_hasShownPeakArrival) {
      _hasShownPeakArrival = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                EliasDialogue.peakJournalArrival(),
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  color: AppColors.parchment,
                ),
              ),
              backgroundColor: AppColors.charcoal,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      });
    }

    return Scaffold(
      backgroundColor: AppColors.parchment,
      appBar: AppBar(
        backgroundColor: AppColors.parchment,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.map_outlined, color: AppColors.charcoal),
          tooltip: 'Stow the Map',
          onPressed: () => context.go(AppRoutes.scroll),
        ),
        title: Text(
          mountain.name,
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.charcoal,
            fontSize: 18,
          ),
        ),
        iconTheme: const IconThemeData(color: AppColors.charcoal),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: AppColors.charcoal),
            onSelected: (value) {
              if (value == 'rename') {
                _openEditOverlay(EditTargetPeak(mountain));
              } else if (value == 'chronicle') {
                _showArchiveConfirm(context, mountain);
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'rename',
                child: Text(
                  'Rename peak',
                  style: TextStyle(fontFamily: 'Georgia'),
                ),
              ),
              const PopupMenuItem(
                value: 'chronicle',
                child: Text(
                  'Chronicle this peak',
                  style: TextStyle(fontFamily: 'Georgia'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          96 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (mountain.intentStatement != null &&
                mountain.intentStatement!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  '"${mountain.intentStatement}"',
                  style: const TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                    color: AppColors.ashGrey,
                    height: 1.5,
                  ),
                ),
              ),
            if (mountain.reflectionWhyPeak != null &&
                mountain.reflectionWhyPeak!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Why I climb ${mountain.name}:',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 11,
                        letterSpacing: 0.5,
                        color: AppColors.ashGrey.withValues(alpha: 0.9),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      mountain.reflectionWhyPeak!.trim(),
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: AppColors.charcoal,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            if (mountain.reflectionPackJourney != null &&
                mountain.reflectionPackJourney!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Reflection after the journey:',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 11,
                        letterSpacing: 0.5,
                        color: AppColors.ashGrey,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      mountain.reflectionPackJourney!.trim(),
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: AppColors.charcoal,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.slotBorder.withValues(alpha: 0.5),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.ember),
              minHeight: 5,
            ),
            const SizedBox(height: 8),
            Text(
              '${(progress * 100).round()}% extinguished',
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 12,
                color: AppColors.ashGrey,
              ),
            ),
            const SizedBox(height: 12),
            if (ledgerAsync.isLoading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.ember),
                ),
              )
            else if (nodes.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'The ledger is quiet. Chart a boulder to begin this ascent.',
                  style: TextStyle(
                    color: AppColors.ashGrey,
                    fontFamily: 'Georgia',
                    fontStyle: FontStyle.italic,
                    fontSize: 13,
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: nodes.length,
                itemBuilder: (context, index) {
                  final node = nodes[index];
                  final depth = (node.path.split('.').length - 1).clamp(0, 8);
                  return _LedgerRowWidget(
                    node: node,
                    leftInset: depth * 20.0,
                    onTap: () => _openEditOverlay(
                      EditTargetNode(mountain: mountain, node: node),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showChartPathModal(mountain),
        backgroundColor: AppColors.ember,
        foregroundColor: AppColors.parchment,
        tooltip: 'Chart Path',
        child: const Icon(Icons.add),
      ),
    );
  }

  void _openEditOverlay(EditTarget target) {
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black54,
      pageBuilder: (_, __, ___) => EditFlowOverlay(
        target: target,
        onClose: () {
          Navigator.of(context).pop();
          invalidateAfterNodeMutation(ref, widget.mountainId);
          ref.invalidate(mountainProvider(widget.mountainId));
          ref.invalidate(mountainListProvider);
        },
      ),
    );
  }

  Future<void> _malletOnMountain(
    Mountain mountain, {
    String title = 'New boulder',
  }) async {
    await ref
        .read(nodeActionsProvider)
        .createBoulder(mountainId: mountain.id, title: title);
    invalidateAfterNodeMutation(ref, widget.mountainId);
  }

  Future<void> _showChartPathModal(Mountain mountain) async {
    final controller = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.parchment,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chart Path',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 16,
                color: AppColors.charcoal,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              decoration: const InputDecoration(hintText: 'Name this boulder'),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () async {
                    final title = controller.text.trim();
                    Navigator.of(ctx).pop();
                    await _malletOnMountain(
                      mountain,
                      title: title.isEmpty ? 'New boulder' : title,
                    );
                  },
                  child: const Text('Chart'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showArchiveConfirm(BuildContext context, Mountain mountain) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Chronicle this peak?',
          style: TextStyle(fontFamily: 'Georgia'),
        ),
        content: const Text(
          'The peak will move to the Chronicled Peaks. You can restore it from Elias when you wish.',
          style: TextStyle(fontFamily: 'Georgia'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ref.read(mountainActionsProvider).archive(mountain.id);
              ref.invalidate(mountainListProvider);
              if (context.mounted) context.go(AppRoutes.scroll);
            },
            child: const Text('Chronicle'),
          ),
        ],
      ),
    );
  }
}

class _LedgerRowWidget extends StatelessWidget {
  const _LedgerRowWidget({
    required this.node,
    required this.leftInset,
    required this.onTap,
  });

  final Node node;
  final double leftInset;
  final VoidCallback onTap;

  String _dueText(DateTime dueDate) {
    final mm = dueDate.month.toString().padLeft(2, '0');
    final dd = dueDate.day.toString().padLeft(2, '0');
    return 'due $mm/$dd';
  }

  @override
  Widget build(BuildContext context) {
    final title = node.title.isEmpty ? '(unnamed stone)' : node.title;
    final isExtinguished = node.isComplete;
    return Padding(
      padding: EdgeInsets.fromLTRB(leftInset, 6, 8, 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Opacity(
          opacity: isExtinguished ? 0.5 : 1.0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.whetPaper.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.whetLine.withValues(alpha: 0.5),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      color: AppColors.charcoal,
                      decoration: isExtinguished
                          ? TextDecoration.lineThrough
                          : null,
                    ),
                  ),
                ),
                if (node.isStarred)
                  const Padding(
                    padding: EdgeInsets.only(left: 6),
                    child: Icon(Icons.star, size: 16, color: AppColors.ember),
                  ),
                if (node.dueDate != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text(
                      _dueText(node.dueDate!),
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 11,
                        color: AppColors.ashGrey,
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
