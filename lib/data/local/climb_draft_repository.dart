import 'package:shared_preferences/shared_preferences.dart';

import '../models/climb_draft.dart';

/// Persists [ClimbDraft] list in SharedPreferences (single JSON blob).
class ClimbDraftRepository {
  ClimbDraftRepository();

  static const _key = 'climb_drafts_v1';

  Future<List<ClimbDraft>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      return ClimbDraft.decodeList(raw);
    } catch (_) {
      return [];
    }
  }

  Future<void> _saveAll(List<ClimbDraft> drafts) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, ClimbDraft.encodeList(drafts));
  }

  Future<void> upsert(ClimbDraft draft) async {
    final all = await loadAll();
    final i = all.indexWhere((d) => d.id == draft.id);
    if (i >= 0) {
      all[i] = draft;
    } else {
      all.add(draft);
    }
    await _saveAll(all);
  }

  Future<void> delete(String id) async {
    final all = await loadAll();
    all.removeWhere((d) => d.id == id);
    await _saveAll(all);
  }
}
