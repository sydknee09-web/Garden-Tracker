import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../data/repositories/whetstone_repository.dart';
import '../../providers/whetstone_provider.dart';

/// Intro Whetstone setup: add 1–3 habits, no skip. Min 1 required.
class WhetstoneIntroSetupSheet extends ConsumerStatefulWidget {
  const WhetstoneIntroSetupSheet({super.key, required this.onComplete});

  final VoidCallback onComplete;

  @override
  ConsumerState<WhetstoneIntroSetupSheet> createState() =>
      _WhetstoneIntroSetupSheetState();
}

/// Habits default to user input; starter habits are only applied when the user taps "Let Elias pick for me".
class _WhetstoneIntroSetupSheetState
    extends ConsumerState<WhetstoneIntroSetupSheet> {
  final List<TextEditingController> _controllers = [];
  final List<FocusNode> _focusNodes = [];
  static const int _minHabits = 1;
  static const int _maxHabits = 3;

  /// Stagger: show Elias + prompt first, then fade in inputs after 1.2s.
  bool _showInputArea = false;
  Timer? _staggerTimer;

  void _addFocusListener(FocusNode node) {
    node.addListener(() => setState(() {}));
  }

  @override
  void initState() {
    super.initState();
    _controllers.add(TextEditingController());
    final node = FocusNode();
    _addFocusListener(node);
    _focusNodes.add(node);
    _staggerTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _showInputArea = true);
    });
  }

  @override
  void dispose() {
    _staggerTimer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _addAnother() {
    if (_controllers.length >= _maxHabits) return;
    final node = FocusNode();
    _addFocusListener(node);
    setState(() {
      _controllers.add(TextEditingController());
      _focusNodes.add(node);
    });
  }

  void _removeAt(int index) {
    if (_controllers.length <= _minHabits) return;
    _controllers[index].dispose();
    _focusNodes[index].dispose();
    setState(() {
      _controllers.removeAt(index);
      _focusNodes.removeAt(index);
    });
  }

  /// Fills up to 3 slots with Elias's suggested starter habits. User can keep or edit.
  void _letEliasPick() {
    final starters = WhetstoneRepository.starterHabits;
    final count = starters.length.clamp(1, _maxHabits);
    while (_controllers.length < count) {
      final node = FocusNode();
      _addFocusListener(node);
      _controllers.add(TextEditingController());
      _focusNodes.add(node);
    }
    for (var i = 0; i < count; i++) {
      _controllers[i].text = starters[i];
    }
    setState(() {});
  }

  Future<void> _onContinue() async {
    final titles = _controllers
        .map((c) => c.text.trim())
        .where((t) => t.isNotEmpty)
        .toList();
    if (titles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            EliasDialogue.introWhetstoneInsist,
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
    final notifier = ref.read(whetstoneProvider.notifier);
    try {
      for (final title in titles) {
        await notifier.addItem(title);
      }
      if (!mounted) return;
      widget.onComplete();
    } catch (_) {
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

  bool get _hasAtLeastOneHabit =>
      _controllers.any((c) => c.text.trim().isNotEmpty);

  bool get _anyFieldFocused => _focusNodes.any((n) => n.hasFocus);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        24,
        24,
        24,
        MediaQuery.of(context).padding.bottom + 24,
      ),
      decoration: BoxDecoration(
        color: AppColors.whetPaper.withValues(alpha: 0.98),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        border: const Border(
          top: BorderSide(color: AppColors.whetLine),
          left: BorderSide(color: AppColors.whetLine),
          right: BorderSide(color: AppColors.whetLine),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            EliasDialogue.introWhetstonePrompt,
            style: const TextStyle(
              fontFamily: 'Georgia',
              color: AppColors.whetInk,
              fontSize: 16,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          IgnorePointer(
            ignoring: !_showInputArea,
            child: AnimatedOpacity(
              opacity: _showInputArea ? 1 : 0,
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOut,
              child: AnimatedSlide(
                offset: _showInputArea ? Offset.zero : const Offset(0, 0.05),
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeOutCubic,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextButton.icon(
                      onPressed: _letEliasPick,
                      icon: const Icon(
                        Icons.auto_awesome,
                        size: 18,
                        color: AppColors.ember,
                      ),
                      label: const Text(
                        'Let Elias pick for me',
                        style: TextStyle(
                          fontFamily: 'Georgia',
                          color: AppColors.ember,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...List.generate(_controllers.length, (i) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _controllers[i],
                                focusNode: _focusNodes[i],
                                decoration: InputDecoration(
                                  hintText: 'e.g. Morning meditation',
                                  hintStyle: const TextStyle(
                                    color: AppColors.ashGrey,
                                    fontFamily: 'Georgia',
                                    fontStyle: FontStyle.italic,
                                  ),
                                  filled: true,
                                  fillColor: AppColors.parchment.withValues(
                                    alpha: 0.5,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: const BorderSide(
                                      color: AppColors.whetLine,
                                    ),
                                  ),
                                  enabledBorder: const OutlineInputBorder(
                                    borderRadius: BorderRadius.all(
                                      Radius.circular(8),
                                    ),
                                    borderSide: BorderSide(
                                      color: AppColors.whetLine,
                                    ),
                                  ),
                                  focusedBorder: const OutlineInputBorder(
                                    borderRadius: BorderRadius.all(
                                      Radius.circular(8),
                                    ),
                                    borderSide: BorderSide(
                                      color: AppColors.ember,
                                      width: 1.5,
                                    ),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 12,
                                  ),
                                ),
                                style: const TextStyle(
                                  fontFamily: 'Georgia',
                                  color: AppColors.whetInk,
                                ),
                                onSubmitted: (_) {
                                  if (i == _controllers.length - 1 &&
                                      _controllers.length < _maxHabits) {
                                    _addAnother();
                                  } else {
                                    _onContinue();
                                  }
                                },
                              ),
                            ),
                            if (_controllers.length > _minHabits)
                              IconButton(
                                icon: const Icon(
                                  Icons.remove_circle_outline,
                                  color: AppColors.warmGrey,
                                ),
                                onPressed: () => _removeAt(i),
                              ),
                          ],
                        ),
                      );
                    }),
                    if (_controllers.length < _maxHabits)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: TextButton.icon(
                          onPressed: _addAnother,
                          icon: const Icon(
                            Icons.add,
                            size: 18,
                            color: AppColors.ember,
                          ),
                          label: const Text(
                            'Add another',
                            style: TextStyle(
                              fontFamily: 'Georgia',
                              color: AppColors.ember,
                            ),
                          ),
                        ),
                      ),
                    // Return = dismiss keyboard when any field focused; Continue = save when blurred and valid
                    Tooltip(
                      message: _anyFieldFocused
                          ? 'Dismiss keyboard'
                          : (_hasAtLeastOneHabit
                                ? 'Continue'
                                : 'Add at least one habit to sharpen your resolve.'),
                      child: FilledButton(
                        onPressed: _anyFieldFocused
                            ? () => FocusScope.of(context).unfocus()
                            : (_hasAtLeastOneHabit ? _onContinue : null),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: Text(
                          _anyFieldFocused ? 'Return' : 'Continue',
                          style: const TextStyle(
                            fontFamily: 'Georgia',
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
