import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../core/enums/day_period.dart';
import '../../data/models/profile.dart';
import '../../providers/first_run_provider.dart';
import '../../providers/profile_provider.dart';
import '../../providers/repository_providers.dart';
import '../../providers/time_of_day_provider.dart';
import '../../widgets/elias_silhouette.dart';
import '../../widgets/sanctuary_background.dart';
import '../../widgets/voyager_surface.dart';
import '../scroll_map/climb_flow_overlay.dart';
import 'whetstone_intro_setup_sheet.dart';

/// First-time intro: 7 steps (Beats 1–2 → name prompt → name confirmation → Beats 3–5)
/// → New Journey Wizard → closing line → Whetstone setup.
/// When [skipIntroBeats] is true, skips the intro beats and goes straight to the wizard.
class EliasIntroOverlay extends ConsumerStatefulWidget {
  const EliasIntroOverlay({
    super.key,
    this.skipIntroBeats = false,
    this.skipIntroBeat1 = false,
  });

  /// When true, skip the Elias intro beats and open the wizard immediately.
  final bool skipIntroBeats;

  /// When true, start at intro beat 2 (beat 1 was shown on [ForestCrossroadsWelcomeScreen]).
  final bool skipIntroBeat1;

  @override
  ConsumerState<EliasIntroOverlay> createState() => _EliasIntroOverlayState();
}

class _EliasIntroOverlayState extends ConsumerState<EliasIntroOverlay> {
  /// 0=beat1, 1=beat2, 2=namePrompt, 3=nameConfirmation, 4=beat3, 5=beat4, 6=beat5
  int _step = 0;
  int _visibleLength = 0;
  bool _typewriterComplete = false;
  bool _typewriterSkipped =
      false; // true when user tapped to skip; stops _runTypewriter loop
  Timer? _typewriterTimer;

  /// Set from profile.displayName when present, or from name prompt (user input or default "traveler").
  String? _travelerName;
  final TextEditingController _nameController = TextEditingController();
  final FocusNode _nameFocus = FocusNode();

  /// When true, show the name TextField and Continue on the name-prompt step (staggered after dialogue).
  bool _showNameInput = false;
  Timer? _nameInputTimer;

  static const int _namePromptStep = 2;
  static const int _nameConfirmationStep = 3;
  static const int _lastStep = 7;

  /// Optional pose assets for intro steps; fallback to period pose if missing.
  static const String _eliasWelcoming = 'assets/elias/elias_welcoming.png';
  static const String _eliasExplainingGesture =
      'assets/elias/elias_explaining_gesture.png';
  static const String _eliasGuidePose = 'assets/elias/elias_guide_pose.png';
  static const String _eliasHeadMouthOpen =
      'assets/elias/EliasFloatingMouthOpen.png';

  String? _introEliasAssetOverrideForStep(int step) {
    switch (step) {
      case 1:
      case 2:
        return _eliasWelcoming;
      case 3:
        return _eliasExplainingGesture;
      case 5:
        return _eliasGuidePose;
      case 6:
        return _eliasWelcoming;
      case 7:
        return _eliasHeadMouthOpen; // Bridge to map: speaking head
      default:
        return null;
    }
  }

  (double width, double height) _introEliasSizeForStep(int step) {
    if (step == 6) {
      return (
        140,
        196,
      ); // Beat 5: optionally larger (anchor rule: keep feet stable)
    }
    if (step == 7) return (100, 120); // Bridge: head/bust only
    return (100, 140);
  }

  String get _currentText {
    switch (_step) {
      case 0:
        return EliasDialogue.introBeat1;
      case 1:
        return EliasDialogue.introBeat2;
      case _namePromptStep:
        return '';
      case _nameConfirmationStep:
        return _travelerName != null
            ? EliasDialogue.introNameConfirmation(_travelerName!)
            : '';
      case 4:
        return _travelerName != null
            ? EliasDialogue.introBeat3WithName(_travelerName!)
            : EliasDialogue.introBeat3;
      case 5:
        return EliasDialogue.introBeat4;
      case 6:
        return _travelerName != null
            ? EliasDialogue.introBeat5WithName(_travelerName!)
            : EliasDialogue.introBeat5;
      case 7:
        return EliasDialogue.introBridgeToMap;
      default:
        return '';
    }
  }

