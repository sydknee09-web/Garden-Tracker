import 'node.dart';

class SatchelSlot {
  const SatchelSlot({
    required this.id,
    required this.userId,
    required this.slotIndex,
    this.nodeId,
    this.node,
    required this.packedAt,
    this.readyToBurn = false,
  });

  final String id;
  final String userId;

  /// 1-based slot position (1–6).
  final int slotIndex;

  /// Null means the slot is empty.
  final String? nodeId;

  /// Populated when the slot is joined with node data.
  final Node? node;

  final DateTime packedAt;

  /// True when the user has checked off this task in the Satchel.
  /// Only ready slots appear as draggable stones in the Sanctuary.
  final bool readyToBurn;

  /// Empty when nodeId is null, empty string, or the literal "null" (JSON edge cases).
  bool get isEmpty =>
      nodeId == null ||
      nodeId!.trim().isEmpty ||
      nodeId!.toLowerCase() == 'null';
  bool get isFilled => !isEmpty;

  /// True when this slot can be dragged to the Hearth.
  bool get canDropInHearth => isFilled && readyToBurn;

  factory SatchelSlot.fromJson(Map<String, dynamic> json) => SatchelSlot(
    id: json['id'] as String,
    userId: json['user_id'] as String,
    slotIndex: (json['slot_index'] as num).toInt(),
    nodeId: json['node_id'] as String?,
    node: json['nodes'] != null
        ? Node.fromJson(json['nodes'] as Map<String, dynamic>)
        : null,
    packedAt: DateTime.parse(json['packed_at'] as String),
    readyToBurn: json['ready_to_burn'] as bool? ?? false,
  );

  SatchelSlot copyWith({
    String? nodeId,
    Node? node,
    bool clearNode = false,
    bool? readyToBurn,
  }) => SatchelSlot(
    id: id,
    userId: userId,
    slotIndex: slotIndex,
    nodeId: clearNode ? null : (nodeId ?? this.nodeId),
    node: clearNode ? null : (node ?? this.node),
    packedAt: packedAt,
    readyToBurn: clearNode ? false : (readyToBurn ?? this.readyToBurn),
  );
}
