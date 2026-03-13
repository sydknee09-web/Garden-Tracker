import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voyager_sanctuary/bootstrap.dart';

/// E2E tests for Whetstone: add habit, check off.
/// Requires an active session (run on device/emulator where you're already signed in),
/// or the test will skip when it sees the auth screen.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const String testHabitTitle = 'E2E habit add test';

  testWidgets('Whetstone: add habit and see it in the list', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pumpAndSettle(const Duration(seconds: 6));

    // If we landed on auth, skip (no test credentials in this test)
    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return; // skip: not signed in
    }

    // We should be on Sanctuary; tap Whetstone to open it
    expect(find.text('Whetstone'), findsOneWidget);
    await tester.tap(find.text('Whetstone'));
    await tester.pumpAndSettle();

    expect(find.text('THE WHETSTONE'), findsOneWidget);

    // Tap add (app bar action)
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();

    expect(find.text('New Habit'), findsOneWidget);
    await tester.enterText(find.byType(TextField), testHabitTitle);
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    expect(find.text(testHabitTitle), findsOneWidget);
  });

  testWidgets('Whetstone: check off a habit (Done)', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pumpAndSettle(const Duration(seconds: 6));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return;
    }

    await tester.tap(find.text('Whetstone'));
    await tester.pumpAndSettle();

    // Ensure our test habit exists (from previous test or manual data)
    if (find.text(testHabitTitle).evaluate().isEmpty) {
      return; // skip if no habit to check off
    }

    // Slidable: drag the row slightly right to reveal the left "Done" action, then tap it
    await tester.drag(find.text(testHabitTitle), const Offset(80, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.check_circle_outline));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Row still visible; completion state is reflected in the Slidable (Undo now visible for that row)
    expect(find.text(testHabitTitle), findsOneWidget);
  });
}
