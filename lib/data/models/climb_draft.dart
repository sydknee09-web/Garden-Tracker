import 'dart:convert';

/// Local-only wizard progress (SharedPreferences). Not synced to Supabase in v0.1.2.
class ClimbDraft {
  const ClimbDraft({
    required this.id,
    required this.updatedAt,
    required this.step,
    this.intentText = '',
    this.peakName = '',
    this.appearanceStyle = 'slate',
    this.layoutType = 'climb',
    this.landmarkNames = const [],
    this.boulderIds = const [],
    this.pebbleStepBoulderIndex = 0,
    this.namingStoneIndex,
    this.lastEliasIndex = -1,
    this.mountainId,
  });

  final String id;
  final DateTime updatedAt;

  /// Wizard step 0–5 (same as [ClimbFlowState.step]).
  final int step;
  final String intentText;
  final String peakName;
  final String appearanceStyle;
  final String layoutType;
  final List<String> landmarkNames;
  final List<String> boulderIds;
  final int pebbleStepBoulderIndex;
  final int? namingStoneIndex;
  final int lastEliasIndex;

  /// Set after Appearance step creates the mountain in Supabase.
  final String? mountainId;

  /// Display title for Chronicled Peaks list.
  String get displayName {
    final n = peakName.trim();
    if (n.isNotEmpty) return n;
    return 'Untitled peak';
  }

  bool get hasMeaningfulProgress {
    if (step >= 2) return true;
    if (mountainId != null && mountainId!.isNotEmpty) return true;
    if (peakName.trim().isNotEmpty) return true;
    if (intentText.trim().isNotEmpty) return true;
    if (landmarkNames.any((e) => e.trim().isNotEmpty)) return true;
    return false;
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'updated_at': updatedAt.toIso8601String(),
        'step': step,
        'intent_text': intentText,
        'peak_name': peakName,
        'appearance_style': appearanceStyle,
        'layout_type': layoutType,
        'landmark_names': landmarkNames,
        'boulder_ids': boulderIds,
        'pebble_step_boulder_index': pebbleStepBoulderIndex,
        'naming_stone_index': namingStoneIndex,
        'last_elias_index': lastEliasIndex,
        'mountain_id': mountainId,
      };

  factory ClimbDraft.fromJson(Map<String, dynamic> json) {
    return ClimbDraft(
      id: json['id'] as String,
      updatedAt: DateTime.parse(json['updated_at'] as String),
      step: (json['step'] as num).toInt().clamp(0, 5),
      intentText: json['intent_text'] as String? ?? '',
      peakName: json['peak_name'] as String? ?? '',
      appearanceStyle: json['appearance_style'] as String? ?? 'slate',
      layoutType: json['layout_type'] as String? ?? 'climb',
      landmarkNames: (json['landmark_names'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      boulderIds: (json['boulder_ids'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      pebbleStepBoulderIndex:
          (json['pebble_step_boulder_index'] as num?)?.toInt() ?? 0,
      namingStoneIndex: (json['naming_stone_index'] as num?)?.toInt(),
      lastEliasIndex: (json['last_elias_index'] as num?)?.toInt() ?? -1,
      mountainId: json['mountain_id'] as String?,
    );
  }

  static String encodeList(List<ClimbDraft> drafts) =>
      jsonEncode(drafts.map((e) => e.toJson()).toList());

  static List<ClimbDraft> decodeList(String raw) {
    if (raw.isEmpty) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => ClimbDraft.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }
}
