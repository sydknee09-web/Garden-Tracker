import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/demo/demo_storage.dart';
import '../data/models/mountain.dart';
import 'demo_mode_provider.dart';
import 'repository_providers.dart';
import 'satchel_provider.dart';

/// Master Orchestrator for demo initial placement. Runs on first Sanctuary load in Demo Mode.
/// Production guard: skips entire placement when !demoModeProvider.
final sanctuaryInitializationProvider = FutureProvider<void>((ref) async {
  if (!ref.read(demoModeProvider)) return;

  final storage = DemoStorage.instance;
  if (storage.nodes.any((n) => n.id == 'demo-pebble-1')) return;

  final nodeRepo = ref.read(nodeRepositoryProvider);
  final satchelRepo = ref.read(satchelRepositoryProvider);

  if (storage.mountains.isEmpty) {
    await storage.addMountain(Mountain(
      id: 'demo-mountain-1',
      userId: DemoStorage.demoUserId,
      name: 'Sanctuary Heights',
      orderIndex: 0,
      isArchived: false,
      intentStatement: null,
      layoutType: 'climb',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
  }

  await nodeRepo.createBoulder(
    mountainId: 'demo-mountain-1',
    title: 'Primary Boulder',
    id: 'demo-boulder-1',
  );

  for (var i = 1; i <= 8; i++) {
    await nodeRepo.createPebble(
      mountainId: 'demo-mountain-1',
      boulderId: 'demo-boulder-1',
      title: 'Demo Pebble $i',
      isPendingRitual: true,
      id: 'demo-pebble-$i',
    );
  }

  final slots = await satchelRepo.fetchSlotsRaw();
  final emptySlots = slots.where((s) => s.isEmpty).toList()
    ..sort((a, b) => a.slotIndex.compareTo(b.slotIndex));

  for (var i = 0; i < 6 && i < emptySlots.length; i++) {
    await satchelRepo.assignPebbleToSlot(
      'demo-pebble-${i + 1}',
      emptySlots[i].id,
    );
  }

  ref.invalidate(satchelProvider);
});
