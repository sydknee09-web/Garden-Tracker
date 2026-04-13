import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../personas/persona_definitions.dart';
import '../session_logger.dart';

/// Prefer key (full hit area) over semantics/text for Satchel to avoid off-screen tap.
/// Fallback chain ensures we find the target even during cold-start rebuilds.
Finder satchelFinder() {
  if (find.byKey(const ValueKey('satchel_tap_target')).evaluate().isNotEmpty) {
    return find.byKey(const ValueKey('satchel_tap_target'));
  }
  if (find.bySemanticsLabel('Satchel').evaluate().isNotEmpty) {
    return find.bySemanticsLabel('Satchel');
  }
  if (find.text('Satchel').evaluate().isNotEmpty) {
    return find.text('Satchel');
  }
  return find.byKey(const ValueKey('satchel_tap_target'));
}

/// Waits until the target's Offset stops changing (debounces slide animation).
/// Checks getCenter every 100ms; returns true once identical for 3 consecutive checks.
/// Ensures the tray slide (300ms delay + 400ms duration) is fully finished before tap.
Future<bool> waitForStableTarget(
  WidgetTester tester,
  Finder finder, {
  int maxAttempts = 50,
  int stableChecksRequired = 3,
}) async {
  Offset? lastCenter;
  var stableCount = 0;
  for (var i = 0; i < maxAttempts; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isEmpty) {
      stableCount = 0;
      continue;
    }
    try {
      final center = tester.getCenter(finder);
      if (lastCenter == center) {
        stableCount++;
        if (stableCount >= stableChecksRequired) return true;
      } else {
        stableCount = 0;
        lastCenter = center;
      }
    } catch (_) {
      stableCount = 0;
    }
  }
  return false;
}

/// Builder for a finder (evaluated at step execution time).
typedef FinderBuilder = Finder Function();

/// A single step in a journey.
class JourneyStep {
  const JourneyStep({
    required this.action,
    required this.finderBuilder,
    this.optionalText,
    this.optionalRetry = true,
    this.screenHint = '',
    this.dragOffset,
  });

  final String action; // 'tap' | 'drag' | 'enter_text' | 'navigate_back' | 'tap_or_back' | 'tap_or_skip'
  final FinderBuilder finderBuilder;
  final String? optionalText;
  final bool optionalRetry;
  final String screenHint;
  final Offset? dragOffset; // For 'drag' action; default (80,0) for slidable
}

/// Detects current screen from ValueKeys.
String detectScreen(WidgetTester tester) {
  if (find.byKey(const ValueKey('screen_sanctuary')).evaluate().isNotEmpty) {
    return 'sanctuary';
  }
  if (find.byKey(const ValueKey('screen_satchel')).evaluate().isNotEmpty) {
    return 'satchel';
  }
  if (find.byKey(const ValueKey('screen_scroll')).evaluate().isNotEmpty) {
    return 'scroll';
  }
  if (find.byKey(const ValueKey('screen_whetstone')).evaluate().isNotEmpty) {
    return 'whetstone';
  }
  return 'unknown';
}

/// Runs a journey for a persona, logging all events.
Future<void> runJourney({
  required WidgetTester tester,
  required Persona persona,
  required List<JourneyStep> steps,
  required SessionLogger logger,
}) async {
  for (var i = 0; i < steps.length; i++) {
    final step = steps[i];
    var success = false;
    var retries = persona.maxRetries;
    VisualCollision? collision;

    while (!success && retries >= 0) {
      final finder = step.finderBuilder();
      try {
        final screen = detectScreen(tester);
        final targetDesc = _describeFinder(finder);

        switch (step.action) {
          case 'tap':
            // Wait for widget to appear and stabilize (debounce animations)
            var waitAttempts = 0;
            while (finder.evaluate().isEmpty && waitAttempts < 30) {
              await tester.pump(const Duration(milliseconds: 500));
              waitAttempts++;
            }
            await waitForStableTarget(tester, finder);
            await tester.tap(finder);
            break;
          case 'tap_satchel':
            final satchel = satchelFinder();
            var wait = 0;
            while (satchel.evaluate().isEmpty && wait < 30) {
              await tester.pump(const Duration(milliseconds: 500));
              wait++;
            }
            await waitForStableTarget(tester, satchel);
            final rect = tester.getRect(satchel);
            await tester.tapAt(rect.centerRight - const Offset(20, 0));
            break;
          case 'tap_or_back':
            if (finder.evaluate().isNotEmpty) {
              await waitForStableTarget(tester, finder);
              await tester.tap(finder);
            } else {
              await tester.pageBack();
            }
            break;
          case 'tap_or_skip':
            if (finder.evaluate().isNotEmpty) {
              await waitForStableTarget(tester, finder);
              await tester.tap(finder);
            }
            break;
          case 'drag':
            await tester.drag(finder, step.dragOffset ?? const Offset(80, 0));
            break;
          case 'enter_text':
            await tester.enterText(finder, step.optionalText ?? '');
            break;
          case 'navigate_back':
            await tester.pageBack();
            break;
          default:
            await tester.tap(finder);
        }

        await tester.pump();
        await tester.pump(persona.pumpAndSettleDuration);
        success = true;
        logger.log(
          screen: step.screenHint.isNotEmpty ? step.screenHint : screen,
          action: step.action,
          target: targetDesc,
          success: true,
        );
      } catch (e) {
        final screen = detectScreen(tester);
        final targetDesc = _describeFinder(step.finderBuilder());

        // Layout overflow is a UI error, not a tap collision
        if (e.toString().contains('overflow')) {
          logger.log(
            screen: step.screenHint.isNotEmpty ? step.screenHint : screen,
            action: 'layout_error',
            target: targetDesc,
            success: false,
            note: 'RenderFlex overflow',
          );
        } else {
          // Check for potential collision: tap may have hit wrong element
          if (e.toString().contains('obscured') ||
              e.toString().contains('not visible')) {
            collision = VisualCollision(
              type: 'obscured',
              obstructer: e.toString(),
            );
          }

          logger.log(
            screen: step.screenHint.isNotEmpty ? step.screenHint : screen,
            action: step.action,
            target: targetDesc,
            success: false,
            note: e.toString(),
            collision: collision,
          );
        }

        if (step.optionalRetry && retries > 0) {
          retries--;
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 500));
        } else {
          rethrow;
        }
      }
    }
    FocusManager.instance.primaryFocus?.unfocus();
  }
}

String _describeFinder(Finder finder) {
  return finder.toString();
}
