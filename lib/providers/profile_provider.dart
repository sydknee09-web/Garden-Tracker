import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/profile.dart';
import 'repository_providers.dart';

/// Fetches the current user's profile. Depends on auth (via repository).
/// In demo mode, uses DemoProfileRepository.
final profileProvider = FutureProvider<Profile?>((ref) async {
  final repo = ref.watch(profileRepositoryProvider);
  return repo.ensureAndFetchProfile();
});
