class Profile {
  const Profile({
    required this.id,
    this.hasSeenEliasIntro = false,
    this.displayName,
  });

  final String id;
  final bool hasSeenEliasIntro;
  /// Name Elias uses in dialogue (e.g. intro Beat 3/5). Set during name-capture step; default "Wayfarer" if skipped.
  final String? displayName;

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
        id: json['id'] as String,
        hasSeenEliasIntro: json['has_seen_elias_intro'] as bool? ?? false,
        displayName: json['display_name'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'has_seen_elias_intro': hasSeenEliasIntro,
        'display_name': displayName,
      };

  Profile copyWith({bool? hasSeenEliasIntro, String? displayName}) => Profile(
        id: id,
        hasSeenEliasIntro: hasSeenEliasIntro ?? this.hasSeenEliasIntro,
        displayName: displayName ?? this.displayName,
      );
}
