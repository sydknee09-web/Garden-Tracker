import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/node.dart';
import 'repository_providers.dart';

/// Packable candidates (leaves not packed, not complete).
/// Logic & Leaf: replaces "active pebbles"; everything flows through packable logic.
/// Does NOT watch satchelProvider. SatchelNotifier invalidates after pack/burn/remove.
final packCandidatesProvider = FutureProvider<List<Node>>((ref) async {
  final repo = ref.watch(satchelRepositoryProvider);
  return repo.fetchPackCandidates(limit: 24);
});

/// @Deprecated Use [packCandidatesProvider]. Kept for migration.
@Deprecated('Use packCandidatesProvider')
final activePebblesProvider = packCandidatesProvider;
