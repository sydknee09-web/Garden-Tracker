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

/// Builds a child path from a parent path and new node ID (e.g. for sub-boulders).
/// LTREE: parent.child. Use for Mallet menu "New Sub-Boulder" / "New Pebble".
String buildChildPath(String parentPath, String newId) =>
    '$parentPath.${newId.ltreeLabel}';

/// Strips the last label from a path to get the parent path.
String parentPath(String ltreePath) {
  final segments = ltreePath.split('.');
  if (segments.length <= 1) throw ArgumentError('Root node has no parent.');
  return segments.sublist(0, segments.length - 1).join('.');
}

/// Depth: 2 = Boulder, 3 = Pebble/Sub-Boulder, 4 = Shard
int nodeDepth(String ltreePath) => ltreePath.split('.').length;

/// True when at max boulder depth (sub-boulder level). Mallet cannot add "New Sub-Boulder".
/// Depth 3 = sub-boulder; depth 2 = boulder (can add sub-boulder).
bool maxDepthReached(String ltreePath) => nodeDepth(ltreePath) >= 3;

/// True if Mallet can offer "New Sub-Boulder" on this boulder.
/// False when already at sub-boulder level (depth 3).
bool canAddSubBoulder(String ltreePath) => !maxDepthReached(ltreePath);
