import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'journey_runner.dart';

/// Minimal journey: Sanctuary → Satchel → Scroll → ARCHITECT. Validates navigation only.
List<JourneyStep> addTaskJourneySmoke() {
  return [
    JourneyStep(
      action: 'tap_satchel',
      finderBuilder: satchelFinder,
      screenHint: 'sanctuary',
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () {
        if (find.bySemanticsLabel('The Map').evaluate().isNotEmpty) {
          return find.bySemanticsLabel('The Map');
        }
        return find.text('The Map');
      },
      screenHint: 'satchel',
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.bySemanticsLabel('ARCHITECT'),
      screenHint: 'scroll',
    ),
  ];
}

/// Journey: Sanctuary → Satchel → Scroll → Architect → add boulder/pebble via Mallet.
/// Assumes at least one mountain exists (from Climb flow or demo seed).
List<JourneyStep> addTaskJourney({bool includeSplit = false}) {
  return [
    // Open Satchel from Sanctuary
    JourneyStep(
      action: 'tap_satchel',
      finderBuilder: satchelFinder,
      screenHint: 'sanctuary',
    ),
    // Tap The Map to go to Map
    JourneyStep(
      action: 'tap',
      finderBuilder: () {
        if (find.bySemanticsLabel('The Map').evaluate().isNotEmpty) {
          return find.bySemanticsLabel('The Map');
        }
        return find.text('The Map');
      },
      screenHint: 'satchel',
    ),
    // Add peak when empty (5-step wizard: Intent → Identity → Logic → Markers → Seeding)
    JourneyStep(
      action: 'tap',
      finderBuilder: () {
        if (find.text('New Journey').evaluate().isNotEmpty) {
          return find.text('New Journey');
        }
        return find.byIcon(Icons.add);
      },
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    // Step 1: Intent
    JourneyStep(
      action: 'enter_text',
      finderBuilder: () => find.byType(TextField).first,
      optionalText: 'Synthetic test intent',
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Continue'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    // Step 2: Identity (name)
    JourneyStep(
      action: 'enter_text',
      finderBuilder: () => find.byType(TextField).first,
      optionalText: 'Synthetic Mountain',
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Continue'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    // Step 3: Logic (Climb default) — tap Continue
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Continue'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.bySemanticsLabel('Template 1'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.byType(FilledButton).last,
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    // Add one pebble (Plant Pebble) then Return to Map
    JourneyStep(
      action: 'tap',
      finderBuilder: () {
        if (find.bySemanticsLabel('climb_plant_pebble').evaluate().isNotEmpty) {
          return find.bySemanticsLabel('climb_plant_pebble');
        }
        if (find.text('Plant Pebble').evaluate().isNotEmpty) {
          return find.text('Plant Pebble');
        }
        return find.text('Add');
      },
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'enter_text',
      finderBuilder: () => find.byType(TextField).last,
      optionalText: 'First task',
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () {
        if (find.bySemanticsLabel('climb_plant_pebble').evaluate().isNotEmpty) {
          return find.bySemanticsLabel('climb_plant_pebble');
        }
        if (find.text('Plant Pebble').evaluate().isNotEmpty) {
          return find.text('Plant Pebble');
        }
        return find.text('Add');
      },
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.bySemanticsLabel('climb_nav_return'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    // Enable Architect mode
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.bySemanticsLabel('ARCHITECT'),
      screenHint: 'scroll',
    ),
    // Tap peak to create Boulder
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.bySemanticsLabel('Peak').first,
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Skip'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    // Tap boulder to create Pebble
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.bySemanticsLabel('Boulder').first,
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    JourneyStep(
      action: 'tap',
      finderBuilder: () => find.text('Skip'),
      screenHint: 'scroll',
      optionalRetry: false,
    ),
    if (includeSplit) ...[
      JourneyStep(
        action: 'tap',
        finderBuilder: () => find.text('(unnamed task)').first,
        screenHint: 'scroll',
        optionalRetry: false,
      ),
      JourneyStep(
        action: 'tap',
        finderBuilder: () => find.text('Skip'),
        screenHint: 'scroll',
        optionalRetry: false,
      ),
    ],
  ];
}
