import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../core/enums/node_type.dart';
import '../../data/models/mountain.dart';
import '../../data/models/node.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/narrow_invalidation.dart';
import '../../providers/node_provider.dart';
import '../../providers/satchel_provider.dart';
import 'edit_flow_overlay.dart';

/// Peak Journal — technical ledger for a single mountain.
/// Architect Mode (Mallet) lives here; Map shows summary cards only.
class MountainDetailScreen extends ConsumerStatefulWidget {
  const MountainDetailScreen({
    super.key,
    required this.mountainId,
  });

  final String mountainId;

  @override
  ConsumerState<MountainDetailScreen> createState() => _MountainDetailScreenState();
}

class _MountainDetailScreenState extends ConsumerState<MountainDetailScreen> {
  bool _malletActive = false;
  bool _hasShownPeakArrival = false;

  @override
  Widget build(BuildContext context) {
    final mountainAsync = ref.watch(mountainProvider(widget.mountainId));
    final nodesAsync = ref.watch(nodeListProvider(widget.mountainId));
    final progressAsync = ref.watch(mountainProgressProvider(widget.mountainId));

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
              title: const Text('Peak not found', style: TextStyle(fontFamily: 'Georgia')),
            ),
            body: const Center(child: Text('This peak could not be found.')),
          );
        }
        return _buildDetail(context, mountain, nodesAsync, progressAsync);
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
              Text('Something went wrong', style: TextStyle(color: AppColors.ashGrey)),
              TextButton(
                onPressed: () => ref.invalidate(mountainProvider(widget.mountainId)),
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
    AsyncValue<List<Node>> nodesAsync,
    AsyncValue<double> progressAsync,
  ) {
    final nodes = nodesAsync.valueOrNull ?? [];
    final boulders = nodes.where((n) => n.nodeType == NodeType.boulder).toList()
      ..sort((a, b) => a.path.compareTo(b.path));
    final progress = progressAsync.valueOrNull ?? 0.0;

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
          IconButton(
            icon: Text(
              _malletActive ? 'ARCHITECT ✕' : 'ARCHITECT',
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 11,
                letterSpacing: 1,
                color: AppColors.ember,
              ),
            ),
            onPressed: () {
              setState(() => _malletActive = !_malletActive);
              HapticFeedback.selectionClick();
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          16,
          24,
          100 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (mountain.intentStatement != null && mountain.intentStatement!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  '"${mountain.intentStatement}"',
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                    color: AppColors.ashGrey,
                    height: 1.5,
                  ),
                ),
              ),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.slotBorder.withValues(alpha: 0.5),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.ember),
              minHeight: 4,
            ),
            const SizedBox(height: 8),
            Text(
              '${(progress * 100).round()}% complete',
              style: TextStyle(
                fontFamily: 'Georgia',
                fontSize: 12,
                color: AppColors.ashGrey,
              ),
            ),
            ref.watch(mountainMomentumProvider(widget.mountainId)).when(
              data: (momentum) {
                if (momentum.burnsThisWeek == 0 && momentum.daysSinceLastBurn == null) {
                  return const SizedBox.shrink();
                }
                final text = momentum.burnsThisWeek > 0
                    ? '${momentum.burnsThisWeek} pebbles burned this week'
                    : 'Last burn: ${momentum.daysSinceLastBurn} days ago';
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    text,
                    style: const TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                      color: AppColors.ashGrey,
                    ),
                  ),
                );
              },
              loading: () => const SizedBox(height: 16),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 24),
            if (boulders.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: _malletActive
                    ? OutlinedButton.icon(
                        onPressed: () => _malletOnMountain(mountain),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Add boulder', style: TextStyle(fontFamily: 'Georgia')),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.ember,
                          side: const BorderSide(color: AppColors.ember),
                        ),
                      )
                    : Text(
                        'No boulders yet — activate Architect Mode to build.',
                        style: const TextStyle(
                          color: AppColors.ashGrey,
                          fontFamily: 'Georgia',
                          fontStyle: FontStyle.italic,
                          fontSize: 12,
                        ),
                      ),
              )
            else
              ...boulders.map((b) => _BoulderTile(
                    boulder: b,
                    nodes: nodes,
                    mountain: mountain,
                    malletActive: _malletActive,
                    onOpenEdit: _openEditOverlay,
                    onMalletOnBoulder: _malletOnBoulder,
                    onMalletOnPebble: _malletOnPebble,
                    onMalletOnShard: _malletOnShard,
                  )),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: () => _showArchiveConfirm(context, mountain),
              icon: const Icon(Icons.menu_book_outlined, size: 18),
              label: const Text('Chronicle this Peak', style: TextStyle(fontFamily: 'Georgia')),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.ember,
                side: const BorderSide(color: AppColors.ember),
              ),
            ),
          ],
        ),
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
        },
      ),
    );
  }

  Future<void> _malletOnMountain(Mountain mountain) async {
    await ref.read(nodeActionsProvider).createBoulder(
          mountainId: mountain.id,
          title: 'New milestone',
        );
    invalidateAfterNodeMutation(ref, widget.mountainId);
    // Keep Architect on so user can add/split more without re-enabling.
  }

  Future<void> _malletOnBoulder(Mountain mountain, Node boulder) async {
    // Create pebble under boulder
    final node = await ref.read(nodeActionsProvider).createNodeUnderParent(
          parentPath: boulder.path,
          mountainId: mountain.id,
          nodeType: NodeType.pebble,
          title: 'New pebble',
          isPendingRitual: true,
        );
    await ref.read(satchelProvider.notifier).movePebbleToReady(node.id);
    ref.invalidate(nodeListProvider(widget.mountainId));
    // Keep Architect on so user can add/split more without re-enabling.
  }

  Future<void> _malletOnPebble(Mountain mountain, Node pebble) async {
    await ref.read(nodeActionsProvider).split(pebble);
    invalidateAfterNodeMutation(ref, widget.mountainId);
    // Keep Architect on so user can add/split more without re-enabling.
  }

  Future<void> _malletOnShard(Mountain mountain, Node shard) async {
    await ref.read(nodeActionsProvider).split(shard);
    invalidateAfterNodeMutation(ref, widget.mountainId);
    // Keep Architect on so user can add/split more without re-enabling.
  }

  void _showArchiveConfirm(BuildContext context, Mountain mountain) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Chronicle this peak?', style: TextStyle(fontFamily: 'Georgia')),
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

