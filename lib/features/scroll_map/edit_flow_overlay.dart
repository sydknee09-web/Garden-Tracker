import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../core/enums/day_period.dart' show ScenePeriod;
import '../../core/enums/node_type.dart';
import '../../data/models/mountain.dart';
import '../../data/models/node.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/narrow_invalidation.dart';
import '../../providers/node_provider.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';

/// Target for the Edit overlay: either a peak (Mountain) or a node (boulder/pebble/shard).
sealed class EditTarget {
  const EditTarget();
  String get displayName;
}

class EditTargetPeak extends EditTarget {
  const EditTargetPeak(this.mountain);
  final Mountain mountain;
  @override
  String get displayName => mountain.name;
}

class EditTargetNode extends EditTarget {
  const EditTargetNode({required this.mountain, required this.node});
  final Mountain mountain;
  final Node node;
  @override
  String get displayName => node.title.isNotEmpty ? node.title : 'Untitled';
}

/// Full-screen Edit overlay for Refine mode. Rename, Add pebble (boulder only), Delete.
/// Same pattern as Climb: dimmed background, Compass, Elias.
class EditFlowOverlay extends ConsumerStatefulWidget {
  const EditFlowOverlay({
    super.key,
    required this.target,
    required this.onClose,
  });

  final EditTarget target;
  final VoidCallback onClose;

  @override
  ConsumerState<EditFlowOverlay> createState() => _EditFlowOverlayState();
}

/// Add-child mode: Boulder → Pebble, Pebble → Shard.
enum _AddChildMode { pebble, shard }

class _EditFlowOverlayState extends ConsumerState<EditFlowOverlay> {
  String? _eliasLine;
  bool _addChildNamingActive = false;
  _AddChildMode? _addChildMode;
  bool _showActions = false;
  late final TextEditingController _addChildController;
  late final FocusNode _addChildFocusNode;

  @override
  void initState() {
    super.initState();
    _eliasLine = EliasDialogue.openEdit();
    _addChildController = TextEditingController();
    _addChildFocusNode = FocusNode();
    Future<void>.delayed(const Duration(milliseconds: 200), () {
      if (mounted) setState(() => _showActions = true);
    });
  }

  @override
  void dispose() {
    _addChildController.dispose();
    _addChildFocusNode.dispose();
    super.dispose();
  }

