import 'package:flutter_test/flutter_test.dart';
import 'journey_runner.dart';

/// Journey: Sanctuary → Satchel → Pack (if needed) → back to Sanctuary → drag stone to Hearth.
/// Includes Sticky Stone validation: after burn, expect stone no longer in satchel.
List<JourneyStep> completeTaskJourney() {
  return [
    // Open Satchel from Sanctuary
    JourneyStep(
      action: 'tap_satchel',
      finderBuilder: satchelFinder,
      screenHint: 'sanctuary',
    ),
    // Pack Satchel if not full (tap Pack button; skip if satchel already full)
    JourneyStep(
      action: 'tap_or_skip',
      finderBuilder: () => find.text('Pack'),
      screenHint: 'satchel',
      optionalRetry: true,
    ),
    // Navigate back to Sanctuary: tap_or_back tries Enter Sanctuary first, else Back (button removed in D3)
    JourneyStep(
      action: 'tap_or_back',
      finderBuilder: () => find.text('Enter Sanctuary'),
      screenHint: 'satchel',
      optionalRetry: false,
    ),
    // Drag first SatchelStone up to Hearth (negative Y = upward)
    JourneyStep(
      action: 'drag',
      finderBuilder: () => find.bySemanticsLabel('SatchelStone').first,
      screenHint: 'sanctuary',
      dragOffset: const Offset(0, -250),
      optionalRetry: false,
    ),
  ];
}
