import '../../core/enums/node_type.dart';
import '../../core/utils/ltree_path.dart';

class Node {
  const Node({
    required this.id,
    required this.userId,
    required this.mountainId,
    required this.path,
    required this.nodeType,
    this.title = '',
    this.orderIndex = 0,
    this.isStarred = false,
    this.dueDate,
    this.isComplete = false,
    this.completedAt,
    this.isPendingRitual = false,
    this.isArchived = false,
    this.pebbleLogic = 'freeform',
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String mountainId;
  final String path;
  final NodeType nodeType;
  final String title;
  final int orderIndex;
  final bool isStarred;
  final DateTime? dueDate;
  final bool isComplete;
  final DateTime? completedAt;
  final bool isPendingRitual;
  final bool isArchived;
  final String pebbleLogic;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Node.fromJson(Map<String, dynamic> json) => Node(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        mountainId: json['mountain_id'] as String,
        path: json['path'] as String,
        nodeType: NodeTypeExtension.fromDb(json['node_type'] as String),
        title: json['title'] as String? ?? '',
        orderIndex: (json['order_index'] as num?)?.toInt() ?? 0,
        isStarred: json['is_starred'] as bool? ?? false,
        dueDate: json['due_date'] != null
            ? DateTime.parse(json['due_date'] as String)
            : null,
        isComplete: json['is_complete'] as bool? ?? false,
        completedAt: json['completed_at'] != null
            ? DateTime.parse(json['completed_at'] as String)
            : null,
        isPendingRitual: json['is_pending_ritual'] ?? false,
        isArchived: json['is_archived'] ?? false,
        pebbleLogic: json['pebble_logic'] as String? ?? 'freeform',
        createdAt: DateTime.parse(json['created_at'] as String),
        updatedAt: DateTime.parse(json['updated_at'] as String),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'mountain_id': mountainId,
        'path': path,
        'node_type': nodeType.dbValue,
        'title': title,
        'order_index': orderIndex,
        'is_starred': isStarred,
        'due_date': dueDate?.toIso8601String().split('T').first,
        'is_complete': isComplete,
        'completed_at': completedAt?.toIso8601String(),
        'is_pending_ritual': isPendingRitual,
        'is_archived': isArchived,
        'pebble_logic': pebbleLogic,
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt.toIso8601String(),
      };

  /// Absolute LTREE depth (includes mountain_id as first segment).
  /// Boulder=2, Pebble=3, Shard=4.
  int get depth => nodeDepth(path);

  /// The LTREE path of this node's parent.
  String? get parentPath {
    if (depth <= 1) return null;
    return path.split('.').sublist(0, depth - 1).join('.');
  }

  Node copyWith({
    String? title,
    int? orderIndex,
    bool? isStarred,
    DateTime? dueDate,
    bool clearDueDate = false,
    bool? isComplete,
    DateTime? completedAt,
    bool? isPendingRitual,
    bool? isArchived,
    String? pebbleLogic,
  }) =>
      Node(
        id: id,
        userId: userId,
        mountainId: mountainId,
        path: path,
        nodeType: nodeType,
        title: title ?? this.title,
        orderIndex: orderIndex ?? this.orderIndex,
        isStarred: isStarred ?? this.isStarred,
        dueDate: clearDueDate ? null : (dueDate ?? this.dueDate),
        isComplete: isComplete ?? this.isComplete,
        completedAt: completedAt ?? this.completedAt,
        isPendingRitual: isPendingRitual ?? this.isPendingRitual,
        isArchived: isArchived ?? this.isArchived,
        pebbleLogic: pebbleLogic ?? this.pebbleLogic,
        createdAt: createdAt,
        updatedAt: DateTime.now(),
      );

  /// Creates a new sibling node that clones priority metadata.
  /// Used by the Mallet split operation.
  /// Title is intentionally empty — user fills it via keyboard.
  Node cloneAsNewSibling({required String newId, required String siblingPath}) =>
      Node(
        id: newId,
        userId: userId,
        mountainId: mountainId,
        path: siblingPath,
        nodeType: nodeType,
        title: '',
        orderIndex: orderIndex,
        isStarred: isStarred,       // CLONE: deadline pressure must not be lost
        dueDate: dueDate,           // CLONE: deadline pressure must not be lost
        isComplete: false,
        completedAt: null,
        isPendingRitual: false,
        isArchived: false,
        pebbleLogic: pebbleLogic,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
}
