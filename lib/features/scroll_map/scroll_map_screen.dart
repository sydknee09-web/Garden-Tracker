import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../core/constants/app_colors.dart';
import '../../core/enums/node_type.dart';
import '../../data/models/mountain.dart';
import '../../data/models/node.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/node_provider.dart';

void _showMountainOptionsSheet(
  BuildContext context,
  WidgetRef ref,
  Mountain mountain,
) {
  showModalBottomSheet(
    context: context,
    backgroundColor: AppColors.charcoal,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(ctx).padding.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              mountain.name,
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.parchment,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 20),
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: AppColors.parchment, size: 22),
              title: const Text(
                'Rename',
                style: TextStyle(
                  color: AppColors.parchment,
                  fontFamily: 'Georgia',
                  fontSize: 16,
                ),
              ),
              onTap: () {
                Navigator.of(ctx).pop();
                _showRenameMountainDialog(context, ref, mountain);
              },
            ),
            ListTile(
              leading: const Icon(Icons.archive_rounded, color: AppColors.parchment, size: 22),
              title: const Text(
                'Archive',
                style: TextStyle(
                  color: AppColors.parchment,
                  fontFamily: 'Georgia',
                  fontSize: 16,
                ),
              ),
              onTap: () async {
                Navigator.of(ctx).pop();
                await ref.read(mountainActionsProvider).archive(mountain.id);
                ref.invalidate(mountainListProvider);
                ref.invalidate(archivedMountainListProvider);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        '${mountain.name} archived. Restore from Elias → Archive Recovery.',
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.parchment,
                          fontSize: 12,
                        ),
                      ),
                      backgroundColor: AppColors.charcoal,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
            ),
          ],
        ),
      ),
    ),
  );
}

void _showRenameMountainDialog(
  BuildContext context,
  WidgetRef ref,
  Mountain mountain,
) {
  final controller = TextEditingController(text: mountain.name);
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.charcoal,
      title: const Text(
        'Rename Mountain',
        style: TextStyle(
          fontFamily: 'Georgia',
          color: AppColors.parchment,
          fontSize: 16,
        ),
      ),
      content: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(color: AppColors.parchment, fontFamily: 'Georgia'),
        decoration: const InputDecoration(
          enabledBorder: UnderlineInputBorder(
            borderSide: BorderSide(color: AppColors.slotBorder),
          ),
          focusedBorder: UnderlineInputBorder(
            borderSide: BorderSide(color: AppColors.ember),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Cancel', style: TextStyle(color: AppColors.ashGrey)),
        ),
        TextButton(
          onPressed: () async {
            final name = controller.text.trim();
            if (name.isEmpty) return;
            Navigator.of(ctx).pop();
            try {
              await ref.read(mountainActionsProvider).rename(id: mountain.id, name: name);
            } catch (e) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(e.toString())),
                );
              }
            }
          },
          child: const Text(
            'Save',
            style: TextStyle(color: AppColors.ember, fontFamily: 'Georgia'),
          ),
        ),
      ],
    ),
  );
}

// ─────────────────────────────────────────────────────────────
// SCROLL MAP SCREEN
// ─────────────────────────────────────────────────────────────

class ScrollMapScreen extends ConsumerStatefulWidget {
  const ScrollMapScreen({super.key});

  @override
  ConsumerState<ScrollMapScreen> createState() => _ScrollMapScreenState();
}

class _ScrollMapScreenState extends ConsumerState<ScrollMapScreen> {
  // nodeId → controller for inline title editing
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, FocusNode> _focusNodes = {};

  @override
  void dispose() {
    for (final c in _controllers.values) { c.dispose(); }
    for (final f in _focusNodes.values) { f.dispose(); }
    super.dispose();
  }

  TextEditingController _controllerFor(String nodeId) =>
      _controllers.putIfAbsent(nodeId, () => TextEditingController());

  FocusNode _focusNodeFor(String nodeId) =>
      _focusNodes.putIfAbsent(nodeId, () => FocusNode());

