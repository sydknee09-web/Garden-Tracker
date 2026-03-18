enum NodeType {
  boulder, // Landmark milestone. Created by Mallet on Mountain path.
  pebble,  // Actionable task. When leaf, packable and burnable.
  shard,   // Sub-task. When leaf, packable and burnable. Logic & Leaf: leaves = unit of work.
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

  /// Logic & Leaf: packability = leaf status. Pebbles and shards can be leaves; boulders are containers.
  bool get canEnterSatchel => this == NodeType.pebble || this == NodeType.shard;

  /// Logic & Leaf: leaves are the unit of work. Both pebbles and shards complete when burned.
  bool get isCompletable => this == NodeType.pebble || this == NodeType.shard;
}
