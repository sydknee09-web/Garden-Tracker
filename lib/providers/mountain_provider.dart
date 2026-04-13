import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/mountain.dart';
import '../data/repositories/mountain_repository.dart';
import 'repository_providers.dart';

final _mountainRepoProvider = Provider<MountainRepository>((ref) {
  return ref.watch(mountainRepositoryProvider);
});

/// Live stream of the user's active (non-archived) mountains.
/// Updates in real-time when any mountain is created, renamed, or archived.
final mountainListProvider = StreamProvider<List<Mountain>>((ref) {
  return ref.watch(_mountainRepoProvider).watchActive();
});

/// Live stream of the user's archived mountains.
final archivedMountainListProvider = StreamProvider<List<Mountain>>((ref) {
  return ref.watch(_mountainRepoProvider).watchArchived();
});

/// The count of active mountains. Used to drive the [+] button enabled state.
final activeMountainCountProvider = Provider<int>((ref) {
  return ref.watch(mountainListProvider).valueOrNull?.length ?? 0;
});

/// Whether the user can create a new mountain (under the cap of 3).
final canAddMountainProvider = Provider<bool>((ref) {
  return ref.watch(activeMountainCountProvider) < MountainRepository.maxActive;
});

/// Single mountain by ID. Use for Edit overlay when node has mountainId.
final mountainProvider = FutureProvider.family<Mountain?, String>((
  ref,
  mountainId,
) async {
  final repo = ref.watch(_mountainRepoProvider);
  return repo.getById(mountainId);
});

/// Progress (0.0–1.0) for a single mountain, keyed by mountainId.
final mountainProgressProvider = FutureProvider.family<double, String>((
  ref,
  mountainId,
) {
  return ref.watch(_mountainRepoProvider).getProgress(mountainId);
});

/// Exposes mountain repository actions to the UI.
final mountainActionsProvider = Provider<MountainRepository>((ref) {
  return ref.watch(_mountainRepoProvider);
});
