class Mountain {
  const Mountain({
    required this.id,
    required this.userId,
    required this.name,
    this.orderIndex = 0,
    this.isArchived = false,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String name;
  final int orderIndex;
  final bool isArchived;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Mountain.fromJson(Map<String, dynamic> json) => Mountain(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        name: json['name'] as String,
        orderIndex: (json['order_index'] as num?)?.toInt() ?? 0,
        isArchived: json['is_archived'] as bool? ?? false,
        createdAt: DateTime.parse(json['created_at'] as String),
        updatedAt: DateTime.parse(json['updated_at'] as String),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'name': name,
        'order_index': orderIndex,
        'is_archived': isArchived,
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt.toIso8601String(),
      };

  Mountain copyWith({
    String? name,
    int? orderIndex,
    bool? isArchived,
  }) =>
      Mountain(
        id: id,
        userId: userId,
        name: name ?? this.name,
        orderIndex: orderIndex ?? this.orderIndex,
        isArchived: isArchived ?? this.isArchived,
        createdAt: createdAt,
        updatedAt: DateTime.now(),
      );
}