  Future<void> _onAddChildSubmit() async {
    final title = _addChildController.text.trim();
    final target = widget.target as EditTargetNode;
    final mode = _addChildMode!;
    try {
      final Node node;
      if (mode == _AddChildMode.pebble) {
        node = await ref
            .read(nodeActionsProvider)
            .createNodeUnderParent(
              parentPath: target.node.path,
              mountainId: target.mountain.id,
              nodeType: NodeType.pebble,
              title: title.isNotEmpty ? title : 'New pebble',
              isPendingRitual: true,
            );
      } else {
        node = await ref
            .read(nodeActionsProvider)
            .createShard(
              parentPebblePath: target.node.path,
              mountainId: target.mountain.id,
              title: title.isNotEmpty ? title : 'New shard',
            );
      }
      if (mode == _AddChildMode.pebble) {
        await ref.read(satchelProvider.notifier).movePebbleToReady(node.id);
      }
      invalidateAfterNodeMutation(ref, target.mountain.id);
      if (mounted) {
        setState(() {
          _addChildNamingActive = false;
          _addChildMode = null;
          _addChildController.clear();
          _eliasLine = EliasDialogue.afterAddPebble();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.afterAddPebble(),
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.saveFailed(),
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
  }

  void _onAddChildCancel() {
    setState(() {
      _addChildNamingActive = false;
      _addChildMode = null;
      _addChildController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _onClose();
      },
      child: Scaffold(
        backgroundColor: AppColors.inkBlack.withValues(alpha: 0.85),
        body: SafeArea(
          child: Stack(
            children: [
              if (period == ScenePeriod.night)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Container(color: AppColors.candlelightTint),
                  ),
                ),
              Positioned(
                top: 8,
                right: 16,
                child: IconButton(
                  icon: const Icon(Icons.explore, color: AppColors.parchment),
                  tooltip: 'Stow the Map',
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    _onClose();
                  },
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                  24,
                  56,
                  24,
                  24 +
                      MediaQuery.viewInsetsOf(context).bottom +
                      MediaQuery.paddingOf(context).bottom,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: 400,
                      maxHeight: MediaQuery.sizeOf(context).height * 0.8,
                    ),
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Transform.translate(
                              offset: const Offset(0, 20),
                              child: EliasWidget(
                                period: period,
                                width: 140,
                                height: 210,
                                showGreeting: false,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: AppColors.whetPaper.withValues(
                                alpha: 0.95,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.whetLine),
                            ),
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 300),
                              switchInCurve: Curves.easeOutCubic,
                              switchOutCurve: Curves.easeInCubic,
                              child: _addChildNamingActive
                                  ? _EditAddChildCard(
                                      key: const ValueKey('add'),
                                      mode: _addChildMode!,
                                      controller: _addChildController,
                                      focusNode: _addChildFocusNode,
                                      parentName: widget.target.displayName,
                                      onAdd: _onAddChildSubmit,
                                      onCancel: _onAddChildCancel,
                                    )
                                  : _EditDefaultCard(
                                      key: const ValueKey('edit'),
                                      eliasLine:
                                          _eliasLine ??
                                          EliasDialogue.openEdit(),
                                      target: widget.target,
                                      showActions: _showActions,
                                      onRenameDone: (msg) {
                                        if (msg != null) {
                                          setState(() => _eliasLine = msg);
                                        }
                                      },
                                      onAddPebbleTap: () {
                                        HapticFeedback.mediumImpact();
                                        _addChildController.clear();
                                        setState(() {
                                          _addChildNamingActive = true;
                                          _addChildMode = _AddChildMode.pebble;
                                        });
                                      },
                                      onRefineShardsTap: () {
                                        HapticFeedback.mediumImpact();
                                        _addChildController.clear();
                                        setState(() {
                                          _addChildNamingActive = true;
                                          _addChildMode = _AddChildMode.shard;
                                        });
                                      },
                                      onClose: _onClose,
                                      ref: ref,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _onClose() {
    widget.onClose();
  }
}

class _EditDefaultCard extends StatelessWidget {
  const _EditDefaultCard({
    super.key,
    required this.eliasLine,
    required this.target,
    required this.showActions,
    required this.onRenameDone,
    required this.onAddPebbleTap,
    required this.onRefineShardsTap,
    required this.onClose,
    required this.ref,
  });

  final String eliasLine;
  final EditTarget target;
  final bool showActions;
  final void Function(String? msg) onRenameDone;
  final VoidCallback onAddPebbleTap;
  final VoidCallback onRefineShardsTap;
  final VoidCallback onClose;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final nodeTarget = target is EditTargetNode
        ? (target as EditTargetNode).node
        : null;
    final isBoulder = nodeTarget?.nodeType == NodeType.boulder;
    final isPebble = nodeTarget?.nodeType == NodeType.pebble;

    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          eliasLine,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 16,
            color: AppColors.whetInk,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          target.displayName,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 14,
            color: AppColors.whetInk,
            fontStyle: FontStyle.italic,
          ),
        ),
        if (showActions) ...[
          const SizedBox(height: 24),
          _RenameButton(target: target, onDone: onRenameDone, ref: ref),
          if (isBoulder) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onAddPebbleTap,
              icon: const Icon(
                Icons.add_circle_outline,
                size: 18,
                color: AppColors.whetInk,
              ),
              label: const Text(
                'Shatter into Pebbles',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  color: AppColors.whetInk,
                ),
              ),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                side: const BorderSide(color: AppColors.whetLine),
              ),
            ),
          ],
          if (isPebble) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRefineShardsTap,
              icon: const Icon(
                Icons.diamond_outlined,
                size: 18,
                color: AppColors.whetInk,
              ),
              label: const Text(
                'Refine into Shards',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  color: AppColors.whetInk,
                ),
              ),
              style: OutlinedButton.styleFrom(
                alignment: Alignment.centerLeft,
                side: const BorderSide(color: AppColors.whetLine),
              ),
            ),
          ],
          const SizedBox(height: 12),
          _DeleteButton(target: target, onClose: onClose, ref: ref),
        ],
      ],
    );
  }
}

class _EditAddChildCard extends StatelessWidget {
  const _EditAddChildCard({
    super.key,
    required this.mode,
    required this.controller,
    required this.focusNode,
    required this.parentName,
    required this.onAdd,
    required this.onCancel,
  });

  final _AddChildMode mode;
  final TextEditingController controller;
  final FocusNode focusNode;
  final String parentName;
  final Future<void> Function() onAdd;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final isPebble = mode == _AddChildMode.pebble;
    final prompt = isPebble ? 'Name this pebble' : 'Name this shard';
    final hint = isPebble ? 'e.g. Research vendors' : 'e.g. Compare 3 options';

    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Strike the Stone',
          style: TextStyle(
            fontFamily: 'Georgia',
            fontSize: 12,
            color: AppColors.whetInk.withValues(alpha: 0.9),
            fontStyle: FontStyle.italic,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          prompt,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 16,
            color: AppColors.whetInk,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          parentName,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 14,
            color: AppColors.whetInk,
            fontStyle: FontStyle.italic,
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: controller,
          focusNode: focusNode,
          autofocus: true,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 16,
            color: AppColors.whetInk,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.whetInk),
            enabledBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.whetLine),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.ember, width: 2),
            ),
          ),
          onSubmitted: (_) => onAdd(),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: onCancel,
              child: const Text(
                'Cancel',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  color: AppColors.whetInk,
                ),
              ),
            ),
            const SizedBox(width: 12),
            FilledButton(
              onPressed: () async => await onAdd(),
              child: Text(isPebble ? 'Add' : 'Refine'),
            ),
          ],
        ),
      ],
    );
  }
}

