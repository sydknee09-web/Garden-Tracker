import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'journey_runner.dart';

/// Journey: Sanctuary → Satchel → The Whetstone → (overlay) go to full Whetstone → add habit.
List<JourneyStep> whetstoneJourney({String habitTitle = 'Synthetic habit'}) {
  return [
    // Open Satchel from Sanctuary
    JourneyStep(
      action: 'tap_satchel',
      finderBuilder: satchelFinder,
      screenHint: 'sanctuary',
    ),
    // Tap The Whetstone (opens overlay)
    JourneyStep(
      action: 'tap',
      finderBuilder: () {
        if (find.bySemanticsLabel('The Whetstone').evaluate().isNotEmpty) {
          return find.bySemanticsLabel('The Whetstone');
        }
        return find.text('The Whetstone');
      },
      screenHint: 'satchel',
    ),
    // From overlay: tap "Sharpen Habits" to go to full Whetstone screen
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Sharpen Habits'),
      screenHint: 'satchel',
      optionalRetry: false,
    ),
    // Tap add habit
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.byIcon(Icons.add),
      screenHint: 'whetstone',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'enter_text',
      finderBuilder: () => find.byType(TextField),
      optionalText: habitTitle,
      screenHint: 'whetstone',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Add'),
      screenHint: 'whetstone',
      optionalRetry: false,
    ),
  ];
}