  void _startEditing(String nodeId) {
    ref.read(editingNodeIdProvider.notifier).state = nodeId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNodeFor(nodeId).requestFocus();
    });
  }

  /// Tap-to-edit for existing nodes: sets controller text and enters edit mode.
  void _startEditingWithTitle(String nodeId, String title) {
    final c = _controllerFor(nodeId);
    c.text = title;
    c.selection = TextSelection.collapsed(offset: title.length);
    _startEditing(nodeId);
  }

  /// Shows a dialog to name a newly created node (boulder, pebble, or split result).
  void _showNameNewNodeDialog(
    BuildContext context,
    String nodeId,
    String mountainId,
    String dialogTitle,
    String hintText,
  ) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        title: Text(
          dialogTitle,
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(
              fontFamily: 'Georgia',
              color: AppColors.ashGrey,
              fontStyle: FontStyle.italic,
            ),
            enabledBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.slotBorder),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.ember),
            ),
          ),
          style: const TextStyle(
            color: AppColors.parchment,
            fontFamily: 'Georgia',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Skip',
              style: TextStyle(color: AppColors.ashGrey, fontFamily: 'Georgia'),
            ),
          ),
          TextButton(
            onPressed: () async {
              final name = controller.text.trim();
              Navigator.of(ctx).pop();
              if (name.isEmpty) return;
              await ref.read(nodeActionsProvider).updateTitle(id: nodeId, title: name);
              ref.invalidate(nodeListProvider(mountainId));
            },
            child: const Text(
              'Save',
              style: TextStyle(color: AppColors.ember, fontFamily: 'Georgia'),
            ),
          ),
        ],
      ),
    );
  }

  /// Saves the title to the backend and refreshes lists. Does not exit edit mode.
  /// Used when focus leaves the field (tap away or tap another row) so we don't wipe the new row's edit state.
  Future<void> _saveTitle(String nodeId, String title) async {
    if (title.trim().isEmpty) return;
    await ref.read(nodeActionsProvider).updateTitle(id: nodeId, title: title.trim());
    final mountains = ref.read(mountainListProvider).valueOrNull ?? [];
    for (final m in mountains) {
      ref.invalidate(nodeListProvider(m.id));
    }
  }

  /// Saves the title and exits edit mode (clears editingId, unfocuses). Used by Save button.
  Future<void> _commitTitle(String nodeId, String title) async {
    await _saveTitle(nodeId, title);
    ref.read(editingNodeIdProvider.notifier).state = null;
    _focusNodeFor(nodeId).unfocus();
  }

  // ── Mallet Drop Handlers ──────────────────────────────────

  Future<void> _malletOnMountain(Mountain mountain) async {
    try {
      final node = await ref.read(nodeActionsProvider).createBoulder(
            mountainId: mountain.id,
          );
      ref.refresh(nodeListProvider(mountain.id));
      if (mounted) {
        _showNameNewNodeDialog(
          context,
          node.id,
          mountain.id,
          'Name this milestone',
          'e.g. Q1 Goals, Launch phase...',
        );
      }
    } catch (e) {
      if (mounted) _showMalletError(e);
    }
  }

  Future<void> _malletOnBoulder(Mountain mountain, Node boulder) async {
    try {
      final node = await ref.read(nodeActionsProvider).createPebble(
            mountainId: mountain.id,
            boulderId: boulder.id,
          );
      ref.refresh(nodeListProvider(mountain.id));
      if (mounted) {
        _showNameNewNodeDialog(
          context,
          node.id,
          mountain.id,
          'Name this task',
          'e.g. Research vendors...',
        );
      }
    } catch (e) {
      if (mounted) _showMalletError(e);
    }
  }

  Future<void> _malletOnPebble(Node pebble) async {
    try {
      final node = await ref.read(nodeActionsProvider).split(pebble);
      ref.refresh(nodeListProvider(pebble.mountainId));
      if (mounted) {
        _showNameNewNodeDialog(
          context,
          node.id,
          pebble.mountainId,
          'Name the new task',
          'e.g. Research vendors...',
        );
      }
    } catch (e) {
      if (mounted) _showMalletError(e);
    }
  }

  Future<void> _malletOnShard(Node shard) async {
    try {
      final node = await ref.read(nodeActionsProvider).split(shard);
      ref.refresh(nodeListProvider(shard.mountainId));
      if (mounted) {
        _showNameNewNodeDialog(
          context,
          node.id,
          shard.mountainId,
          'Name the new task',
          'e.g. Sub-step...',
        );
      }
    } catch (e) {
      if (mounted) _showMalletError(e);
    }
  }

  void _showMalletError(Object e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          e.toString().replaceFirst('Exception: ', '').replaceFirst('StateError: ', ''),
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 13,
          ),
        ),
        backgroundColor: AppColors.charcoal,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppColors.ember, width: 0.5),
        ),
      ),
    );
  }

  // ── Delete Handlers ───────────────────────────────────────

  Future<void> _deleteNode(Node node) async {
    try {
      await ref.read(nodeActionsProvider).deleteSubtree(node);
      ref.refresh(nodeListProvider(node.mountainId));
    } catch (e) {
      if (mounted) _showMalletError(e);
    }
  }

  /// Shows a confirmation dialog for destructive deletes (boulders/pebbles).
  /// For shards (no children), deletes directly and shows snackbar.
  void _confirmAndDeleteNode(BuildContext ctx, Node node) {
    if (node.nodeType == NodeType.shard) {
      _deleteNode(node);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '"${node.title.isEmpty ? 'Shard' : node.title}" deleted.',
            style: const TextStyle(
              fontFamily: 'Georgia',
              color: AppColors.parchment,
            ),
          ),
          backgroundColor: AppColors.charcoal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final isboulder = node.nodeType == NodeType.boulder;
    final label = isboulder ? 'boulder and all its tasks' : 'task and its notes';

    showDialog(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: AppColors.charcoal,
        title: const Text(
          'Delete?',
          style: TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.parchment,
            fontSize: 16,
          ),
        ),
        content: Text(
          'This will permanently delete this $label.',
          style: const TextStyle(
            fontFamily: 'Georgia',
            color: AppColors.ashGrey,
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.ashGrey, fontFamily: 'Georgia'),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              _deleteNode(node);
            },
            child: const Text(
              'Delete',
              style: TextStyle(
                color: AppColors.ember,
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mountainsAsync = ref.watch(mountainListProvider);
    final canAdd = ref.watch(canAddMountainProvider);
    final malletActive = ref.watch(malletActiveProvider);

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
              'THE SCROLL',
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
          // Architect Mode toggle
          GestureDetector(
            onTap: () => ref.read(malletActiveProvider.notifier).state =
                !malletActive,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: malletActive
                    ? AppColors.ember.withValues(alpha: 0.2)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: malletActive ? AppColors.ember : AppColors.slotBorder,
                  width: 1,
                ),
              ),
              child: Text(
                malletActive ? 'ARCHITECT ✕' : 'ARCHITECT',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: malletActive ? AppColors.ember : AppColors.ashGrey,
                ),
              ),
            ),
          ),
          // Add mountain button
          if (canAdd)
            IconButton(
              icon: const Icon(Icons.add, color: AppColors.parchment),
              onPressed: () => _showAddMountainDialog(context),
            )
          else
            IconButton(
              icon: const Icon(Icons.add, color: AppColors.slotBorder),
              onPressed: () => _showCapMessage(context),
            ),
        ],
      ),
      body: Stack(
        children: [
          mountainsAsync.when(
            data: (mountains) => mountains.isEmpty
                ? _EmptyState(onAdd: canAdd ? () => _showAddMountainDialog(context) : null)
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                    itemCount: mountains.length,
                    itemBuilder: (context, i) => _MountainSection(
                      key: ValueKey(mountains[i].id),
                      mountain: mountains[i],
                      malletActive: malletActive,
                      editingId: ref.watch(editingNodeIdProvider),
                      controllerFor: _controllerFor,
                      focusNodeFor: _focusNodeFor,
                      onSaveTitle: _saveTitle,
                      onCommitTitle: _commitTitle,
                      onStartEditing: _startEditingWithTitle,
                      onMalletOnMountain: _malletOnMountain,
                      onMalletOnBoulder: _malletOnBoulder,
                      onMalletOnPebble: _malletOnPebble,
                      onMalletOnShard: _malletOnShard,
                      onDeleteNode: _confirmAndDeleteNode,
                    ),
                  ),
            loading: () =>
                const Center(child: CircularProgressIndicator(color: AppColors.ember)),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      "Can't connect to Sanctuary.\nCheck your connection.",
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
                      onPressed: () {
                        ref.invalidate(mountainListProvider);
                      },
                      child: const Text(
                        'Retry',
                        style: TextStyle(
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
          // Mallet draggable — bottom-right when architect mode is on (above system nav bar)
          if (malletActive)
            Positioned(
              right: 24,
              bottom: 40 + MediaQuery.of(context).padding.bottom,
              child: const _MalletDraggable(),
            ),
        ],
      ),
    );
  }

  void _showAddMountainDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => _StyledDialog(
        title: 'Name This Mountain',
        hint: 'e.g. CPA Exam, Business Launch...',
        controller: controller,
        confirmLabel: 'Begin the Climb',
        onConfirm: () async {
          final name = controller.text.trim();
          if (name.isEmpty) return;
          Navigator.of(ctx).pop();
          try {
            await ref.read(mountainActionsProvider).create(name: name);
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(e.toString())),
              );
            }
          }
        },
      ),
    );
  }

  void _showCapMessage(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'You are climbing 3 mountains. Archive one before opening a new path.',
          style: TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
        ),
        backgroundColor: AppColors.charcoal,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// MOUNTAIN SECTION
