import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'demo_mode_provider.dart';
import '../data/repositories/mountain_repository.dart';
import '../data/repositories/node_repository.dart';
import '../data/repositories/profile_repository.dart';
import '../data/repositories/satchel_repository.dart';
import '../data/repositories/whetstone_repository.dart';
import '../data/demo/demo_mountain_repository.dart';
import '../data/demo/demo_node_repository.dart';
import '../data/demo/demo_profile_repository.dart';
import '../data/demo/demo_satchel_repository.dart';
import '../data/demo/demo_whetstone_repository.dart';

/// Profile repository — Supabase or demo based on [demoModeProvider].
final profileRepositoryProvider = Provider<ProfileRepositoryInterface>((ref) {
  return ref.watch(demoModeProvider)
      ? DemoProfileRepository.instance
      : ProfileRepository();
});

/// Node repository — Supabase or demo based on [demoModeProvider].
final nodeRepositoryProvider = Provider<NodeRepository>((ref) {
  return ref.watch(demoModeProvider) ? DemoNodeRepository() : NodeRepository();
});

/// Mountain repository — Supabase or demo based on [demoModeProvider].
final mountainRepositoryProvider = Provider<MountainRepository>((ref) {
  return ref.watch(demoModeProvider) ? DemoMountainRepository() : MountainRepository();
});

/// Whetstone repository — Supabase or demo based on [demoModeProvider].
final whetstoneRepositoryProvider = Provider<WhetstoneRepository>((ref) {
  return ref.watch(demoModeProvider) ? DemoWhetstoneRepository() : WhetstoneRepository();
});

/// Satchel repository — Supabase or demo based on [demoModeProvider].
final satchelRepositoryProvider = Provider<SatchelRepository>((ref) {
  return ref.watch(demoModeProvider) ? DemoSatchelRepository() : SupabaseSatchelRepository();
});
