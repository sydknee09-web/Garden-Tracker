class WhetstoneItem {
  const WhetstoneItem({
    required this.id,
    required this.userId,
    required this.title,
    this.orderIndex = 0,
    this.isActive = true,
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String title;
  final int orderIndex;
  final bool isActive;
  final DateTime createdAt;

  factory WhetstoneItem.fromJson(Map<String, dynamic> json) => WhetstoneItem(
    id: json['id'] as String,
    userId: json['user_id'] as String,
    title: json['title'] as String,
    orderIndex: (json['order_index'] as num?)?.toInt() ?? 0,
    isActive: json['is_active'] as bool? ?? true,
    createdAt: DateTime.parse(json['created_at'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'title': title,
    'order_index': orderIndex,
    'is_active': isActive,
    'created_at': createdAt.toIso8601String(),
  };

  WhetstoneItem copyWith({String? title, int? orderIndex, bool? isActive}) =>
      WhetstoneItem(
        id: id,
        userId: userId,
        title: title ?? this.title,
        orderIndex: orderIndex ?? this.orderIndex,
        isActive: isActive ?? this.isActive,
        createdAt: createdAt,
      );
}