// ─────────────────────────────────────────────────────────────

class _MountainSection extends ConsumerWidget {
  const _MountainSection({
    super.key,
    required this.mountain,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnMountain,
    required this.onMalletOnBoulder,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
    required this.onDeleteNode,
  });

  final Mountain mountain;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String nodeId, String initialTitle) onStartEditing;
  final Future<void> Function(Mountain) onMalletOnMountain;
  final Future<void> Function(Mountain, Node) onMalletOnBoulder;
  final Future<void> Function(Node) onMalletOnPebble;
  final Future<void> Function(Node) onMalletOnShard;
  final void Function(BuildContext, Node) onDeleteNode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nodesAsync = ref.watch(nodeListProvider(mountain.id));
    final nodes = nodesAsync.valueOrNull ?? [];
    final boulders =
        nodes.where((n) => n.nodeType == NodeType.boulder).toList();
    final progressAsync = ref.watch(mountainProgressProvider(mountain.id));
    final progress = progressAsync.valueOrNull ?? 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: AppColors.charcoal,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.slotBorder, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Mountain Header (DragTarget for Boulder creation) ──
          DragTarget<bool>(
            onWillAcceptWithDetails: (_) => malletActive,
            onAcceptWithDetails: (_) => onMalletOnMountain(mountain),
            builder: (context, candidates, rejected) {
              final hovering = candidates.isNotEmpty && malletActive;
              return GestureDetector(
                onTap: malletActive ? () => onMalletOnMountain(mountain) : null,
                child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                decoration: BoxDecoration(
                  color: hovering
                      ? AppColors.ember.withValues(alpha: 0.12)
                      : Colors.transparent,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(10),
                  ),
                  border: Border(
                    bottom: BorderSide(
                      color: hovering
                          ? AppColors.ember
                          : AppColors.slotBorder.withValues(alpha: 0.5),
                      width: 0.5,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.landscape,
                          color: hovering ? AppColors.ember : AppColors.ashGrey,
                          size: 16,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            mountain.name,
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 16,
                              color: hovering
                                  ? AppColors.ember
                                  : AppColors.parchment,
                            ),
                          ),
                        ),
                        if (hovering)
                          const Text(
                            'DROP TO ADD BOULDER',
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 9,
                              letterSpacing: 1.5,
                              color: AppColors.ember,
                            ),
                          ),
                        if (!hovering && malletActive)
                          const Text(
                            '↓ DROP HERE',
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 9,
                              letterSpacing: 1,
                              color: AppColors.ashGrey,
                            ),
                          ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.more_vert, size: 18, color: AppColors.ashGrey),
                          onPressed: () => _showMountainOptionsSheet(context, ref, mountain),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _ProgressBar(progress: progress),
                  ],
                ),
              ),
            );
            },
          ),

          // ── Mountain Trail ──
          _MountainTrailBody(
            boulders: boulders,
            allNodes: nodes,
            mountain: mountain,
            malletActive: malletActive,
            editingId: editingId,
            controllerFor: controllerFor,
            focusNodeFor: focusNodeFor,
            onSaveTitle: onSaveTitle,
            onCommitTitle: onCommitTitle,
            onStartEditing: onStartEditing,
            onMalletOnBoulder: onMalletOnBoulder,
            onMalletOnPebble: onMalletOnPebble,
            onMalletOnShard: onMalletOnShard,
            onDeleteNode: onDeleteNode,
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms);
  }
}

// ─────────────────────────────────────────────────────────────
// BOULDER TILE
// ─────────────────────────────────────────────────────────────

class _BoulderTile extends StatelessWidget {
  const _BoulderTile({
    super.key,
    required this.boulder,
    required this.pebbles,
    required this.allNodes,
    required this.mountain,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnBoulder,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
    required this.isLast,
  });