class _RenameButton extends StatelessWidget {
  const _RenameButton({
    required this.target,
    required this.onDone,
    required this.ref,
  });

  final EditTarget target;
  final void Function(String? msg) onDone;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final label = target is EditTargetPeak ? 'Rename peak' : 'Rename';
    return OutlinedButton.icon(
      onPressed: () => _showRenameDialog(context),
      icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.whetInk),
      label: Text(
        label,
        style: const TextStyle(fontFamily: 'Georgia', color: AppColors.whetInk),
      ),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        side: const BorderSide(color: AppColors.whetLine),
      ),
    );
  }

  Future<void> _showRenameDialog(BuildContext context) async {
    HapticFeedback.mediumImpact();
    final controller = TextEditingController(text: target.displayName);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        title: Text(
          target is EditTargetPeak ? 'Rename peak' : 'Rename',
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(
            color: AppColors.parchment,
            fontFamily: 'Georgia',
          ),
          decoration: const InputDecoration(
            hintText: 'New name',
            hintStyle: TextStyle(color: AppColors.whetInk),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.ashGrey),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Save', style: TextStyle(color: AppColors.ember)),
          ),
        ],
      ),
    );
    if (!context.mounted || confirmed != true) return;
    final name = controller.text.trim();
    controller.dispose();
    if (name.isEmpty) return;
    try {
      if (target is EditTargetPeak) {
        await ref
            .read(mountainActionsProvider)
            .rename(id: (target as EditTargetPeak).mountain.id, name: name);
        ref.invalidate(mountainListProvider);
      } else {
        final n = (target as EditTargetNode).node;
        await ref.read(nodeActionsProvider).updateTitle(id: n.id, title: name);
        invalidateAfterNodeMutation(ref, n.mountainId);
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.afterRename(),
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.parchment,
              ),
            ),
            backgroundColor: AppColors.charcoal,
            behavior: SnackBarBehavior.floating,
          ),
        );
        onDone(EliasDialogue.afterRename());
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.saveFailed(),
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
  }
}

class _DeleteButton extends StatelessWidget {
  const _DeleteButton({
    required this.target,
    required this.onClose,
    required this.ref,
  });

  final EditTarget target;
  final VoidCallback onClose;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final label = target is EditTargetPeak ? 'Chronicle peak' : 'Abandon';
    final color = target is EditTargetPeak
        ? AppColors.ashGrey
        : AppColors.ember.withValues(alpha: 0.9);
    return OutlinedButton.icon(
      onPressed: () => _confirmAndDelete(context),
      icon: Icon(
        target is EditTargetPeak
            ? Icons.archive_outlined
            : Icons.delete_outline,
        size: 18,
        color: color,
      ),
      label: Text(
        label,
        style: TextStyle(fontFamily: 'Georgia', color: color),
      ),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        side: BorderSide(color: color),
      ),
    );
  }

  Future<void> _confirmAndDelete(BuildContext context) async {
    HapticFeedback.mediumImpact();
    final confirmMsg = target is EditTargetPeak
        ? 'Chronicle "${target.displayName}"? It can be restored from Elias → Chronicled Peaks.'
        : 'Abandon the climb for "${target.displayName}" and everything under it? This cannot be undone.';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        title: Text(
          target is EditTargetPeak ? 'Chronicle peak' : 'Abandon the Climb',
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: Text(
          confirmMsg,
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 14,
            height: 1.4,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.ashGrey),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              target is EditTargetPeak ? 'Chronicle' : 'Abandon',
              style: TextStyle(
                color: target is EditTargetPeak
                    ? AppColors.ashGrey
                    : AppColors.ember,
              ),
            ),
          ),
        ],
      ),
    );
    if (!context.mounted || confirmed != true) return;
    try {
      if (target is EditTargetPeak) {
        await ref
            .read(mountainActionsProvider)
            .archive((target as EditTargetPeak).mountain.id);
        ref.invalidate(mountainListProvider);
        ref.invalidate(archivedMountainListProvider);
      } else {
        await ref
            .read(nodeActionsProvider)
            .deleteSubtree((target as EditTargetNode).node);
        invalidateAfterNodeMutation(
          ref,
          (target as EditTargetNode).mountain.id,
        );
      }
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.afterDelete(),
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.parchment,
              ),
            ),
            backgroundColor: AppColors.charcoal,
            behavior: SnackBarBehavior.floating,
          ),
        );
        onClose();
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.saveFailed(),
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
  }
}
