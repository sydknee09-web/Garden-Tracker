import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../core/enums/day_period.dart' show ScenePeriod;
import '../../providers/climb_flow_provider.dart';
import '../../providers/mountain_provider.dart';
import '../../providers/narrow_invalidation.dart';
import '../../providers/node_provider.dart';
import '../../providers/active_pebbles_provider.dart';
import '../../providers/satchel_provider.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';
import '../../widgets/typewriter_text.dart';

/// Full-screen guided Climb overlay. 6-step wizard (0–5): Intent, Identity, Appearance, Logic, Markers, Placing stones.
/// Uses Stack so Elias slightly overlaps content (luxury depth).
class ClimbFlowOverlay extends ConsumerStatefulWidget {
  const ClimbFlowOverlay({
    super.key,
    required this.onClose,
    this.onComplete,
    this.returnLabel = 'Stow the Map',
  });

  final VoidCallback onClose;
  /// Called only when the wizard is closed from step 5 (success). Intro uses this to show "mountain carved" dialog; other callers leave it null.
  final VoidCallback? onComplete;
  /// Shown on exit-to-Map control (Center/Right). Use 'Stow the Map' when opened from Elias (dialog).
  final String returnLabel;

  @override
  ConsumerState<ClimbFlowOverlay> createState() => _ClimbFlowOverlayState();
}

class _ClimbFlowOverlayState extends ConsumerState<ClimbFlowOverlay> {
  late final TextEditingController _intentController;
  late final TextEditingController _peakController;
  final List<TextEditingController> _landmarkControllers = [];
  final List<FocusNode> _landmarkFocusNodes = [];
  String? _cachedIntentLine;
  String? _cachedIdentityLine;
  String? _cachedLogicLine;
  String? _cachedAppearanceLine;
  String? _cachedLandmarksLine;
  String? _cachedPebblesLine;
  int? _lastBuiltStep;
  int? _lastBuiltEliasIndex;
  bool _showMalletStrike = false;
  /// Stagger: show Elias + dialogue first, then fade in input after 1.2s.
  bool _showStepInput = false;
  Timer? _stepInputTimer;
  int? _lastStepForStagger;

  static const int _minLandmarks = 1;
  static const int _maxLandmarks = 10;
  static const int _intentCap = 1000;
  /// Head/bust asset for wizard (one per menu); full-body is intro-only.
  static const String _eliasHeadAsset = 'assets/elias/EliasFloatingSmile.png';

  @override
  void initState() {
    super.initState();
    // climbFlowProvider is non-autoDispose; ref.watch(climbFlowProvider) in build keeps it alive while overlay is mounted.
    _intentController = TextEditingController();
    _peakController = TextEditingController();
    _landmarkControllers.add(TextEditingController());
    _landmarkFocusNodes.add(FocusNode());
  }