  final Node boulder;
  final List<Node> pebbles;
  final List<Node> allNodes;
  final Mountain mountain;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String nodeId, String initialTitle) onStartEditing;
  final Future<void> Function(Mountain, Node) onMalletOnBoulder;
  final Future<void> Function(Node) onMalletOnPebble;
  final Future<void> Function(Node) onMalletOnShard;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final isEditing = editingId == boulder.id;

    return DragTarget<bool>(
      onWillAcceptWithDetails: (_) => malletActive,
      onAcceptWithDetails: (_) => onMalletOnBoulder(mountain, boulder),
      builder: (context, candidates, rejected) {
        final hovering = candidates.isNotEmpty && malletActive;
        return GestureDetector(
          onTap: malletActive ? () => onMalletOnBoulder(mountain, boulder) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: EdgeInsets.fromLTRB(12, 6, 12, isLast ? 12 : 0),
            decoration: BoxDecoration(
              color: hovering
                  ? AppColors.ember.withValues(alpha: 0.08)
                  : AppColors.inkBlack.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: hovering ? AppColors.ember : AppColors.slotBorder,
                width: hovering ? 1 : 0.5,
              ),
            ),
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Boulder header
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                child: Row(
                  children: [
                    const _NodeTypeIcon(type: NodeType.boulder),
                    const SizedBox(width: 8),
                    Expanded(
                      child: isEditing
                          ? _InlineTextField(
                              controller: controllerFor(boulder.id),
                              focusNode: focusNodeFor(boulder.id),
                              onSubmit: (v) => onSaveTitle(boulder.id, v),
                              placeholder: 'Name this milestone...',
                            )
                          : _TapToEditTitle(
                              enabled: !malletActive,
                              onTap: () => onStartEditing(boulder.id, boulder.title),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  boulder.title.isEmpty
                                      ? '(unnamed boulder)'
                                      : boulder.title,
                                  style: TextStyle(
                                    fontFamily: 'Georgia',
                                    fontSize: 13,
                                    color: boulder.title.isEmpty
                                        ? AppColors.ashGrey
                                        : AppColors.parchment,
                                    fontStyle: boulder.title.isEmpty
                                        ? FontStyle.italic
                                        : FontStyle.normal,
                                  ),
                                ),
                              ),
                            ),
                    ),
                    if (hovering)
                      const Text(
                        'DROP → PEBBLE',
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 9,
                          letterSpacing: 1,
                          color: AppColors.ember,
                        ),
                      ),
                  ],
                ),
              ),

              // Pebble children
              if (pebbles.isNotEmpty)
                ...pebbles.map((pebble) {
                  final shards = allNodes
                      .where((n) =>
                          n.nodeType == NodeType.shard &&
                          n.parentPath == pebble.path)
                      .toList();
                  return _PebbleTile(
                    key: ValueKey(pebble.id),
                    pebble: pebble,
                    shards: shards,
                    malletActive: malletActive,
                    editingId: editingId,
                    controllerFor: controllerFor,
                    focusNodeFor: focusNodeFor,
                    onSaveTitle: onSaveTitle,
                    onCommitTitle: onCommitTitle,
                    onStartEditing: onStartEditing,
                    onMalletOnPebble: onMalletOnPebble,
                    onMalletOnShard: onMalletOnShard,
                  );
                }),
            ],
          ),
        ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PEBBLE TILE
// ─────────────────────────────────────────────────────────────

class _PebbleTile extends StatelessWidget {
  const _PebbleTile({
    super.key,
    required this.pebble,
    required this.shards,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
  });

  final Node pebble;
  final List<Node> shards;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String nodeId, String initialTitle) onStartEditing;
  final Future<void> Function(Node) onMalletOnPebble;
  final Future<void> Function(Node) onMalletOnShard;

  @override
  Widget build(BuildContext context) {
    final isEditing = editingId == pebble.id;

    return DragTarget<bool>(
      onWillAcceptWithDetails: (_) => malletActive,
      onAcceptWithDetails: (_) => onMalletOnPebble(pebble),
      builder: (context, candidates, rejected) {
        final hovering = candidates.isNotEmpty && malletActive;
        return GestureDetector(
          onTap: malletActive ? () => onMalletOnPebble(pebble) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.fromLTRB(12, 0, 4, 4),
            decoration: BoxDecoration(
              color: hovering
                  ? AppColors.ember.withValues(alpha: 0.06)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(4),
              border: hovering
                  ? Border.all(
                      color: AppColors.ember.withValues(alpha: 0.5),
                      width: 1,
                    )
                  : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Pebble row
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
                child: Row(
                  children: [
                    const _NodeTypeIcon(type: NodeType.pebble),
                    const SizedBox(width: 8),
                    Expanded(
                      child: isEditing
                          ? _InlineTextField(
                              controller: controllerFor(pebble.id),
                              focusNode: focusNodeFor(pebble.id),
                              onSubmit: (v) => onSaveTitle(pebble.id, v),
                              placeholder: 'Name this task...',
                            )
                          : _TapToEditTitle(
                              enabled: !malletActive,
                              onTap: () => onStartEditing(pebble.id, pebble.title),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  pebble.title.isEmpty ? '(unnamed task)' : pebble.title,
                                  style: TextStyle(
                                    fontFamily: 'Georgia',
                                    fontSize: 12,
                                    color: pebble.title.isEmpty
                                        ? AppColors.ashGrey
                                        : AppColors.parchment
                                            .withValues(alpha: 0.85),
                                    fontStyle: pebble.title.isEmpty
                                        ? FontStyle.italic
                                        : FontStyle.normal,
                                  ),
                                ),
                              ),
                            ),
                    ),
                    _NodeMetaChips(node: pebble),
                    if (hovering)
                      const Text(
                        'SPLIT',
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 9,
                          letterSpacing: 1,
                          color: AppColors.ember,
                        ),
                      ),
                  ],
                ),
              ),
              // Shard children
              if (shards.isNotEmpty)
                ...shards.map((shard) => _ShardTile(
                      key: ValueKey(shard.id),
                      shard: shard,
                      malletActive: malletActive,
                      editingId: editingId,
                      controllerFor: controllerFor,
                      focusNodeFor: focusNodeFor,
                      onSaveTitle: onSaveTitle,
                      onCommitTitle: onCommitTitle,
                      onStartEditing: onStartEditing,
                      onMalletOnShard: onMalletOnShard,
                    )),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SHARD TILE (visual-only — no completion, no satchel)
// ─────────────────────────────────────────────────────────────

class _ShardTile extends StatelessWidget {
  const _ShardTile({
    super.key,
    required this.shard,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnShard,
  });

  final Node shard;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String nodeId, String initialTitle) onStartEditing;
  final Future<void> Function(Node) onMalletOnShard;

  @override
  Widget build(BuildContext context) {
    final isEditing = editingId == shard.id;

    return DragTarget<bool>(
      onWillAcceptWithDetails: (_) => malletActive,
      onAcceptWithDetails: (_) => onMalletOnShard(shard),
      builder: (context, candidates, rejected) {
        final hovering = candidates.isNotEmpty && malletActive;
        return GestureDetector(
          onTap: malletActive ? () => onMalletOnShard(shard) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.fromLTRB(28, 0, 4, 3),
            decoration: BoxDecoration(
              color: hovering
                  ? AppColors.ember.withValues(alpha: 0.04)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(3),
            ),
            child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 4,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.warmGrey,
                  ),
                ),
                Expanded(
                  child: isEditing
                      ? _InlineTextField(
                          controller: controllerFor(shard.id),
                          focusNode: focusNodeFor(shard.id),
                          onSubmit: (v) => onSaveTitle(shard.id, v),
                          placeholder: 'Name this sub-step...',
                          fontSize: 11,
                        )
                      : _TapToEditTitle(
                          enabled: !malletActive,
                          onTap: () => onStartEditing(shard.id, shard.title),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              shard.title.isEmpty ? '(unnamed shard)' : shard.title,
                              style: TextStyle(
                                fontFamily: 'Georgia',
                                fontSize: 11,
                                color: shard.title.isEmpty
                                    ? AppColors.ashGrey.withValues(alpha: 0.6)
                                    : AppColors.ashGrey,
                                fontStyle: shard.title.isEmpty
                                    ? FontStyle.italic
                                    : FontStyle.normal,
                              ),
                            ),
                          ),
                        ),
                ),
                if (hovering)
                  const Text(
                    'SPLIT',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 8,
                      letterSpacing: 1,
                      color: AppColors.ember,
                    ),
                  ),
              ],
            ),
          ),
        ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// MOUNTAIN TRAIL BODY
