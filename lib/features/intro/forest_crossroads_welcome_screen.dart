import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app.dart';
import '../../core/constants/app_colors.dart';
import '../../core/content/elias_dialogue.dart';
import '../../providers/first_run_provider.dart';

/// Moody forest / crossroads arrival — **before** [EliasIntroOverlay] name flow.
/// Uses [EliasDialogue.introBeat1] only; Elias intro then starts at beat 2 (`postForest=1`).
class ForestCrossroadsWelcomeScreen extends ConsumerStatefulWidget {
  const ForestCrossroadsWelcomeScreen({super.key});

  static const String _eliasAsset = 'assets/elias/elias_intro_pathway.png';

  @override
  ConsumerState<ForestCrossroadsWelcomeScreen> createState() =>
      _ForestCrossroadsWelcomeScreenState();
}

class _ForestCrossroadsWelcomeScreenState
    extends ConsumerState<ForestCrossroadsWelcomeScreen> {
  bool _routing = true;
  int _visibleChars = 0;
  bool _typewriterDone = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeSkipOrStart());
  }

  Future<void> _maybeSkipOrStart() async {
    final seen = await ref.read(hasSeenForestCrossroadsWelcomeProvider.future);
    if (!mounted) return;
    if (seen) {
      context.go('${AppRoutes.intro}?postForest=1');
      return;
    }
    setState(() => _routing = false);
    await _runTypewriter();
  }

  Future<void> _runTypewriter() async {
    final text = EliasDialogue.introBeat1;
    for (var i = 0; i <= text.length && mounted; i++) {
      setState(() => _visibleChars = i);
      if (i >= text.length) break;
      final ch = text[i];
      final isFirstDotOfEllipsis =
          ch == '.' &&
          i + 2 < text.length &&
          text[i + 1] == '.' &&
          text[i + 2] == '.' &&
          (i == 0 || text[i - 1] != '.');
      final delayMs = isFirstDotOfEllipsis ? 300 : (ch == '.' ? 200 : 35);
      await Future<void>.delayed(Duration(milliseconds: delayMs));
    }
    if (!mounted) return;
    setState(() => _typewriterDone = true);
  }

  Future<void> _onContinue() async {
    if (!_typewriterDone) {
      setState(() {
        _visibleChars = EliasDialogue.introBeat1.length;
        _typewriterDone = true;
      });
      return;
    }
    HapticFeedback.lightImpact();
    await markForestCrossroadsWelcomeSeen();
    ref.invalidate(hasSeenForestCrossroadsWelcomeProvider);
    if (!mounted) return;
    context.go('${AppRoutes.intro}?postForest=1');
  }

  @override
  Widget build(BuildContext context) {
    if (_routing) {
      return const Scaffold(
        backgroundColor: Color(0xFF1B2412),
        body: Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              color: Color(0xFFB8621A),
              strokeWidth: 2.5,
            ),
          ),
        ),
      );
    }

    final text = EliasDialogue.introBeat1;
    final visible = text.substring(0, _visibleChars.clamp(0, text.length));

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF1B2412),
        body: GestureDetector(
          onTap: _onContinue,
          behavior: HitTestBehavior.opaque,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Moody base (not time-of-day Sanctuary backgrounds)
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0xFF0A1208),
                      Color(0xFF1B2412),
                      Color(0xFF243520),
                      Color(0xFF1B2412),
                    ],
                  ),
                ),
              ),
              // Moody crossroads: gradient + vignette only (no time-of-day Sanctuary BG).
              // Add `assets/backgrounds/forest_threshold.png` to pubspec when the asset exists.
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.55),
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.75),
                    ],
                  ),
                ),
              ),
              SafeArea(
                child: Column(
                  children: [
                    const SizedBox(height: 24),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Text(
                        visible,
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 18,
                          height: 1.6,
                          letterSpacing: 0.4,
                          color: Color(0xFFE8E0D4),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      height: MediaQuery.sizeOf(context).height * 0.42,
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: Image.asset(
                          ForestCrossroadsWelcomeScreen._eliasAsset,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.person,
                            size: 120,
                            color: AppColors.ashGrey,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                      child: _ParchmentContinueChip(
                        label: _typewriterDone ? 'Continue' : 'Skip',
                        onPressed: _onContinue,
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
}

/// Matches wizard / Elias parchment tone: warm paper strip + ember accent.
class _ParchmentContinueChip extends StatelessWidget {
  const _ParchmentContinueChip({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.whetPaper.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.whetLine, width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Georgia',
                fontSize: 15,
                letterSpacing: 1.2,
                color: AppColors.whetInk,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