  @override
  void dispose() {
    _stepInputTimer?.cancel();
    for (final f in _landmarkFocusNodes) {
      f.dispose();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.invalidate(climbFlowProvider);
    });
    _intentController.dispose();
    _peakController.dispose();
    for (final c in _landmarkControllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _addLandmark() {
    if (_landmarkControllers.length >= _maxLandmarks) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            EliasDialogue.heavySatchel(),
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
    setState(() {
      _landmarkControllers.add(TextEditingController());
      _landmarkFocusNodes.add(FocusNode());
    });
  }

  void _removeLandmark() {
    if (_landmarkControllers.length <= _minLandmarks) return;
    final c = _landmarkControllers.removeLast();
    final f = _landmarkFocusNodes.removeLast();
    c.dispose();
    f.dispose();
    setState(() {});
  }

  static const _templates = [
    ['Research', 'Plan', 'Execute', 'Review'],
    ['Discover', 'Design', 'Do', 'Review'],
  ];

  void _applyTemplate(int index) {
    final template = _templates[index];
    while (_landmarkControllers.length < template.length &&
        _landmarkControllers.length < _maxLandmarks) {
      _landmarkControllers.add(TextEditingController());
      _landmarkFocusNodes.add(FocusNode());
    }
    for (var i = 0; i < template.length && i < _landmarkControllers.length; i++) {
      _landmarkControllers[i].text = template[i];
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(climbFlowProvider);
    final period = ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;

    // Stagger: when step changes, hide input then show after delay. Shorter for non-input steps (2, 3) to keep momentum.
    if (state.step != _lastStepForStagger) {
      _lastStepForStagger = state.step;
      _showStepInput = false;
      _stepInputTimer?.cancel();
      final delayMs = (state.step == 2 || state.step == 3) ? 800 : 1200;
      _stepInputTimer = Timer(Duration(milliseconds: delayMs), () {
        if (mounted) setState(() => _showStepInput = true);
      });
    }

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleBack(state);
      },
      child: Scaffold(
        backgroundColor: AppColors.inkBlack.withValues(alpha: 0.85),
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          child: Stack(
            children: [
              // Compass — top-right
              Positioned(
                top: 8,
                right: 16,
                child: IconButton(
                  icon: const Icon(Icons.explore, color: AppColors.parchment),
                  tooltip: widget.returnLabel,
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    widget.onClose();
                  },
                ),
              ),
              // Mallet strike overlay (when pebble created)
              if (_showMalletStrike)
                const Center(
                  child: _MalletStrikeOverlay(),
                ),
              // Step content: top-aligned so when keyboard opens the menu stays reachable by scrolling
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: SingleChildScrollView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    child: Padding(
                      padding: EdgeInsets.only(
                        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 400),
                        child: _buildStep(state, period),
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

  void _handleBack(ClimbFlowState state) {
    // Step 5 (Placing stones): wizard completed; notify then close
    if (state.step == 5) {
      widget.onComplete?.call();
      widget.onClose();
      return;
    }
    final hasInput = switch (state.step) {
      0 => _intentController.text.trim().isNotEmpty,
      1 => _peakController.text.trim().isNotEmpty,
      2 => true, // Appearance has selection
      3 => true, // Logic has selection
      4 => _landmarkControllers.any((c) => c.text.trim().isNotEmpty),
      _ => false,
    };
    if (hasInput) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            "Leaving so soon? Your progress here will be lost.",
            style: TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
          ),
          backgroundColor: AppColors.charcoal,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    widget.onClose();
  }

  Widget _buildStep(ClimbFlowState state, ScenePeriod period) {
    if (_lastBuiltStep != state.step || _lastBuiltEliasIndex != state.lastEliasIndex) {
      _lastBuiltStep = state.step;
      _lastBuiltEliasIndex = state.lastEliasIndex;
      _cachedIntentLine = null;
      _cachedIdentityLine = null;
      _cachedLogicLine = null;
      _cachedAppearanceLine = null;
      _cachedLandmarksLine = null;
      _cachedPebblesLine = null;
    }
    switch (state.step) {
      case 0:
        _cachedIntentLine ??= EliasDialogue.climbIntentPromptWithIndex(state.lastEliasIndex).$1;
        return _Step1Intent(
          period: period,
          controller: _intentController,
          eliasLine: _cachedIntentLine!,
          maxChars: _intentCap,
          onContinue: _onStep0Continue,
          onReturnToMap: widget.onClose,
          returnLabel: widget.returnLabel,
          onBack: null,
          showInput: _showStepInput,
        );
      case 1:
        _cachedIdentityLine ??= EliasDialogue.climbIdentityPromptWithIndex(state.lastEliasIndex).$1;
        return _Step2Identity(
          period: period,
          controller: _peakController,
          eliasLine: _cachedIdentityLine!,
          onContinue: _onStep1Continue,
          onReturnToMap: widget.onClose,
          returnLabel: widget.returnLabel,
          onBack: () {
            HapticFeedback.lightImpact();
            ref.read(climbFlowProvider.notifier).setStep(0);
          },
          showInput: _showStepInput,
        );
      case 2:
        _cachedAppearanceLine ??= 'Every mountain has a spirit. How shall we visualize this journey?';
        return _Step2Appearance(
          period: period,
          appearanceStyle: state.appearanceStyle,
          eliasLine: _cachedAppearanceLine!,
          onContinue: _onStep2AppearanceContinue,
          onReturnToMap: widget.onClose,
          returnLabel: widget.returnLabel,
          onSelectStyle: (s) => ref.read(climbFlowProvider.notifier).setAppearanceStyle(s),
          onBack: () {
            HapticFeedback.lightImpact();
            ref.read(climbFlowProvider.notifier).setStep(1);
          },
          showInput: _showStepInput,
        );
      case 3:
        _cachedLogicLine ??= EliasDialogue.climbLogicPromptWithIndex(state.lastEliasIndex).$1;
        return _Step3Logic(
          period: period,
          layoutType: state.layoutType,
          eliasLine: _cachedLogicLine!,
          onContinue: _onStep3Continue,
          onReturnToMap: widget.onClose,
          returnLabel: widget.returnLabel,
          onSelectLayout: (t) => ref.read(climbFlowProvider.notifier).setLayoutType(t),
          onBack: () {
            HapticFeedback.lightImpact();
            ref.read(climbFlowProvider.notifier).setStep(2);
          },
          showInput: _showStepInput,
        );
      case 4:
        _cachedLandmarksLine ??= EliasDialogue.climbLandmarksPromptWithIndex(state.lastEliasIndex).$1;
        final markerLabel = state.layoutType == 'survey' ? 'Region' : 'Milestone';
        return _Step4Markers(
          period: period,
          controllers: _landmarkControllers,
          focusNodes: _landmarkFocusNodes,
          eliasLine: _cachedLandmarksLine!,
          markerLabel: markerLabel,
          onContinue: _onStep4Continue,
          onBack: () {
            HapticFeedback.lightImpact();
            ref.read(climbFlowProvider.notifier).setStep(3);
          },
          onReturnToMap: widget.onClose,
          returnLabel: widget.returnLabel,
          onAddLandmark: _addLandmark,
          onRemoveLandmark: _removeLandmark,
          onApplyTemplate: _applyTemplate,
          canAdd: _landmarkControllers.length < _maxLandmarks,
          canRemove: _landmarkControllers.length > _minLandmarks,
          showInput: _showStepInput,
        );
      case 5:
        _cachedPebblesLine ??= EliasDialogue.climbPebblesPromptWithIndex(state.lastEliasIndex).$1;
        final markerLabel = state.layoutType == 'survey' ? 'Region' : 'Milestone';
        return _Step5Pebbles(
          period: period,
          state: state,
          markerLabel: markerLabel,
          eliasLine: _cachedPebblesLine!,
          onStoneTap: _onStoneTap,
          onCreatePebble: _createPebbleAndAnimate,
          onCancelNaming: () => ref.read(climbFlowProvider.notifier).setNamingStoneIndex(null),
          onDoneWithLandmark: _onDoneWithLandmark,
          onNextStone: _onNextStone,
          onClose: () {
            widget.onComplete?.call();
            widget.onClose();
          },
          returnLabel: widget.returnLabel,
          onAscension: () => context.go('/sanctuary?focusOnHearth=true'),
          onBack: () {
            HapticFeedback.lightImpact();
            ref.read(climbFlowProvider.notifier).setStep(4);
          },
        );
      default:
        _cachedIntentLine ??= EliasDialogue.climbIntentPromptWithIndex(-1).$1;
        return _Step1Intent(
          period: period,
          controller: _intentController,
          eliasLine: _cachedIntentLine!,
          maxChars: _intentCap,
          onContinue: _onStep0Continue,
          onReturnToMap: widget.onClose,
          returnLabel: widget.returnLabel,
          onBack: null,
          showInput: _showStepInput,
        );
    }
  }

  Future<void> _onStep0Continue() async {
    final intent = _intentController.text.trim();
    if (intent.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Share the intent behind this journey.',
            style: TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
          ),
          backgroundColor: AppColors.charcoal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (intent.length > _intentCap) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            EliasDialogue.intentCapReached(),
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
    HapticFeedback.mediumImpact();
    ref.read(climbFlowProvider.notifier)
      ..setStep(1)
      ..setLastEliasIndex(-1);
  }

  Future<void> _onStep1Continue() async {
    final name = _peakController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Give the peak a name.',
            style: TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
          ),
          backgroundColor: AppColors.charcoal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    HapticFeedback.mediumImpact();
    ref.read(climbFlowProvider.notifier)
      ..setStep(2)
      ..setLastEliasIndex(-1);
  }

  Future<void> _onStep2AppearanceContinue() async {
    final name = _peakController.text.trim();
    final intent = _intentController.text.trim();
    final state = ref.read(climbFlowProvider);
    HapticFeedback.mediumImpact();
    try {
      if (state.mountainId != null) {
        // Edit Appearance mode: update existing mountain
        await ref.read(mountainActionsProvider).updateBlueprint(
          id: state.mountainId!,
          appearanceStyle: state.appearanceStyle,
        );
        if (name != state.mountainName) {
          await ref.read(mountainActionsProvider).rename(id: state.mountainId!, name: name);
          ref.read(climbFlowProvider.notifier).setMountain(state.mountainId!, name);
        }
        ref.invalidate(mountainListProvider);
      } else {
        // Create mountain atomically (name + appearance in hand)
        final mountain = await ref.read(mountainActionsProvider).create(
          name: name,
          intentStatement: intent.isNotEmpty ? intent : null,
          layoutType: state.layoutType,
          appearanceStyle: state.appearanceStyle,
        );
        ref.invalidate(mountainListProvider);
        ref.read(climbFlowProvider.notifier)
          ..setMountain(mountain.id, mountain.name)
          ..setLastEliasIndex(-1);
      }
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          ref.read(climbFlowProvider.notifier)
            ..setStep(3)
            ..setPebbleStepBoulderIndex(0);
        });
      }
    } catch (e, stackTrace) {
      debugPrint('Theme step save failed: $e');
      debugPrint(stackTrace.toString());
      if (mounted) {
        // Show error hint in all builds so user can report it without running debug
        final errStr = e.toString().split('\n').first;
        final hint = errStr.length > 100 ? '${errStr.substring(0, 100)}…' : errStr;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "Couldn't save. Try again.\n$hint",
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.parchment,
                fontSize: 12,
              ),
            ),
            backgroundColor: AppColors.charcoal,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 6),
          ),
        );
      }
    }
  }

  Future<void> _onStep3Continue() async {
    final state = ref.read(climbFlowProvider);
    HapticFeedback.mediumImpact();
    try {
      if (state.mountainId != null) {
        await ref.read(mountainActionsProvider).updateBlueprint(
          id: state.mountainId!,
          layoutType: state.layoutType,
        );
        ref.invalidate(mountainListProvider);
      }
      ref.read(climbFlowProvider.notifier)
        ..setStep(4)
        ..setPebbleStepBoulderIndex(0)
        ..setLastEliasIndex(-1);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              "Couldn't save. Try again.",
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

  void _onDoneWithLandmark() {
    HapticFeedback.mediumImpact();
    ref.read(climbFlowProvider.notifier).setPebbleStepBoulderIndex(
      ref.read(climbFlowProvider).pebbleStepBoulderIndex + 1,
    );
  }

  void _onNextStone() => _onDoneWithLandmark();

  void _onStoneTap(int stoneIndex) {
    final state = ref.read(climbFlowProvider);
    if (state.mountainId == null || state.boulderIds.length <= stoneIndex) return;
    ref.read(climbFlowProvider.notifier).setNamingStoneIndex(stoneIndex);
  }

  /// Creates a pebble. [moveToNext] = true: close card and advance to next marker.
  /// [moveToNext] = false: stay on current marker, clear field (batch entry). Never dismiss keyboard.
  Future<void> _createPebbleAndAnimate(int stoneIndex, String title, {bool moveToNext = false}) async {
    final state = ref.read(climbFlowProvider);
    if (state.mountainId == null || state.boulderIds.length <= stoneIndex) return;
    HapticFeedback.mediumImpact();
    try {
      final node = await ref.read(nodeActionsProvider).createPebble(
        mountainId: state.mountainId!,
        boulderId: state.boulderIds[stoneIndex],
        title: title.isNotEmpty ? title : 'New pebble',
        isPendingRitual: true,
      );
      await ref.read(satchelProvider.notifier).movePebbleToReady(node.id);
      invalidateAfterNodeMutation(ref, state.mountainId!);
      final notifier = ref.read(climbFlowProvider.notifier);
      if (moveToNext) {
        notifier.setNamingStoneIndex(null);
        final nextIdx = stoneIndex + 1;
        if (nextIdx < state.boulderIds.length) {
          notifier.setPebbleStepBoulderIndex(nextIdx);
          notifier.setNamingStoneIndex(nextIdx);
        } else {
          notifier.setPebbleStepBoulderIndex(nextIdx);
        }
      }
      if (mounted) {
        setState(() => _showMalletStrike = true);
        Future.delayed(const Duration(milliseconds: 450), () {
          if (mounted) setState(() => _showMalletStrike = false);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.climbPebbleAdded(),
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
            content: const Text(
              "Couldn't save. Try again.",
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

  Future<void> _onStep4Continue() async {
    final names = _landmarkControllers.map((c) => c.text.trim()).toList();
    if (names.any((n) => n.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Name all landmarks.',
            style: TextStyle(fontFamily: 'Georgia', color: AppColors.parchment),
          ),
          backgroundColor: AppColors.charcoal,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final seen = <String>{};
    for (final n in names) {
      final lower = n.toLowerCase();
      if (seen.contains(lower)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              EliasDialogue.duplicateLandmark(),
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
      seen.add(lower);
    }
    final state = ref.read(climbFlowProvider);
    final mountainId = state.mountainId!;
    HapticFeedback.mediumImpact();
    try {
      final nodeActions = ref.read(nodeActionsProvider);
      final ids = <String>[];
      for (final title in names) {
        final node = await nodeActions.createBoulder(
          mountainId: mountainId,
          title: title,
        );
        ids.add(node.id);
      }
    invalidateAfterNodeMutation(ref, mountainId);
    ref.read(climbFlowProvider.notifier)
        ..setLandmarks(ids, names)
        ..setStep(5)
        ..setPebbleStepBoulderIndex(0)
        ..setLastEliasIndex(-1);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "Couldn't save. Try again.",
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

// ── Shared wizard nav row (Item 41: no wrap, consistent spacing, Sanctuary Lexicon) ───

class _WizardNavRow extends StatelessWidget {
  const _WizardNavRow({
    required this.onReturnToMap,
    required this.returnLabel,
    required this.onContinue,
    this.onBack,
    this.continueEnabled = true,
    this.primaryLabel,
    this.onPrimaryPressed,
    this.primaryEnabled,
  });

  final VoidCallback? onBack;
  final VoidCallback onReturnToMap;
  final String returnLabel;
  final VoidCallback onContinue;
  /// When false, the primary Continue button is disabled (e.g. until intent has text).
  final bool continueEnabled;
  /// When set, overrides the primary button label and action (e.g. "Return" to dismiss keyboard).
  final String? primaryLabel;
  final VoidCallback? onPrimaryPressed;
  final bool? primaryEnabled;

  static const String _backLabel = 'Previous Step';
  static const String _defaultPrimaryLabel = 'Continue';

  @override
  Widget build(BuildContext context) {
    final useReturnMode = primaryLabel != null && onPrimaryPressed != null && primaryEnabled != null;
    final label = useReturnMode ? primaryLabel! : _defaultPrimaryLabel;
    final onPrimary = useReturnMode ? onPrimaryPressed! : onContinue;
    final enabled = useReturnMode ? primaryEnabled! : continueEnabled;

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (onBack != null) ...[
          TextButton.icon(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back, size: 18, color: AppColors.darkWalnut),
            label: Text(
              _backLabel,
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.darkWalnut,
              ),
            ),
          ),
          const SizedBox(width: 12),
        ],
        Flexible(
          child: TextButton(
            onPressed: onReturnToMap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 120),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.center,
                child: Text(
                  returnLabel,
                  softWrap: false,
                  overflow: TextOverflow.visible,
                  style: const TextStyle(
                    fontFamily: 'Georgia',
                    color: AppColors.darkWalnut,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        FilledButton(
          onPressed: enabled ? onPrimary : null,
          style: FilledButton.styleFrom(
            backgroundColor: enabled ? AppColors.ember : AppColors.ashGrey,
            foregroundColor: AppColors.parchment,
          ),
          child: Text(
            label,
            style: const TextStyle(fontFamily: 'Georgia'),
          ),
        ),
      ],
    );
  }
}

// ── Elias line with fade ("breath" between lines) ─────────────

class _EliasLineWithFade extends StatefulWidget {
  const _EliasLineWithFade({required this.line, required this.child});
  final String line;
  final Widget child;

  @override
  State<_EliasLineWithFade> createState() => _EliasLineWithFadeState();
}

class _EliasLineWithFadeState extends State<_EliasLineWithFade>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 280),
      vsync: this,
    );
    _opacity = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _controller.forward();
  }

  @override
  void didUpdateWidget(_EliasLineWithFade oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.line != widget.line) {
      _controller.reset();
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _opacity, child: widget.child);
  }
}

// ── Step 1: The Intent ───────────────────────────────────────

class _Step1Intent extends StatefulWidget {
  const _Step1Intent({
    required this.period,
    required this.controller,
    required this.eliasLine,
    required this.maxChars,
    required this.onContinue,
    required this.onReturnToMap,
    this.returnLabel = 'Stow the Map',
    this.onBack,
    this.showInput = true,
  });

  final ScenePeriod period;
  final TextEditingController controller;
  final String eliasLine;
  final int maxChars;
  final VoidCallback onContinue;
  final VoidCallback onReturnToMap;
  final String returnLabel;
  final VoidCallback? onBack;
  final bool showInput;

  @override
  State<_Step1Intent> createState() => _Step1IntentState();
}

class _Step1IntentState extends State<_Step1Intent> {
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
    _focusNode.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    _focusNode.dispose();
    super.dispose();
  }

  void _onTextChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(0, 20),
            child: EliasWidget(
              period: widget.period,
              width: 100,
              height: 120,
              showGreeting: false,
              assetPathOverride: _ClimbFlowOverlayState._eliasHeadAsset,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1.5),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (context, spacing, _) => _EliasLineWithFade(
                  line: widget.eliasLine,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    child: TypewriterText(
                      key: ValueKey(widget.eliasLine),
                      text: widget.eliasLine,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        letterSpacing: spacing,
                        color: AppColors.whetInk,
                        height: 1.4,
                      ),
                      duration: const Duration(milliseconds: 1200),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              IgnorePointer(
                ignoring: !widget.showInput,
                child: AnimatedOpacity(
                  opacity: widget.showInput ? 1 : 0,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOut,
                  child: AnimatedSlide(
                    offset: widget.showInput ? Offset.zero : const Offset(0, 0.05),
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOutCubic,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'One sentence to guide your journey.',
                          style: TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 12,
                            color: AppColors.darkWalnut,
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          controller: widget.controller,
                          focusNode: _focusNode,
                          autofocus: true,
                          maxLength: widget.maxChars,
                          maxLines: 4,
                          style: const TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 16,
                            color: AppColors.whetInk,
                          ),
                          decoration: InputDecoration(
                            contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 0),
                            hintText: 'e.g., To find stillness in my daily work...',
                            hintStyle: const TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 14,
                              color: AppColors.ashGrey,
                              fontStyle: FontStyle.italic,
                            ),
                            counterText: widget.controller.text.length >= 900
                                ? '${widget.controller.text.length} / ${widget.maxChars}'
                                : '',
                            counterStyle: TextStyle(
                              fontFamily: 'Georgia',
                              fontSize: 12,
                              color: widget.controller.text.length >= widget.maxChars
                                  ? AppColors.ember
                                  : AppColors.darkWalnut,
                            ),
                            enabledBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: AppColors.whetLine),
                            ),
                            focusedBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: AppColors.whetLine),
                            ),
                          ),
                          onSubmitted: (_) => widget.onContinue(),
                        ),
                        const SizedBox(height: 24),
                        _WizardNavRow(
                          onBack: widget.onBack,
                          onReturnToMap: widget.onReturnToMap,
                          returnLabel: widget.returnLabel,
                          onContinue: () {
                            if (_focusNode.hasFocus) _focusNode.unfocus();
                            widget.onContinue();
                          },
                          continueEnabled: widget.controller.text.trim().isNotEmpty,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Step 2: The Identity ──────────────────────────────────────

class _Step2Identity extends StatefulWidget {
  const _Step2Identity({
    required this.period,
    required this.controller,
    required this.eliasLine,
    required this.onContinue,
    required this.onReturnToMap,
    this.returnLabel = 'Stow the Map',
    this.onBack,
    this.showInput = true,
  });

  final ScenePeriod period;
  final TextEditingController controller;
  final String eliasLine;
  final VoidCallback onContinue;
  final VoidCallback onReturnToMap;
  final String returnLabel;
  final VoidCallback? onBack;
  final bool showInput;

  @override
  State<_Step2Identity> createState() => _Step2IdentityState();
}

class _Step2IdentityState extends State<_Step2Identity> {
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(0, 20),
            child: EliasWidget(
              period: widget.period,
              width: 100,
              height: 120,
              showGreeting: false,
              assetPathOverride: _ClimbFlowOverlayState._eliasHeadAsset,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1.5),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (context, spacing, _) => _EliasLineWithFade(
                  line: widget.eliasLine,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    child: TypewriterText(
                      key: ValueKey(widget.eliasLine),
                      text: widget.eliasLine,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        letterSpacing: spacing,
                        color: AppColors.whetInk,
                        height: 1.4,
                      ),
                      duration: const Duration(milliseconds: 1200),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              IgnorePointer(
                ignoring: !widget.showInput,
                child: AnimatedOpacity(
                  opacity: widget.showInput ? 1 : 0,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOut,
                  child: AnimatedSlide(
                    offset: widget.showInput ? Offset.zero : const Offset(0, 0.05),
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOutCubic,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'This name appears on your map.',
                          style: TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 12,
                            color: AppColors.darkWalnut,
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: 20),
                        TextField(
                          controller: widget.controller,
                          focusNode: _focusNode,
                          autofocus: true,
                          style: const TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 16,
                            color: AppColors.whetInk,
                          ),
                          decoration: const InputDecoration(
                            hintText: 'e.g. CPA Exam, Home Renovation',
                            hintStyle: TextStyle(
                              fontFamily: 'Georgia',
                              color: AppColors.ashGrey,
                              fontStyle: FontStyle.italic,
                            ),
                            enabledBorder: UnderlineInputBorder(
                              borderSide: BorderSide(color: AppColors.whetLine),
                            ),
                            focusedBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: AppColors.whetLine),
                            ),
                          ),
                          onSubmitted: (_) => widget.onContinue(),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'This is your primary objective.',
                          style: TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 12,
                            color: AppColors.darkWalnut,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _WizardNavRow(
                          onBack: widget.onBack,
                          onReturnToMap: widget.onReturnToMap,
                          returnLabel: widget.returnLabel,
                          onContinue: () {
                            if (_focusNode.hasFocus) _focusNode.unfocus();
                            widget.onContinue();
                          },
                          continueEnabled: widget.controller.text.trim().isNotEmpty,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Step 2: The Appearance ────────────────────────────────────

const _appearanceStyles = [
  'dark_walnut',
  'navy',
  'slate',
  'charcoal',
  'burgundy',
  'forest',
];

/// Theme map: appearance_style value → hex color for chip swatch.
const _appearanceColors = <String, int>{
  'dark_walnut': 0xFF3E2723,
  'navy': 0xFF1A237E,
  'slate': 0xFF263238,
  'charcoal': 0xFF212121,
  'burgundy': 0xFF310000,
  'forest': 0xFF1B5E20,
};

class _Step2Appearance extends StatelessWidget {
  const _Step2Appearance({
    required this.period,
    required this.appearanceStyle,
    required this.eliasLine,
    required this.onContinue,
    required this.onReturnToMap,
    this.returnLabel = 'Stow the Map',
    required this.onSelectStyle,
    this.onBack,
    this.showInput = true,
  });

  final ScenePeriod period;
  final String appearanceStyle;
  final String eliasLine;
  final VoidCallback onContinue;
  final VoidCallback onReturnToMap;
  final String returnLabel;
  final void Function(String) onSelectStyle;
  final VoidCallback? onBack;
  final bool showInput;

  String _labelFor(String style) {
    return style.replaceAll('_', ' ').split(' ').map((s) => s.isEmpty ? '' : '${s[0].toUpperCase()}${s.substring(1)}').join(' ');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(0, 20),
            child: EliasWidget(
              period: period,
              width: 100,
              height: 120,
              showGreeting: false,
              assetPathOverride: _ClimbFlowOverlayState._eliasHeadAsset,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1.5),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (context, spacing, _) => _EliasLineWithFade(
                  line: eliasLine,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    child: TypewriterText(
                      key: ValueKey(eliasLine),
                      text: eliasLine,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        letterSpacing: spacing,
                        color: AppColors.whetInk,
                        height: 1.4,
                      ),
                      duration: const Duration(milliseconds: 1200),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              IgnorePointer(
                ignoring: !showInput,
                child: AnimatedOpacity(
                  opacity: showInput ? 1 : 0,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOut,
                  child: AnimatedSlide(
                    offset: showInput ? Offset.zero : const Offset(0, 0.05),
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOutCubic,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: _appearanceStyles.map((style) {
                            final isSelected = appearanceStyle == style;
                            final swatchColor = Color(_appearanceColors[style] ?? 0xFF263238);
                            return Material(
                              color: isSelected
                                  ? AppColors.ember.withValues(alpha: 0.15)
                                  : AppColors.slotFilled,
                              borderRadius: BorderRadius.circular(8),
                              child: InkWell(
                                onTap: () => onSelectStyle(style),
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: isSelected ? AppColors.ember : AppColors.slotBorder,
                                      width: isSelected ? 2 : 1,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 16,
                                        height: 16,
                                        decoration: BoxDecoration(
                                          color: swatchColor,
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(
                                            color: AppColors.slotBorder,
                                            width: 1,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _labelFor(style),
                                        style: TextStyle(
                                          fontFamily: 'Georgia',
                                          fontSize: 14,
                                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                          color: isSelected ? AppColors.ember : AppColors.parchment,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 24),
                        _WizardNavRow(
                          onBack: onBack,
                          onReturnToMap: onReturnToMap,
                          returnLabel: returnLabel,
                          onContinue: onContinue,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Step 3: The Logic ─────────────────────────────────────────

class _Step3Logic extends StatelessWidget {
  const _Step3Logic({
    required this.period,
    required this.layoutType,
    required this.eliasLine,
    required this.onContinue,
    required this.onReturnToMap,
    this.returnLabel = 'Stow the Map',
    required this.onSelectLayout,
    this.onBack,
    this.showInput = true,
  });

  final ScenePeriod period;
  final String layoutType;
  final String eliasLine;
  final VoidCallback onContinue;
  final VoidCallback onReturnToMap;
  final String returnLabel;
  final void Function(String) onSelectLayout;
  final VoidCallback? onBack;
  final bool showInput;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(0, 20),
            child: EliasWidget(
              period: period,
              width: 100,
              height: 120,
              showGreeting: false,
              assetPathOverride: _ClimbFlowOverlayState._eliasHeadAsset,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1.5),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (context, spacing, _) => _EliasLineWithFade(
                  line: eliasLine,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    child: TypewriterText(
                      key: ValueKey(eliasLine),
                      text: eliasLine,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        letterSpacing: spacing,
                        color: AppColors.whetInk,
                        height: 1.4,
                      ),
                      duration: const Duration(milliseconds: 1200),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              IgnorePointer(
                ignoring: !showInput,
                child: AnimatedOpacity(
                  opacity: showInput ? 1 : 0,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOut,
                  child: AnimatedSlide(
                    offset: showInput ? Offset.zero : const Offset(0, 0.05),
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOutCubic,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Climb = one step at a time; Survey = see all branches.',
                          style: TextStyle(
                            fontFamily: 'Georgia',
                            fontSize: 12,
                            color: AppColors.darkWalnut,
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _LogicOption(
                          title: 'The Climb',
                          subtitle: 'Step-by-step. One milestone after another.',
                          isSelected: layoutType == 'climb',
                          onTap: () => onSelectLayout('climb'),
                        ),
                        const SizedBox(height: 12),
                        _LogicOption(
                          title: 'The Survey',
                          subtitle: 'Collection of areas. Regions to explore.',
                          isSelected: layoutType == 'survey',
                          onTap: () => onSelectLayout('survey'),
                        ),
                        const SizedBox(height: 24),
                        _WizardNavRow(
                          onBack: onBack,
                          onReturnToMap: onReturnToMap,
                          returnLabel: returnLabel,
                          onContinue: onContinue,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LogicOption extends StatelessWidget {
  const _LogicOption({
    required this.title,
    required this.subtitle,
    required this.isSelected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected
          ? AppColors.ember.withValues(alpha: 0.15)
          : AppColors.slotFilled,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? AppColors.ember : AppColors.slotBorder,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? AppColors.ember : AppColors.parchment,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 12,
                  color: AppColors.darkWalnut,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Step 4: The Markers (1–10) ─────────────────────────────────

class _Step4Markers extends StatefulWidget {
  const _Step4Markers({
    required this.period,
    required this.controllers,
    required this.focusNodes,
    required this.eliasLine,
    required this.markerLabel,
    required this.onContinue,
    required this.onReturnToMap,
    this.returnLabel = 'Stow the Map',
    required this.onAddLandmark,
    required this.onRemoveLandmark,
    required this.onApplyTemplate,
    required this.canAdd,
    required this.canRemove,
    this.onBack,
    this.showInput = true,
  });

  final ScenePeriod period;
  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;
  final String eliasLine;
  final String markerLabel;
  final VoidCallback onContinue;
  final VoidCallback onReturnToMap;
  final String returnLabel;
  final VoidCallback onAddLandmark;
  final VoidCallback onRemoveLandmark;
  final void Function(int templateIndex) onApplyTemplate;
  final bool canAdd;
  final bool canRemove;
  final VoidCallback? onBack;
  final bool showInput;

  @override
  State<_Step4Markers> createState() => _Step4MarkersState();
}

class _Step4MarkersState extends State<_Step4Markers> {
  @override
  void initState() {
    super.initState();
    for (final n in widget.focusNodes) {
      n.addListener(() => setState(() {}));
    }
  }

  @override
  void didUpdateWidget(_Step4Markers oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.focusNodes.length > oldWidget.focusNodes.length) {
      for (var i = oldWidget.focusNodes.length; i < widget.focusNodes.length; i++) {
        widget.focusNodes[i].addListener(() => setState(() {}));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.controllers.length;
    final anyFocused = widget.focusNodes.any((n) => n.hasFocus);
    final allNonEmpty = widget.controllers.every((c) => c.text.trim().isNotEmpty);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(0, 20),
            child: EliasWidget(
              period: widget.period,
              width: 100,
              height: 120,
              showGreeting: false,
              assetPathOverride: _ClimbFlowOverlayState._eliasHeadAsset,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1.5),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (context, spacing, _) => _EliasLineWithFade(
                  line: widget.eliasLine,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    child: TypewriterText(
                      key: ValueKey(widget.eliasLine),
                      text: widget.eliasLine,
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        letterSpacing: spacing,
                        color: AppColors.whetInk,
                        height: 1.4,
                      ),
                      duration: const Duration(milliseconds: 1200),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              IgnorePointer(
                ignoring: !widget.showInput,
                child: AnimatedOpacity(
                  opacity: widget.showInput ? 1 : 0,
                  duration: const Duration(milliseconds: 400),
                  curve: Curves.easeOut,
                  child: AnimatedSlide(
                    offset: widget.showInput ? Offset.zero : const Offset(0, 0.05),
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOutCubic,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
              Text(
                'Phases are the major stages of your journey—e.g. Research, Plan, Execute. Define one to ten. Each name must be unique.',
                style: const TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 12,
                  color: AppColors.darkWalnut,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: List.generate(2, (i) => Semantics(
                  label: 'Template ${i + 1}',
                  child: TextButton(
                    onPressed: () => widget.onApplyTemplate(i),
                    child: Text(
                      'Use template ${i + 1}',
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 12,
                        color: AppColors.ember,
                      ),
                    ),
                  ),
                )),
              ),
              const SizedBox(height: 16),
              LayoutBuilder(
                builder: (context, constraints) {
                  final useGrid = constraints.maxWidth > 400 && count > 2;
                  return useGrid
                      ? GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 3,
                          children: List.generate(
                            count,
                            (i) => _LandmarkField(
                              controller: widget.controllers[i],
                              focusNode: i < widget.focusNodes.length ? widget.focusNodes[i] : null,
                              label: '${widget.markerLabel} ${i + 1}',
                              onSubmitted: (_) => widget.onContinue(),
                            ),
                          ),
                        )
                      : Column(
                          children: List.generate(
                            count,
                            (i) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _LandmarkField(
                                controller: widget.controllers[i],
                                focusNode: i < widget.focusNodes.length ? widget.focusNodes[i] : null,
                                label: '${widget.markerLabel} ${i + 1}',
                                onSubmitted: (_) => widget.onContinue(),
                              ),
                            ),
                          ),
                        );
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (widget.canRemove)
                    TextButton.icon(
                      onPressed: widget.onRemoveLandmark,
                      icon: const Icon(Icons.remove_circle_outline, size: 18, color: AppColors.darkWalnut),
                      label: const Text(
                        'Remove',
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.darkWalnut,
                        ),
                      ),
                    ),
                  if (widget.canAdd) ...[
                    if (widget.canRemove) const SizedBox(width: 8),
                    TextButton.icon(
                      onPressed: widget.onAddLandmark,
                      icon: const Icon(Icons.add_circle_outline, size: 18, color: AppColors.ember),
                      label: Text(
                        'Add ${widget.markerLabel}',
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.ember,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 40),
              Divider(color: AppColors.whetLine, height: 1, thickness: 1),
              const SizedBox(height: 16),
              _WizardNavRow(
                onBack: widget.onBack,
                onReturnToMap: widget.onReturnToMap,
                returnLabel: widget.returnLabel,
                onContinue: () {
                  if (anyFocused) FocusScope.of(context).unfocus();
                  widget.onContinue();
                },
                continueEnabled: allNonEmpty,
              ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LandmarkField extends StatelessWidget {
  const _LandmarkField({
    required this.controller,
    required this.label,
    required this.onSubmitted,
    this.focusNode,
  });

  final TextEditingController controller;
  final String label;
  final void Function(String) onSubmitted;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      focusNode: focusNode,
      style: const TextStyle(
        fontFamily: 'Georgia',
        fontSize: 14,
        color: AppColors.whetInk,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(
          fontFamily: 'Georgia',
          color: AppColors.ashGrey,
          fontSize: 12,
          fontStyle: FontStyle.italic,
        ),
        enabledBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.whetLine),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AppColors.whetLine),
        ),
      ),
      onSubmitted: onSubmitted,
    );
  }
}

// ── Mallet strike overlay ───────────────────────────────────

class _MalletStrikeOverlay extends StatefulWidget {
  const _MalletStrikeOverlay();

  @override
  State<_MalletStrikeOverlay> createState() => _MalletStrikeOverlayState();
}

class _MalletStrikeOverlayState extends State<_MalletStrikeOverlay>
    with SingleTickerProviderStateMixin {
  static const double _deg = 3.14159265359 / 180;

  late final AnimationController _controller;
  late final Animation<double> _rotation;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _rotation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: -15 * _deg)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 1,
      ),
      TweenSequenceItem(
        tween: Tween(begin: -15 * _deg, end: 10 * _deg)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 1,
      ),
    ]).animate(_controller);
    _opacity = TweenSequence<double>([
      TweenSequenceItem(tween: ConstantTween<double>(1.0), weight: 2),
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 0.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 1,
      ),
    ]).animate(_controller);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: _opacity.value,
          child: Transform.rotate(
            angle: _rotation.value,
            child: Image.asset(
              'assets/mallet/mallet.png',
              width: 48,
              height: 48,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => Icon(
                Icons.handyman,
                size: 48,
                color: AppColors.ember,
              ),
            ),
          ),
        );
      },
    );
  }
}

// ── Step 5: Placing the stones (Pebbles) ──────────────────────

class _Step5Pebbles extends ConsumerStatefulWidget {
  const _Step5Pebbles({
    required this.period,
    required this.state,
    required this.markerLabel,
    required this.eliasLine,
    required this.onStoneTap,
    required this.onCreatePebble,
    required this.onCancelNaming,
    required this.onDoneWithLandmark,
    required this.onNextStone,
    required this.onClose,
    this.returnLabel = 'Stow the Map',
    required this.onAscension,
    this.onBack,
  });

  final ScenePeriod period;
  final ClimbFlowState state;
  final String markerLabel;
  final String eliasLine;
  final void Function(int stoneIndex) onStoneTap;
  final Future<void> Function(int stoneIndex, String title, {bool moveToNext}) onCreatePebble;
  final VoidCallback onCancelNaming;
  final VoidCallback onDoneWithLandmark;
  final VoidCallback onNextStone;
  final VoidCallback onClose;
  final String returnLabel;
  final VoidCallback onAscension;
  final VoidCallback? onBack;

  @override
  ConsumerState<_Step5Pebbles> createState() => _Step5PebblesState();
}

class _Step5PebblesState extends ConsumerState<_Step5Pebbles> {
  final TextEditingController _nameController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _nameController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final idx = state.pebbleStepBoulderIndex;
    final boulderCount = state.boulderIds.length;
    final allDone = boulderCount == 0 || idx >= boulderCount;
    final namingIndex = state.namingStoneIndex;
    final satchel = ref.watch(satchelProvider);
    final activePebbles = ref.watch(packCandidatesProvider).valueOrNull ?? [];
    final hasPackedOrOverflow =
        satchel.slots.any((s) => s.readyToBurn) || activePebbles.isNotEmpty;
    final showAscension = hasPackedOrOverflow;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(0, 20),
            child: EliasWidget(
              period: widget.period,
              width: 100,
              height: 120,
              showGreeting: false,
              assetPathOverride: _ClimbFlowOverlayState._eliasHeadAsset,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine),
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: namingIndex != null
                ? _NamePebbleCard(
                    key: const ValueKey('name'),
                    stoneLabel: state.landmarkNames.length > namingIndex
                        ? state.landmarkNames[namingIndex]
                        : '${widget.markerLabel} ${namingIndex + 1}',
                    controller: _nameController,
                    focusNode: _focusNode,
                    onPlantPebble: () async {
                      await widget.onCreatePebble(
                        namingIndex,
                        _nameController.text.trim(),
                        moveToNext: false,
                      );
                      if (mounted) {
                        _nameController.clear();
                        _focusNode.requestFocus();
                      }
                    },
                    onPlantAndNextArea: () async {
                      await widget.onCreatePebble(
                        namingIndex,
                        _nameController.text.trim(),
                        moveToNext: true,
                      );
                      if (mounted) {
                        _nameController.clear();
                        _focusNode.requestFocus();
                      }
                    },
                    onCancel: widget.onCancelNaming,
                  )
                : _LandmarkChipsCard(
                    key: const ValueKey('chips'),
                    state: state,
                    boulderCount: boulderCount,
                    markerLabel: widget.markerLabel,
                    allDone: allDone,
                    eliasLine: widget.eliasLine,
                    onStoneTap: widget.onStoneTap,
                    onDoneWithLandmark: widget.onDoneWithLandmark,
                    onNextStone: widget.onNextStone,
                    onClose: widget.onClose,
                    returnLabel: widget.returnLabel,
                    showAscension: showAscension,
                    onAscension: widget.onAscension,
                    overflowCount: activePebbles.length,
                    onBack: widget.onBack,
                  ),
          ),
        ),
      ],
    );
  }
}

class _LandmarkChipsCard extends StatelessWidget {
  const _LandmarkChipsCard({
    super.key,
    required this.state,
    required this.boulderCount,
    required this.markerLabel,
    required this.allDone,
    required this.eliasLine,
    required this.onStoneTap,
    required this.onDoneWithLandmark,
    required this.onNextStone,
    required this.onClose,
    this.returnLabel = 'Stow the Map',
    required this.showAscension,
    required this.onAscension,
    required this.overflowCount,
    this.onBack,
  });

  final ClimbFlowState state;
  final int boulderCount;
  final String markerLabel;
  final bool allDone;
  final String eliasLine;
  final void Function(int) onStoneTap;
  final VoidCallback onDoneWithLandmark;
  final VoidCallback onNextStone;
  final VoidCallback onClose;
  final String returnLabel;
  final bool showAscension;
  final VoidCallback onAscension;
  final int overflowCount;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final idx = state.pebbleStepBoulderIndex;
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween<double>(begin: 0, end: 1.5),
          duration: const Duration(milliseconds: 800),
          curve: Curves.easeOutCubic,
          builder: (context, spacing, _) {
            final line = allDone ? EliasDialogue.climbAllDone() : eliasLine;
            return _EliasLineWithFade(
              line: line,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                child: TypewriterText(
                  key: ValueKey(line),
                  text: line,
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 16,
                    letterSpacing: spacing,
                    color: AppColors.whetInk,
                    height: 1.4,
                  ),
                  duration: const Duration(milliseconds: 1200),
                ),
              ),
            );
          },
        ),
        if (overflowCount > 0) ...[
          const SizedBox(height: 12),
          Text(
            '$overflowCount pebble${overflowCount == 1 ? '' : 's'} waiting in overflow.',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 12,
              color: AppColors.darkWalnut,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
        if (!allDone) ...[
          const SizedBox(height: 8),
          Text(
            'Tap a marker to add pebbles. Each pebble is a task you can pack into your satchel.',
            style: const TextStyle(
              fontFamily: 'Georgia',
              fontSize: 12,
              color: AppColors.darkWalnut,
            ),
          ),
        ],
        const SizedBox(height: 24),
        if (!allDone)
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: List.generate(
              boulderCount,
              (i) => _StoneChip(
                label: state.landmarkNames.length > i
                    ? state.landmarkNames[i]
                    : '$markerLabel ${i + 1}',
                isCurrent: idx == i,
                onTap: () => onStoneTap(i),
              ),
            ),
          ),
        if (!allDone) const SizedBox(height: 24),
        if (showAscension) ...[
          Semantics(
            label: 'Stow the Map',
            button: true,
            child: FilledButton(
              onPressed: onAscension,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.ember,
                foregroundColor: AppColors.parchment,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 120),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.local_fire_department, size: 18),
                    const SizedBox(width: 8),
                    Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: const Text(
                          'Stow the Map',
                          softWrap: false,
                          overflow: TextOverflow.visible,
                          style: TextStyle(fontFamily: 'Georgia'),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          mainAxisSize: MainAxisSize.max,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (onBack != null) ...[
              TextButton.icon(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back, size: 18, color: AppColors.darkWalnut),
                label: const Text(
                  'Back',
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    color: AppColors.darkWalnut,
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Semantics(
                label: 'climb_nav_return',
                button: true,
                child: TextButton(
                  onPressed: onClose,
                  style: TextButton.styleFrom(
                    minimumSize: Size.zero,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minWidth: 120),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.center,
                      child: Text(
                        returnLabel,
                        textAlign: TextAlign.center,
                        softWrap: false,
                        overflow: TextOverflow.visible,
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.darkWalnut,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (allDone)
              Expanded(
                child: _PackJourneyButton(
                  onPressed: onClose,
                ),
              )
            else
              Expanded(
                child: Semantics(
                  label: idx >= boulderCount - 1
                      ? 'Finish and show Pack button'
                      : 'Next $markerLabel',
                  button: true,
                  child: FilledButton(
                    onPressed: onDoneWithLandmark,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.ember,
                      foregroundColor: AppColors.parchment,
                    ),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        idx >= boulderCount - 1
                            ? 'Finish'
                            : 'Next $markerLabel',
                        softWrap: false,
                        style: const TextStyle(fontFamily: 'Georgia'),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Pack this Journey button with centered text and subtle pulse when peak is set.
class _PackJourneyButton extends StatefulWidget {
  const _PackJourneyButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  State<_PackJourneyButton> createState() => _PackJourneyButtonState();
}

class _PackJourneyButtonState extends State<_PackJourneyButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _pulse = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 1.06)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 1,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.06, end: 1.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 1,
      ),
    ]).animate(_controller);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'climb_nav_pack',
      button: true,
      child: AnimatedBuilder(
        animation: _pulse,
        builder: (context, child) {
          return Transform.scale(
            scale: _pulse.value,
            child: child,
          );
        },
        child: FilledButton(
          onPressed: widget.onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.ember,
            foregroundColor: AppColors.parchment,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              'Pack this Journey',
              textAlign: TextAlign.center,
              softWrap: false,
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontWeight: FontWeight.w500,
                letterSpacing: -0.3,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NamePebbleCard extends StatelessWidget {
  const _NamePebbleCard({
    super.key,
    required this.stoneLabel,
    required this.controller,
    required this.focusNode,
    required this.onPlantPebble,
    required this.onPlantAndNextArea,
    required this.onCancel,
  });

  final String stoneLabel;
  final TextEditingController controller;
  final FocusNode focusNode;
  final Future<void> Function() onPlantPebble;
  final Future<void> Function() onPlantAndNextArea;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Name this pebble',
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 16,
            color: AppColors.whetInk,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          stoneLabel,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 14,
            color: AppColors.darkWalnut,
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
          decoration: const InputDecoration(
            hintText: 'e.g. Research vendors',
            hintStyle: TextStyle(color: AppColors.darkWalnut),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.whetLine),
            ),
            focusedBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: AppColors.whetLine),
            ),
          ),
          onSubmitted: (_) => onPlantPebble(),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisSize: MainAxisSize.max,
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: onCancel,
              child: const Text(
                'Cancel',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  color: AppColors.darkWalnut,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Flexible(
              flex: 1,
              child: Semantics(
                label: 'climb_plant_pebble',
                button: true,
                child: FilledButton(
                  onPressed: () async => await onPlantPebble(),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.ember,
                    foregroundColor: AppColors.parchment,
                  ),
                  child: const Text(
                    'Set Pebble',
                    style: TextStyle(fontFamily: 'Georgia'),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              flex: 2,
              child: Semantics(
                label: 'climb_plant_and_next',
                hint: 'Set pebble and move to the next marker',
                button: true,
                child: TextButton(
                  onPressed: () async => await onPlantAndNextArea(),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: const Text(
                      'Set & Next',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        color: AppColors.ember,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StoneChip extends StatelessWidget {
  const _StoneChip({
    required this.label,
    required this.isCurrent,
    required this.onTap,
  });

  final String label;
  final bool isCurrent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isCurrent
          ? AppColors.ember.withValues(alpha: 0.2)
          : AppColors.slotFilled,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isCurrent ? AppColors.ember : AppColors.slotBorder,
              width: isCurrent ? 2 : 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 14,
              color: isCurrent ? AppColors.ember : AppColors.parchment,
            ),
          ),
        ),
      ),
    );
  }
}