// Renders boulders as waypoints on a visual climbing path.
// Replaces the flat card-list layout with a trail metaphor.
// ─────────────────────────────────────────────────────────────

class _MountainTrailBody extends StatelessWidget {
  const _MountainTrailBody({
    required this.boulders,
    required this.allNodes,
    required this.mountain,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnBoulder,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
    required this.onDeleteNode,
  });

  final List<Node> boulders;
  final List<Node> allNodes;
  final Mountain mountain;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String, String) onStartEditing;
  final Future<void> Function(Mountain, Node) onMalletOnBoulder;
  final Future<void> Function(Node) onMalletOnPebble;
  final Future<void> Function(Node) onMalletOnShard;
  final void Function(BuildContext, Node) onDeleteNode;

  @override
  Widget build(BuildContext context) {
    if (boulders.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
        child: Text(
          malletActive
              ? 'Drop the mallet on the mountain name to add a boulder.'
              : 'No boulders yet — activate Architect Mode to build.',
          style: const TextStyle(
            color: AppColors.ashGrey,
            fontFamily: 'Georgia',
            fontStyle: FontStyle.italic,
            fontSize: 12,
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
      child: Column(
        children: List.generate(boulders.length, (i) {
          final boulder = boulders[i];
          final pebbles = allNodes
              .where((n) =>
                  n.nodeType == NodeType.pebble &&
                  n.parentPath == boulder.path)
              .toList();
          return _TrailWaypoint(
            key: ValueKey(boulder.id),
            boulder: boulder,
            pebbles: pebbles,
            allNodes: allNodes,
            mountain: mountain,
            isFirst: i == 0,
            isLast: i == boulders.length - 1,
            malletActive: malletActive,
            editingId: editingId,
            controllerFor: controllerFor,
            focusNodeFor: focusNodeFor,
            onSaveTitle: onSaveTitle,
            onCommitTitle: onCommitTitle,
            onStartEditing: onStartEditing,
            onMalletOnBoulder: onMalletOnBoulder,
            onMalletOnPebble: onMalletOnPebble,
            onMalletOnShard: onMalletOnShard,
            onDeleteNode: onDeleteNode,
          );
        }),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TRAIL WAYPOINT — one boulder + its pebbles on the path
// ─────────────────────────────────────────────────────────────

class _TrailWaypoint extends StatelessWidget {
  const _TrailWaypoint({
    super.key,
    required this.boulder,
    required this.pebbles,
    required this.allNodes,
    required this.mountain,
    required this.isFirst,
    required this.isLast,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnBoulder,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
    required this.onDeleteNode,
  });

  final Node boulder;
  final List<Node> pebbles;
  final List<Node> allNodes;
  final Mountain mountain;
  final bool isFirst;
  final bool isLast;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String, String) onStartEditing;
  final Future<void> Function(Mountain, Node) onMalletOnBoulder;
  final Future<void> Function(Node) onMalletOnPebble;
  final Future<void> Function(Node) onMalletOnShard;
  final void Function(BuildContext, Node) onDeleteNode;

  // Horizontal center of the trail line within the left column.
  static const double _cx = 16.0;
  // Y offset to the vertical center of the boulder marker circle.
  static const double _markerCy = 18.0;
  // Radius of the boulder marker.
  static const double _markerR = 9.0;

  @override
  Widget build(BuildContext context) {
    final isEditing = editingId == boulder.id;

    return DragTarget<bool>(
      onWillAcceptWithDetails: (_) => malletActive,
      onAcceptWithDetails: (_) => onMalletOnBoulder(mountain, boulder),
      builder: (context, candidates, rejected) {
        final hovering = candidates.isNotEmpty && malletActive;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: hovering
                ? AppColors.ember.withValues(alpha: 0.06)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Trail column (line + marker) ────────────
                SizedBox(
                  width: 36,
                  child: Stack(
                    children: [
                      // Line above the marker
                      if (!isFirst)
                        Positioned(
                          top: 0,
                          bottom: _markerCy,
                          left: _cx - 0.75,
                          child: Container(
                            width: 1.5,
                            color: AppColors.slotBorder,
                          ),
                        ),
                      // Line below the marker
                      if (!isLast)
                        Positioned(
                          top: _markerCy + _markerR,
                          bottom: 0,
                          left: _cx - 0.75,
                          child: Container(
                            width: 1.5,
                            color: AppColors.slotBorder,
                          ),
                        ),
                      // Boulder waypoint marker
                      Positioned(
                        top: _markerCy - _markerR,
                        left: _cx - _markerR,
                        child: _BoulderMarker(
                          hasPebbles: pebbles.isNotEmpty,
                          hovering: hovering,
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Content column ───────────────────────────
                Expanded(
                  child: Padding(
                    padding:
                        const EdgeInsets.only(top: 8, right: 8, bottom: 6),
                    child: Slidable(
                      key: ValueKey('slide-${boulder.id}'),
                      endActionPane: malletActive
                          ? ActionPane(
                              motion: const DrawerMotion(),
                              extentRatio: 0.28,
                              children: [
                                SlidableAction(
                                  onPressed: (ctx) =>
                                      onDeleteNode(ctx, boulder),
                                  backgroundColor:
                                      Colors.red.withValues(alpha: 0.75),
                                  foregroundColor: AppColors.parchment,
                                  icon: Icons.delete_outline,
                                  label: 'Delete',
                                ),
                              ],
                            )
                          : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Boulder title row
                          Row(
                            children: [
                              Expanded(
                                child: isEditing
                                    ? _InlineTextField(
                                        controller: controllerFor(boulder.id),
                                        focusNode: focusNodeFor(boulder.id),
                                        onSubmit: (v) =>
                                            onSaveTitle(boulder.id, v),
                                        placeholder: 'Name this milestone...',
                                        fontSize: 13,
                                      )
                                    : _TapToEditTitle(
                                        enabled: malletActive,
                                        onTap: () => onStartEditing(
                                            boulder.id, boulder.title),
                                        child: Text(
                                          boulder.title.isEmpty
                                              ? '(unnamed boulder)'
                                              : boulder.title,
                                          style: TextStyle(
                                            fontFamily: 'Georgia',
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: hovering
                                                ? AppColors.ember
                                                : boulder.title.isEmpty
                                                    ? AppColors.ashGrey
                                                    : AppColors.parchment,
                                            fontStyle: boulder.title.isEmpty
                                                ? FontStyle.italic
                                                : FontStyle.normal,
                                          ),
                                        ),
                                      ),
                              ),
                              if (hovering)
                                const Text(
                                  'ADD PEBBLE',
                                  style: TextStyle(
                                    fontFamily: 'Georgia',
                                    fontSize: 8,
                                    letterSpacing: 1,
                                    color: AppColors.ember,
                                  ),
                                ),
                            ],
                          ),

                          // Pebble items
                          if (pebbles.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            ...pebbles.map((pebble) {
                              final shards = allNodes
                                  .where((n) =>
                                      n.nodeType == NodeType.shard &&
                                      n.parentPath == pebble.path)
                                  .toList();
                              return _TrailPebbleRow(
                                key: ValueKey(pebble.id),
                                pebble: pebble,
                                shards: shards,
                                malletActive: malletActive,
                                editingId: editingId,
                                controllerFor: controllerFor,
                                focusNodeFor: focusNodeFor,
                                onSaveTitle: onSaveTitle,
                                onCommitTitle: onCommitTitle,
                                onStartEditing: onStartEditing,
                                onMalletOnPebble: onMalletOnPebble,
                                onMalletOnShard: onMalletOnShard,
                                onDeleteNode: onDeleteNode,
                              );
                            }),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TRAIL PEBBLE ROW
// ─────────────────────────────────────────────────────────────

class _TrailPebbleRow extends StatelessWidget {
  const _TrailPebbleRow({
    super.key,
    required this.pebble,
    required this.shards,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnPebble,
    required this.onMalletOnShard,
    required this.onDeleteNode,
  });

  final Node pebble;
  final List<Node> shards;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String, String) onStartEditing;
  final Future<void> Function(Node) onMalletOnPebble;
  final Future<void> Function(Node) onMalletOnShard;
  final void Function(BuildContext, Node) onDeleteNode;

  @override
  Widget build(BuildContext context) {
    final isEditing = editingId == pebble.id;

    return DragTarget<bool>(
      onWillAcceptWithDetails: (_) => malletActive,
      onAcceptWithDetails: (_) => onMalletOnPebble(pebble),
      builder: (context, candidates, rejected) {
        final hovering = candidates.isNotEmpty && malletActive;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.only(bottom: 4),
          padding: const EdgeInsets.symmetric(vertical: 2),
          decoration: BoxDecoration(
            color: hovering
                ? AppColors.ember.withValues(alpha: 0.05)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(3),
          ),
          child: Slidable(
            key: ValueKey('slide-${pebble.id}'),
            endActionPane: malletActive
                ? ActionPane(
                    motion: const DrawerMotion(),
                    extentRatio: 0.28,
                    children: [
                      SlidableAction(
                        onPressed: (ctx) => onDeleteNode(ctx, pebble),
                        backgroundColor: Colors.red.withValues(alpha: 0.75),
                        foregroundColor: AppColors.parchment,
                        icon: Icons.delete_outline,
                        label: 'Delete',
                      ),
                    ],
                  )
                : null,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Pebble dot marker
                    Container(
                      width: 7,
                      height: 7,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: hovering
                            ? AppColors.ember
                            : AppColors.warmGrey,
                        border: Border.all(
                          color: hovering
                              ? AppColors.ember
                              : AppColors.slotBorder,
                          width: 0.5,
                        ),
                      ),
                    ),
                    Expanded(
                      child: isEditing
                          ? _InlineTextField(
                              controller: controllerFor(pebble.id),
                              focusNode: focusNodeFor(pebble.id),
                              onSubmit: (v) => onSaveTitle(pebble.id, v),
                              placeholder: 'Name this task...',
                              fontSize: 12,
                            )
                          : _TapToEditTitle(
                              enabled: malletActive,
                              onTap: () =>
                                  onStartEditing(pebble.id, pebble.title),
                              child: Text(
                                pebble.title.isEmpty
                                    ? '(unnamed task)'
                                    : pebble.title,
                                style: TextStyle(
                                  fontFamily: 'Georgia',
                                  fontSize: 12,
                                  color: hovering
                                      ? AppColors.ember
                                      : pebble.title.isEmpty
                                          ? AppColors.ashGrey
                                              .withValues(alpha: 0.7)
                                          : AppColors.parchment
                                              .withValues(alpha: 0.85),
                                  fontStyle: pebble.title.isEmpty
                                      ? FontStyle.italic
                                      : FontStyle.normal,
                                ),
                              ),
                            ),
                    ),
                    // Meta chips
                    if (pebble.isStarred)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.star, size: 11, color: AppColors.gold),
                      ),
                    if (pebble.dueDate != null)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.calendar_today,
                            size: 9, color: AppColors.ember),
                      ),
                    if (hovering)
                      const Padding(
                        padding: EdgeInsets.only(left: 6),
                        child: Text(
                          'ADD SHARD',
                          style: TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 8,
                            letterSpacing: 1,
                            color: AppColors.ember,
                          ),
                        ),
                      ),
                  ],
                ),
                // Shard sub-items
                if (shards.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  ...shards.map((shard) => _TrailShardItem(
                        key: ValueKey(shard.id),
                        shard: shard,
                        malletActive: malletActive,
                        editingId: editingId,
                        controllerFor: controllerFor,
                        focusNodeFor: focusNodeFor,
                        onSaveTitle: onSaveTitle,
                        onCommitTitle: onCommitTitle,
                        onStartEditing: onStartEditing,
                        onMalletOnShard: onMalletOnShard,
                        onDeleteNode: onDeleteNode,
                      )),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TRAIL SHARD ITEM
// ─────────────────────────────────────────────────────────────

class _TrailShardItem extends StatelessWidget {
  const _TrailShardItem({
    super.key,
    required this.shard,
    required this.malletActive,
    required this.editingId,
    required this.controllerFor,
    required this.focusNodeFor,
    required this.onSaveTitle,
    required this.onCommitTitle,
    required this.onStartEditing,
    required this.onMalletOnShard,
    required this.onDeleteNode,
  });

  final Node shard;
  final bool malletActive;
  final String? editingId;
  final TextEditingController Function(String) controllerFor;
  final FocusNode Function(String) focusNodeFor;
  final Future<void> Function(String, String) onSaveTitle;
  final Future<void> Function(String, String) onCommitTitle;
  final void Function(String, String) onStartEditing;
  final Future<void> Function(Node) onMalletOnShard;
  final void Function(BuildContext, Node) onDeleteNode;

  @override
  Widget build(BuildContext context) {
    final isEditing = editingId == shard.id;

    return DragTarget<bool>(
      onWillAcceptWithDetails: (_) => malletActive,
      onAcceptWithDetails: (_) => onMalletOnShard(shard),
      builder: (context, candidates, rejected) {
        final hovering = candidates.isNotEmpty && malletActive;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 2),
          decoration: BoxDecoration(
            color: hovering
                ? AppColors.ember.withValues(alpha: 0.04)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(2),
          ),
          child: Slidable(
            key: ValueKey('slide-${shard.id}'),
            endActionPane: malletActive
                ? ActionPane(
                    motion: const DrawerMotion(),
                    extentRatio: 0.28,
                    children: [
                      SlidableAction(
                        onPressed: (ctx) => onDeleteNode(ctx, shard),
                        backgroundColor: Colors.red.withValues(alpha: 0.75),
                        foregroundColor: AppColors.parchment,
                        icon: Icons.delete_outline,
                        label: 'Delete',
                      ),
                    ],
                  )
                : null,
            child: Row(
              children: [
                const SizedBox(width: 15), // indent under pebble bullet
                Container(
                  width: 4,
                  height: 4,
                  margin: const EdgeInsets.only(right: 7),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: hovering
                        ? AppColors.ember.withValues(alpha: 0.8)
                        : AppColors.warmGrey.withValues(alpha: 0.5),
                  ),
                ),
                Expanded(
                  child: isEditing
                      ? _InlineTextField(
                          controller: controllerFor(shard.id),
                          focusNode: focusNodeFor(shard.id),
                          onSubmit: (v) => onSaveTitle(shard.id, v),
                          placeholder: 'Name this sub-step...',
                          fontSize: 11,
                        )
                      : _TapToEditTitle(
                          enabled: malletActive,
                          onTap: () => onStartEditing(shard.id, shard.title),
                          child: Text(
                            shard.title.isEmpty
                                ? '(unnamed shard)'
                                : shard.title,
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 11,
                              color: shard.title.isEmpty
                                  ? AppColors.ashGrey.withValues(alpha: 0.5)
                                  : AppColors.ashGrey,
                              fontStyle: shard.title.isEmpty
                                  ? FontStyle.italic
                                  : FontStyle.normal,
                            ),
                          ),
                        ),
                ),
                if (hovering)
                  const Text(
                    'SPLIT',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 8,
                      letterSpacing: 1,
                      color: AppColors.ember,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// BOULDER MARKER — circle waypoint on the trail
// ─────────────────────────────────────────────────────────────

class _BoulderMarker extends StatelessWidget {
  const _BoulderMarker({
    required this.hasPebbles,
    this.hovering = false,
  });

  final bool hasPebbles;
  final bool hovering;

  @override
  Widget build(BuildContext context) {
    final color = hovering
        ? AppColors.ember
        : hasPebbles
            ? AppColors.gold.withValues(alpha: 0.9)
            : AppColors.warmGrey;
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withValues(alpha: 0.15),
        border: Border.all(color: color, width: 1.5),
      ),
      child: Center(
        child: Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// THE MALLET DRAGGABLE
// ─────────────────────────────────────────────────────────────

class _MalletDraggable extends StatelessWidget {
  const _MalletDraggable();

  @override
  Widget build(BuildContext context) {
    return Draggable<bool>(
      data: true,
      feedback: Material(
        color: Colors.transparent,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.ember,
            boxShadow: [
              BoxShadow(
                color: AppColors.ember.withValues(alpha: 0.5),
                blurRadius: 20,
                spreadRadius: 4,
              ),
            ],
          ),
          child: const Icon(
            Icons.hardware,
            color: AppColors.parchment,
            size: 26,
          ),
        ),
      ),
      childWhenDragging: Opacity(
        opacity: 0.3,
        child: _malletIcon(),
      ),
      child: _malletIcon()
          .animate(
            onPlay: (c) => c.repeat(reverse: true),
          )
          .shimmer(
            duration: 2000.ms,
            color: AppColors.gold.withValues(alpha: 0.4),
          ),
    );
  }

  Widget _malletIcon() {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.black,
        border: Border.all(color: AppColors.ember, width: 1.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Image.asset(
          'assets/mallet/mallet.png',
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────

/// Tap-to-edit wrapper. Uses Listener (not GestureDetector) for web compatibility.
class _TapToEditTitle extends StatelessWidget {
  const _TapToEditTitle({
    required this.enabled,
    required this.onTap,
    required this.child,
  });

  final bool enabled;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: (_) => onTap(),
      child: child,
    );
  }
}

class _InlineTextField extends StatefulWidget {
  const _InlineTextField({
    required this.controller,
    required this.focusNode,
    required this.onSubmit,
    required this.placeholder,
    this.fontSize = 13,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final void Function(String) onSubmit;
  final String placeholder;
  final double fontSize;

  @override
  State<_InlineTextField> createState() => _InlineTextFieldState();
}

class _InlineTextFieldState extends State<_InlineTextField> {
  bool _hadFocus = false;

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    if (widget.focusNode.hasFocus) {
      _hadFocus = true;
    } else if (_hadFocus) {
      _hadFocus = false;
      widget.onSubmit(widget.controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      focusNode: widget.focusNode,
      textInputAction: TextInputAction.done,
      style: TextStyle(
        fontFamily: 'Georgia',
        fontSize: widget.fontSize,
        color: AppColors.parchment,
      ),
      decoration: InputDecoration(
        hintText: widget.placeholder,
        hintStyle: TextStyle(
          fontFamily: 'Georgia',
          fontSize: widget.fontSize,
          color: AppColors.ashGrey,
          fontStyle: FontStyle.italic,
        ),
        isDense: true,
        contentPadding: EdgeInsets.zero,
        border: InputBorder.none,
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.ember, width: 0.5),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.ember, width: 1),
        ),
      ),
    );
  }
}

class _NodeTypeIcon extends StatelessWidget {
  const _NodeTypeIcon({required this.type});
  final NodeType type;

  @override
  Widget build(BuildContext context) {
    return switch (type) {
      NodeType.boulder => const Icon(
          Icons.circle,
          size: 10,
          color: AppColors.ashGrey,
        ),
      NodeType.pebble => const Icon(
          Icons.circle,
          size: 8,
          color: AppColors.ashGrey,
        ),
      NodeType.shard => Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.warmGrey.withValues(alpha: 0.6),
          ),
        ),
    };
  }
}

class _NodeMetaChips extends StatelessWidget {
  const _NodeMetaChips({required this.node});
  final Node node;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (node.isStarred) ...[
          const SizedBox(width: 6),
          const Icon(Icons.star, size: 11, color: AppColors.gold),
        ],
        if (node.dueDate != null) ...[
          const SizedBox(width: 4),
          const Icon(Icons.calendar_today, size: 9, color: AppColors.ember),
        ],
      ],
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.progress});
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.slotEmpty,
              valueColor: const AlwaysStoppedAnimation(AppColors.ember),
              minHeight: 3,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          '${(progress * 100).round()}%',
          style: const TextStyle(
            color: AppColors.ashGrey,
            fontFamily: 'Georgia',
            fontSize: 10,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({this.onAdd});
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.landscape_outlined, size: 48, color: AppColors.ashGrey),
          const SizedBox(height: 16),
          const Text(
            'No mountains yet.',
            style: TextStyle(
              color: AppColors.ashGrey,
              fontFamily: 'Georgia',
              fontStyle: FontStyle.italic,
              fontSize: 15,
            ),
          ),
          if (onAdd != null) ...[
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: onAdd,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.ember),
                foregroundColor: AppColors.ember,
              ),
              child: const Text(
                'Open a New Path',
                style: TextStyle(fontFamily: 'Georgia'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// STYLED DIALOG (shared)
// ─────────────────────────────────────────────────────────────

class _StyledDialog extends StatelessWidget {
  const _StyledDialog({
    required this.title,
    required this.hint,
    required this.controller,
    required this.confirmLabel,
    required this.onConfirm,
  });

  final String title;
  final String hint;
  final TextEditingController controller;
  final String confirmLabel;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.charcoal,
      title: Text(
        title,
        style: const TextStyle(
          fontFamily: 'Georgia',
          color: AppColors.parchment,
          fontSize: 16,
        ),
      ),
      content: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(color: AppColors.parchment, fontFamily: 'Georgia'),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: AppColors.ashGrey),
          enabledBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: AppColors.slotBorder),
          ),
          focusedBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: AppColors.ember),
          ),
        ),
        onSubmitted: (_) => onConfirm(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel',
              style: TextStyle(color: AppColors.ashGrey)),
        ),
        TextButton(
          onPressed: onConfirm,
          child: Text(
            confirmLabel,
            style: const TextStyle(
              color: AppColors.ember,
              fontFamily: 'Georgia',
            ),
          ),
        ),
      ],
    );
  }
}
