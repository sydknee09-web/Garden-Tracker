extension LtreeUuid on String {
  /// LTREE labels cannot contain hyphens. Converts UUID to a safe label.
  String get ltreeLabel => replaceAll('-', '_');
}

String buildBoulderPath(String mountainId, String boulderId) =>
    '${mountainId.ltreeLabel}.${boulderId.ltreeLabel}';

String buildPebblePath(String mountainId, String boulderId, String pebbleId) =>
    '${mountainId.ltreeLabel}.${boulderId.ltreeLabel}.${pebbleId.ltreeLabel}';

String buildShardPath(
    String mountainId, String boulderId, String pebbleId, String shardId) =>
    '${mountainId.ltreeLabel}.${boulderId.ltreeLabel}.${pebbleId.ltreeLabel}.${shardId.ltreeLabel}';

/// Strips the last label from a path to get the parent path.
String parentPath(String ltreePath) {
  final segments = ltreePath.split('.');
  if (segments.length <= 1) throw ArgumentError('Root node has no parent.');
  return segments.sublist(0, segments.length - 1).join('.');
}

/// Depth: 1 = Boulder, 2 = Pebble, 3 = Shard
int nodeDepth(String ltreePath) => ltreePath.split('.').length;
