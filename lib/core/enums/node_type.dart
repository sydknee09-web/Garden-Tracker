enum NodeType {
  boulder, // Landmark milestone. Created by Mallet on Mountain path.
  pebble,  // Actionable task. Goes into the Satchel.
  shard,   // Visual-only sub-task. Never enters Satchel. Never independently completable.
}

extension NodeTypeExtension on NodeType {
  String get dbValue {
    switch (this) {
      case NodeType.boulder: return 'boulder';
      case NodeType.pebble:  return 'pebble';
      case NodeType.shard:   return 'shard';
    }
  }

  static NodeType fromDb(String value) {
    switch (value) {
      case 'boulder': return NodeType.boulder;
      case 'pebble':  return NodeType.pebble;
      case 'shard':   return NodeType.shard;
      default: throw ArgumentError('Unknown node_type: $value');
    }
  }

  bool get isCompletable => this == NodeType.pebble;
  bool get canEnterSatchel => this == NodeType.pebble;
  bool get isVisualOnly => this == NodeType.shard;
}
