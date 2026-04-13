class WhetstoneCompletion {
  const WhetstoneCompletion({
    required this.id,
    required this.userId,
    required this.itemId,
    required this.completedDate,
    required this.completedAt,
  });

  final String id;
  final String userId;
  final String itemId;

  /// Local date string (YYYY-MM-DD). NOT UTC.
  /// This is the key used for the midnight reset logic.
  final String completedDate;

  final DateTime completedAt;

  factory WhetstoneCompletion.fromJson(Map<String, dynamic> json) =>
      WhetstoneCompletion(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        itemId: json['item_id'] as String,
        completedDate: json['completed_date'] as String,
        completedAt: DateTime.parse(json['completed_at'] as String),
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'item_id': itemId,
    'completed_date': completedDate,
    'completed_at': completedAt.toIso8601String(),
  };
}
