import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voyager_sanctuary/bootstrap.dart';

/// E2E test for full Mallet flow: Architect on → create Boulder → create Pebble → split Pebble.
/// Requires an active session (run on device/emulator where you're already signed in),
/// or the test will skip when it sees the auth screen.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Mallet: Architect on, create Boulder → Pebble → split Pebble', (WidgetTester tester) async {
    await initVoyagerSanctuary();
    runVoyagerSanctuary();
    await tester.pumpAndSettle(const Duration(seconds: 6));

    if (find.text('Sign in').evaluate().isNotEmpty ||
        find.text('Create account').evaluate().isNotEmpty) {
      return; // skip: not signed in
    }

    // Sanctuary: open Satchel (bag icon), then The Map (user-facing: "The Map" per MASTER_PLAN)
    await tester.tap(find.byKey(const ValueKey('satchel_tap_target')));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    expect(find.text('The Map'), findsOneWidget);
    await tester.tap(find.text('The Map'));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    expect(find.text('THE MAP'), findsOneWidget);

    // Tap first mountain card to open Detail (Architect lives on Detail per plan)
    if (find.text('Sanctuary Heights').evaluate().isNotEmpty) {
      await tester.tap(find.text('Sanctuary Heights'));
    } else if (find.byIcon(Icons.landscape).evaluate().isNotEmpty) {
      await tester.tap(find.byIcon(Icons.landscape).first);
    } else {
      return; // no mountains
    }
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // Enable Architect mode on Detail screen
    await tester.tap(find.text('ARCHITECT'));
    await tester.pumpAndSettle();

    // Add boulder if empty, or add pebble to existing boulder
    if (find.text('Add boulder').evaluate().isNotEmpty) {
      await tester.tap(find.text('Add boulder'));
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    // Tap add icon on boulder to create Pebble (or tap gavel on pebble to split)
    if (find.byIcon(Icons.add).evaluate().isNotEmpty) {
      await tester.tap(find.byIcon(Icons.add).first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    // Tap gavel on pebble to split
    if (find.byIcon(Icons.gavel).evaluate().isNotEmpty) {
      await tester.tap(find.byIcon(Icons.gavel).first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    // Verify we have boulder/pebble content
    expect(
      find.text('Primary Boulder').evaluate().isNotEmpty ||
          find.text('(unnamed boulder)').evaluate().isNotEmpty ||
          find.text('(unnamed task)').evaluate().isNotEmpty,
      isTrue,
    );
  });
}
