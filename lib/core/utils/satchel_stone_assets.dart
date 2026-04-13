import '../../data/models/node.dart';
import '../enums/node_type.dart';

/// **Natural rock** (`LargeRock` / `MediumRock` / `SmallRock`) = packed work not yet offered.
/// **Rune stone** (`stone_large` / `stone_medium` / `stone_small`) = marked done, ready for the hearth.
/// See `assets/stones/README.md` and `docs/CORE_LOOP_SOURCE_OF_TRUTH.md` §4.4.
String satchelStoneImagePath(Node? node, {required bool readyToBurn}) {
  final t = node?.nodeType;
  if (readyToBurn) {
    switch (t) {
      case NodeType.boulder:
        return 'assets/stones/stone_large.png';
      case NodeType.shard:
        return 'assets/stones/stone_small.png';
      case NodeType.pebble:
      case null:
        return 'assets/stones/stone_medium.png';
    }
  }
  switch (t) {
    case NodeType.boulder:
      return 'assets/stones/LargeRock.png';
    case NodeType.shard:
      return 'assets/stones/SmallRock.png';
    case NodeType.pebble:
    case null:
      return 'assets/stones/MediumRock.png';
  }
}
