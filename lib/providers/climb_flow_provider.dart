import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Flow state for the guided "New Journey" overlay.
/// autoDispose: when overlay closes, state is disposed so next open = fresh slate.
class ClimbFlowState {
  const ClimbFlowState({
    this.step = 0,
    this.mountainId,
    this.mountainName = '',
    this.boulderIds = const [],
    this.landmarkNames = const [],
    this.pebbleStepBoulderIndex = 0,
    this.lastEliasIndex = -1,
    this.namingStoneIndex,
    this.layoutType = 'climb',
    this.appearanceStyle = 'slate',
  });

  final int step;
  final String? mountainId;
  final String mountainName;
  final List<String> boulderIds;
  final List<String> landmarkNames;
  final int pebbleStepBoulderIndex;
  final int lastEliasIndex;
  /// When non-null, parchment card shows "Name this pebble" (morphing) instead of landmark chips.
  final int? namingStoneIndex;
  /// 'climb' = sequential (Milestones) | 'survey' = categorical (Regions).
  final String layoutType;
  /// Peak appearance: dark_walnut, navy, slate, charcoal, burgundy, forest.
  final String appearanceStyle;

  ClimbFlowState copyWith({
    int? step,
    String? mountainId,
    String? mountainName,
    List<String>? boulderIds,
    List<String>? landmarkNames,
    int? pebbleStepBoulderIndex,
    int? lastEliasIndex,
    int? namingStoneIndex,
    bool clearNamingStoneIndex = false,
    String? layoutType,
    String? appearanceStyle,
  }) {
    return ClimbFlowState(
      step: step ?? this.step,
      mountainId: mountainId ?? this.mountainId,
      mountainName: mountainName ?? this.mountainName,
      boulderIds: boulderIds ?? this.boulderIds,
      landmarkNames: landmarkNames ?? this.landmarkNames,
      pebbleStepBoulderIndex: pebbleStepBoulderIndex ?? this.pebbleStepBoulderIndex,
      lastEliasIndex: lastEliasIndex ?? this.lastEliasIndex,
      namingStoneIndex: clearNamingStoneIndex ? null : (namingStoneIndex ?? this.namingStoneIndex),
      layoutType: layoutType ?? this.layoutType,
      appearanceStyle: appearanceStyle ?? this.appearanceStyle,
    );
  }
}

class ClimbFlowNotifier extends Notifier<ClimbFlowState> {
  @override
  ClimbFlowState build() => const ClimbFlowState();

  void setStep(int step) {
    state = state.copyWith(step: step);
  }

  void setMountain(String id, String name) {
    state = state.copyWith(mountainId: id, mountainName: name);
  }

  void setLandmarks(List<String> ids, List<String> names) {
    state = state.copyWith(boulderIds: ids, landmarkNames: names);
  }

  void setPebbleStepBoulderIndex(int index) {
    state = state.copyWith(pebbleStepBoulderIndex: index);
  }

  void setLastEliasIndex(int index) {
    state = state.copyWith(lastEliasIndex: index);
  }

  void setNamingStoneIndex(int? index) {
    state = state.copyWith(namingStoneIndex: index, clearNamingStoneIndex: index == null);
  }

  void setLayoutType(String layoutType) {
    state = state.copyWith(layoutType: layoutType);
  }

  void setAppearanceStyle(String appearanceStyle) {
    state = state.copyWith(appearanceStyle: appearanceStyle);
  }

  void close() {
    // Provider will autoDispose when no longer watched.
    // Caller pops the overlay; we don't need to reset here.
  }
}

/// Non-auto-dispose so state persists while overlay is open. Invalidated on overlay dispose for fresh slate on reopen.
final climbFlowProvider =
    NotifierProvider<ClimbFlowNotifier, ClimbFlowState>(
  ClimbFlowNotifier.new,
);
