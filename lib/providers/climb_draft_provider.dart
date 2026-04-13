import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/local/climb_draft_repository.dart';
import '../data/models/climb_draft.dart';

final climbDraftRepositoryProvider = Provider<ClimbDraftRepository>(
  (ref) => ClimbDraftRepository(),
);

/// Sorted newest first by [ClimbDraft.updatedAt].
final climbDraftListProvider =
    AsyncNotifierProvider<ClimbDraftListNotifier, List<ClimbDraft>>(
  ClimbDraftListNotifier.new,
);

class ClimbDraftListNotifier extends AsyncNotifier<List<ClimbDraft>> {
  @override
  Future<List<ClimbDraft>> build() => _loadSorted();

  Future<List<ClimbDraft>> _loadSorted() async {
    final repo = ref.read(climbDraftRepositoryProvider);
    final list = await repo.loadAll();
    list.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(_loadSorted);
  }

  Future<void> upsert(ClimbDraft draft) async {
    await ref.read(climbDraftRepositoryProvider).upsert(draft);
    await refresh();
  }

  Future<void> deleteDraft(String id) async {
    await ref.read(climbDraftRepositoryProvider).delete(id);
    await refresh();
  }
}