class _BoulderTile extends StatelessWidget {
  const _BoulderTile({
    required this.boulder,
    required this.nodes,
    required this.mountain,
    required this.malletActive,
    required this.onOpenEdit,
    required this.onMalletOnBoulder,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
  });

  final Node boulder;
  final List<Node> nodes;
  final Mountain mountain;
  final bool malletActive;
  final void Function(EditTarget) onOpenEdit;
  final Future<void> Function(Mountain, Node) onMalletOnBoulder;
  final Future<void> Function(Mountain, Node) onMalletOnPebble;
  final Future<void> Function(Mountain, Node) onMalletOnShard;

  @override
  Widget build(BuildContext context) {
    final pebbles = nodes
        .where((n) => n.nodeType == NodeType.pebble && n.parentPath == boulder.path && !n.isComplete)
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: AppColors.whetPaper.withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => onOpenEdit(EditTargetNode(mountain: mountain, node: boulder)),
                    child: Text(
                      boulder.title.isEmpty ? '(unnamed boulder)' : boulder.title,
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.charcoal,
                      ),
                    ),
                  ),
                ),
                if (malletActive)
                  IconButton(
                    icon: const Icon(Icons.add, size: 20, color: AppColors.ember),
                    onPressed: () => onMalletOnBoulder(mountain, boulder),
                    tooltip: 'Add pebble',
                  ),
              ],
            ),
            ...pebbles.map((p) => Padding(
                  padding: const EdgeInsets.only(left: 16, top: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => onOpenEdit(EditTargetNode(mountain: mountain, node: p)),
                          child: Text(
                            p.title.isEmpty ? '(unnamed task)' : p.title,
                            style: const TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 14,
                              color: AppColors.charcoal,
                            ),
                          ),
                        ),
                      ),
                      if (malletActive)
                        IconButton(
                          icon: const Icon(Icons.gavel, size: 18, color: Color(0xFFB87333)),
                          onPressed: () => onMalletOnPebble(mountain, p),
                          tooltip: 'Split',
                        ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
