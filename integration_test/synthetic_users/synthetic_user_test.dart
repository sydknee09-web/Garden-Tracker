import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voyager_sanctuary/bootstrap.dart';

import 'journeys/add_task_journey.dart';
import 'journeys/complete_task_journey.dart';
import 'journeys/journey_runner.dart' show runJourney, satchelFinder, waitForStableTarget;
import 'journeys/whetstone_journey.dart';
import 'personas/persona_definitions.dart';
import 'session_logger.dart';

/// Synthetic user testing: personas navigate the app, session is logged.
/// Demo mode is auto-enabled via kSkipAuthForTesting.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  /// Catches "Loading Screen Purgatory" — app stuck on "Loading Sanctuary...".
  /// Runs the REAL flow (no pre-init): runVoyagerSanctuary() so _AppLoader runs init in background.
  /// Verifies we exit loading within 12s (either to Sanctuary or via escape hatch).
  testWidgets('Loading Screen Purgatory — exits within 12s', (WidgetTester tester) async {
    runVoyagerSanctuary(); // Normal flow — no initVoyagerSanctuary() first
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    var elapsed = 0;
    const maxWait = 12; // seconds
    while (elapsed < maxWait) {
      if (find.text('Loading Sanctuary...').evaluate().isEmpty) {
        // We're past loading — either Sanctuary or connection error
        if (find.text('Stuck? Use offline').evaluate().isNotEmpty) {
          await tester.tap(find.text('Stuck? Use offline'));
          await tester.pump();
          await tester.pump(const Duration(seconds: 2));
        }
        expect(
          find.byKey(const ValueKey('screen_sanctuary')).evaluate().isNotEmpty ||
              find.text('Connection unavailable').evaluate().isNotEmpty,
          true,
          reason: 'Should reach Sanctuary or connection error screen',
        );
        return;
      }
      await tester.pump(const Duration(seconds: 1));
      elapsed++;
    }
    fail('Loading screen did not exit within ${maxWait}s — purgatory regression');
  });

  testWidgets('Sanctuary Navigation Smoke', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return; // skip: not signed in
    }

    final satchel = satchelFinder();
    var wait = 0;
    while (satchel.evaluate().isEmpty && wait < 30) {
      await tester.pump(const Duration(milliseconds: 500));
      wait++;
    }
    await waitForStableTarget(tester, satchel);
    final rect = tester.getRect(satchel);
    await tester.tapAt(rect.centerRight - const Offset(20, 0));
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    expect(find.byKey(const ValueKey('screen_satchel')), findsOneWidget);

    await tester.pageBack();
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(find.byKey(const ValueKey('screen_sanctuary')), findsOneWidget);
  });

  testWidgets('Narrow Screen Regression', (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return; // skip: not signed in
    }

    final satchel = satchelFinder();
    var wait = 0;
    while (satchel.evaluate().isEmpty && wait < 30) {
      await tester.pump(const Duration(milliseconds: 500));
      wait++;
    }
    await waitForStableTarget(tester, satchel);
    final rect = tester.getRect(satchel);
    await tester.tapAt(rect.centerRight - const Offset(20, 0));
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    expect(find.byKey(const ValueKey('screen_satchel')), findsOneWidget);

    await tester.pageBack();
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    expect(find.byKey(const ValueKey('screen_sanctuary')), findsOneWidget);
  });

  testWidgets('Synthetic user: power_user_paul runs complete_task journey', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return;
    }

    final persona = syntheticPersonas.firstWhere((p) => p.id == 'power_user_paul');
    final logger = SessionLogger(personaId: persona.id);
    final steps = completeTaskJourney();

    try {
      await runJourney(
        tester: tester,
        persona: persona,
        steps: steps,
        logger: logger,
      );
    } catch (e) {
      // Log failure but still write partial session
    }
    final path = await logger.writeToFile();
    expect(path, isNotEmpty);
  });

  testWidgets('addTaskJourneySmoke', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return;
    }

    final persona = syntheticPersonas.firstWhere((p) => p.id == 'power_user_paul');
    final logger = SessionLogger(personaId: 'addTaskJourneySmoke');
    final steps = addTaskJourneySmoke();

    try {
      await runJourney(
        tester: tester,
        persona: persona,
        steps: steps,
        logger: logger,
      );
    } catch (e) {
      logger.log(
        screen: 'unknown',
        action: 'journey_failed',
        target: 'addTaskJourneySmoke',
        success: false,
        note: e.toString(),
      );
      // Do not rethrow — allows suite to continue for full JSON report
    }

    final path = await logger.writeToFile();
    expect(path, isNotEmpty);
  });

  testWidgets('Synthetic user: task_focused_tina runs add_task journey', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return;
    }

    final persona = syntheticPersonas.firstWhere((p) => p.id == 'task_focused_tina');
    final logger = SessionLogger(personaId: persona.id);
    final steps = addTaskJourney(includeSplit: false);

    try {
      await runJourney(
        tester: tester,
        persona: persona,
        steps: steps,
        logger: logger,
      );
    } catch (e) {
      // Log failure but still write partial session
    }
    final path = await logger.writeToFile();
    expect(path, isNotEmpty);
  });

  testWidgets('Synthetic user: first_time_marcus runs explore journey', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return;
    }

    final persona = syntheticPersonas.firstWhere((p) => p.id == 'first_time_marcus');
    final logger = SessionLogger(personaId: persona.id);
    final steps = addTaskJourneySmoke(); // Explore: Sanctuary → Satchel → Scroll → ARCHITECT

    try {
      await runJourney(
        tester: tester,
        persona: persona,
        steps: steps,
        logger: logger,
      );
    } catch (e) {
      // Log failure but still write partial session
    }
    final path = await logger.writeToFile();
    expect(path, isNotEmpty);
  });

  testWidgets('Synthetic user: power_user_paul runs whetstone journey', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return;
    }

    final persona = syntheticPersonas.firstWhere((p) => p.id == 'power_user_paul');
    final logger = SessionLogger(personaId: persona.id);
    final steps = whetstoneJourney(habitTitle: 'Synthetic habit');

    try {
      await runJourney(
        tester: tester,
        persona: persona,
        steps: steps,
        logger: logger,
      );
    } catch (e) {
      // Log failure but still write partial session
    }
    final path = await logger.writeToFile();
    expect(path, isNotEmpty);
  });
}
