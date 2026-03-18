class Mountain {
  const Mountain({
    required this.id,
    required this.userId,
    required this.name,
    this.orderIndex = 0,
    this.isArchived = false,
    this.intentStatement,
    this.layoutType = 'climb',
    this.appearanceStyle = 'slate',
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String name;
  final int orderIndex;
  final bool isArchived;
  final String? intentStatement;
  final String layoutType;
  final String appearanceStyle;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Mountain.fromJson(Map<String, dynamic> json) => Mountain(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        name: json['name'] as String,
        orderIndex: (json['order_index'] as num?)?.toInt() ?? 0,
        isArchived: json['is_archived'] as bool? ?? false,
        intentStatement: json['intent_statement'] as String?,
        layoutType: json['layout_type'] as String? ?? 'climb',
        appearanceStyle: json['appearance_style'] as String? ?? 'slate',
        createdAt: DateTime.parse(json['created_at'] as String),
        updatedAt: DateTime.parse(json['updated_at'] as String),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'name': name,
        'order_index': orderIndex,
        'is_archived': isArchived,
        'intent_statement': intentStatement,
        'layout_type': layoutType,
        'appearance_style': appearanceStyle,
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt.toIso8601String(),
      };

  Mountain copyWith({
    String? name,
    int? orderIndex,
    bool? isArchived,
    String? intentStatement,
    String? layoutType,
    String? appearanceStyle,
  }) =>
      Mountain(
        id: id,
        userId: userId,
        name: name ?? this.name,
        orderIndex: orderIndex ?? this.orderIndex,
        isArchived: isArchived ?? this.isArchived,
        intentStatement: intentStatement ?? this.intentStatement,
        layoutType: layoutType ?? this.layoutType,
        appearanceStyle: appearanceStyle ?? this.appearanceStyle,
        createdAt: createdAt,
        updatedAt: DateTime.now(),
      );
}