  @override
  void initState() {
    super.initState();
    _nameFocus.addListener(() => setState(() {}));
    if (widget.skipIntroBeats) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openWizard();
      });
    } else if (widget.skipIntroBeat1) {
      _step = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _runTypewriter();
      });
    } else {
      _runTypewriter();
    }
  }

  @override
  void dispose() {
    _typewriterTimer?.cancel();
    _nameInputTimer?.cancel();
    _nameFocus.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _runTypewriter() async {
    _typewriterTimer?.cancel();
    _typewriterComplete = false;
    _typewriterSkipped = false;
    setState(() => _visibleLength = 0);

    final text = _currentText;
    if (text.isEmpty) return;

    for (var i = 0; i <= text.length && mounted; i++) {
      if (!mounted || _typewriterSkipped) return;
      setState(() {
        _visibleLength = i;
        if (i >= text.length) _typewriterComplete = true;
      });
      final char = i < text.length ? text[i] : '';
      // Pause ~300ms at ellipses for conversational beat (spec §9)
      final isFirstDotOfEllipsis =
          char == '.' &&
          i + 2 < text.length &&
          text[i + 1] == '.' &&
          text[i + 2] == '.' &&
          (i == 0 || text[i - 1] != '.');
      final delay = isFirstDotOfEllipsis ? 300 : (char == '.' ? 200 : 30);
      await Future<void>.delayed(Duration(milliseconds: delay));
    }
  }

  void _advance() {
    HapticFeedback.lightImpact();

    // Name prompt step: no typewriter; advance on Continue with name
    if (_step == _namePromptStep) {
      final raw = _nameController.text.trim();
      final name = raw.isEmpty ? EliasDialogue.defaultTravelerName : raw;
      setState(() {
        _travelerName = name;
        _showNameInput = false;
        _step = _nameConfirmationStep;
      });
      _runTypewriter();
      return;
    }

    if (!_typewriterComplete) {
      _typewriterSkipped = true;
      setState(() {
        _visibleLength = _currentText.length;
        _typewriterComplete = true;
      });
      _typewriterTimer?.cancel();
      return;
    }

    // Name confirmation: save to profile then continue to Beat 3
    if (_step == _nameConfirmationStep) {
      _saveNameAndContinue();
      return;
    }

    if (_step < _lastStep) {
      setState(() {
        _step++;
        if (_step != _namePromptStep) _showNameInput = false;
      });
      if (_step == _namePromptStep) {
        // Next step is name prompt; show dialogue first, then input after a short delay
        setState(() => _typewriterComplete = true);
        _nameInputTimer?.cancel();
        _nameInputTimer = Timer(const Duration(milliseconds: 1200), () {
          if (mounted && _step == _namePromptStep) {
            setState(() => _showNameInput = true);
          }
        });
      } else {
        _runTypewriter();
      }
    } else {
      // Step 7 = bridge; tap opens wizard
      _openWizard();
    }
  }

  Future<void> _saveNameAndContinue() async {
    if (_travelerName == null) return;
    final repo = ref.read(profileRepositoryProvider);
    await repo.updateDisplayName(_travelerName!);
    if (!mounted) return;
    setState(() => _step = 4);
    ref.invalidate(profileProvider);
    if (!mounted) return;
    _runTypewriter();
  }

  void _openWizard() {
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black54,
      pageBuilder: (dialogContext, __, ___) => PopScope(
        canPop: false,
        child: ClimbFlowOverlay(
          onClose: () => Navigator.of(dialogContext).pop(),
          onComplete: _onWizardComplete,
          onAscension: () {
            Navigator.of(dialogContext).pop();
            _showStowTheMapClosingThenContinue();
          },
          returnLabel: 'Stow the Map',
          persistDraftOnClose: false,
        ),
      ),
    );
  }

  void _onWizardComplete() {
    _showClosingLineThenWhetstone();
  }

  /// Map Bridge: show "The path is set..." immediately after user taps "Stow the Map",
  /// then continue to post-first-mountain and Whetstone. Gives the line screen time before transition.
  void _showStowTheMapClosingThenContinue() {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _EliasParchmentDialog(
        message: EliasDialogue.stowTheMapClosing,
        onContinue: () async {
          Navigator.of(ctx).pop();
          _showClosingLineThenWhetstone();
        },
      ),
    );
  }

  void _showClosingLineThenWhetstone() {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _EliasParchmentDialog(
        message: EliasDialogue.introPostFirstMountain,
        onContinue: () async {
          Navigator.of(ctx).pop();
          _openWhetstoneSetup(context);
        },
      ),
    );
  }

  void _openWhetstoneSetup(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => WhetstoneIntroSetupSheet(
        onComplete: () {
          if (mounted) Navigator.of(context).pop();
          _onWhetstoneComplete();
        },
      ),
    );
  }

  Future<void> _onWhetstoneComplete() async {
    if (!mounted) return;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _EliasParchmentDialog(
        message: EliasDialogue.introPostWhetstone,
        onContinue: () async {
          Navigator.of(ctx).pop();
          final repo = ref.read(profileRepositoryProvider);
          await repo.setHasSeenEliasIntro();
          await markSanctuaryHomeIntroSeen();
          ref.invalidate(profileProvider);
          ref.invalidate(hasSeenSanctuaryHomeIntroProvider);
          if (!mounted) return;
          context.go(AppRoutes.sanctuary);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // When profile has display_name, use it for Beats 3 & 5 so Elias recognizes the user.
    ref.listen<AsyncValue<Profile?>>(profileProvider, (_, next) {
      if (_travelerName != null) return;
      next.whenData((profile) {
        final name = profile?.displayName?.trim();
        if (name != null && name.isNotEmpty && mounted) {
          setState(() => _travelerName = name);
        }
      });
    });
    // One-time init from already-loaded profile (e.g. returning user).
    if (_travelerName == null) {
      final name = ref.read(profileProvider).valueOrNull?.displayName?.trim();
      if (name != null && name.isNotEmpty) _travelerName = name;
    }

    if (widget.skipIntroBeats) {
      return PopScope(
        canPop: false,
        child: const ColoredBox(
          color: Color(0xFF0D2818),
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                color: Color(0xFFD8E2DC),
                strokeWidth: 2,
              ),
            ),
          ),
        ),
      );
    }

    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;

    return PopScope(
      canPop: false,
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        backgroundColor: Colors.transparent,
        body: GestureDetector(
          onTap: _step == _namePromptStep ? null : _advance,
          behavior: HitTestBehavior.opaque,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Layer 1: Sanctuary time-of-day background (RepaintBoundary avoids repaints during typewriter)
              RepaintBoundary(child: const SanctuaryBackground()),
              // Layer 2: Scrim — transparent at top so Elias stays bright, deep forest at bottom for text legibility
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      const Color(0xCC0D2818), // 80% opacity forest green
                    ],
                  ),
                ),
              ),
              // Layer 3: Content — on name prompt, scrollable so field stays above keyboard and Elias remains visible
              SafeArea(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: _step == _namePromptStep
                            ? SingleChildScrollView(
                                padding: EdgeInsets.only(
                                  bottom:
                                      MediaQuery.viewInsetsOf(context).bottom +
                                      48,
                                ),
                                child: _buildNamePromptContent(period),
                              )
                            : _buildTypewriterContent(),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNamePromptContent(ScenePeriod period) {
    final (width, height) = _introEliasSizeForStep(_namePromptStep);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        EliasWidget(
          period: period,
          width: width,
          height: height,
          showGreeting: false,
          assetPathOverride: _introEliasAssetOverrideForStep(_namePromptStep),
        ),
        const SizedBox(height: 32),
        Text(
          EliasDialogue.introNamePrompt,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 18,
            color: Color(0xFFD8E2DC),
            height: 1.6,
            letterSpacing: 0.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        IgnorePointer(
          ignoring: !_showNameInput,
          child: AnimatedOpacity(
            opacity: _showNameInput ? 1 : 0,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOut,
            child: AnimatedSlide(
              offset: _showNameInput ? Offset.zero : const Offset(0, 0.05),
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOutCubic,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _nameController,
                    focusNode: _nameFocus,
                    style: const TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 18,
                      color: Color(0xFFD8E2DC),
                    ),
                    decoration: InputDecoration(
                      hintText: 'What shall I call you?',
                      hintStyle: const TextStyle(
                        fontFamily: 'Georgia',
                        color: AppColors.ashGrey,
                        fontStyle: FontStyle.italic,
                      ),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(
                          color: const Color(0xFFA4B494).withValues(alpha: 0.8),
                        ),
                      ),
                      focusedBorder: UnderlineInputBorder(
                        borderSide: BorderSide(
                          color: const Color(0xFFA4B494).withValues(alpha: 0.8),
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    textAlign: TextAlign.center,
                    textCapitalization: TextCapitalization.words,
                    onSubmitted: (_) => _advance(),
                  ),
                  const SizedBox(height: 32),
                  // Single Continue: dismiss keyboard if focused, then advance (empty uses default "traveler")
                  TextButton(
                    onPressed: () {
                      if (_nameFocus.hasFocus) _nameFocus.unfocus();
                      _advance();
                    },
                    child: const Text(
                      'Continue',
                      style: TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 14,
                        color: AppColors.ember,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                  SizedBox(
                    height: 24 + MediaQuery.paddingOf(context).bottom,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTypewriterContent() {
    final text = _currentText;
    final visible = text.substring(0, _visibleLength.clamp(0, text.length));
    final period =
        ref.watch(timeOfDayProvider).valueOrNull ?? ScenePeriod.night;
    final (width, height) = _introEliasSizeForStep(_step);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        EliasWidget(
          period: period,
          width: width,
          height: height,
          showGreeting: false,
          assetPathOverride: _introEliasAssetOverrideForStep(_step),
        ),
        const SizedBox(height: 32),
        Text(
          visible,
          style: const TextStyle(
            fontFamily: 'Georgia',
            fontSize: 18,
            color: Color(0xFFD8E2DC),
            height: 1.6,
            letterSpacing: 0.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        Text(
          _typewriterComplete ? 'Tap to continue' : '',
          style: TextStyle(
            fontFamily: 'Georgia',
            fontSize: 14,
            color: Colors.white.withValues(alpha: 0.6),
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }
}

/// Parchment-style Elias dialogue card for closing/final lines.
class _EliasParchmentDialog extends StatelessWidget {
  const _EliasParchmentDialog({
    required this.message,
    required this.onContinue,
  });

  final String message;
  final Future<void> Function() onContinue;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: VoyagerSurface.parchmentCard(),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              style: const TextStyle(
                fontFamily: 'Georgia',
                color: AppColors.whetInk,
                fontSize: 16,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () async => await onContinue(),
              child: const Text('Continue', style: TextStyle(letterSpacing: 1)),
            ),
          ],
        ),
      ),
    );
  }
}
