import 'package:flutter_test/flutter_test.dart';
import 'package:voyager_sanctuary/core/enums/node_type.dart';
import 'package:voyager_sanctuary/core/utils/ltree_path.dart';
import 'package:voyager_sanctuary/data/models/node.dart';

// ─────────────────────────────────────────────────────────────
// Helper: build a minimal Node for testing without Supabase
// ─────────────────────────────────────────────────────────────
Node _makeNode({
  String id = 'node-1',
  String mountainId = 'mountain-1',
  String boulderId = 'boulder-1',
  String? pebbleId,
  NodeType type = NodeType.pebble,
  bool isStarred = false,
  DateTime? dueDate,
  bool isComplete = false,
  DateTime? createdAt,
}) {
  final path = pebbleId != null
      ? buildPebblePath(mountainId, boulderId, pebbleId)
      : buildBoulderPath(mountainId, boulderId);
  return Node(
    id: id,
    userId: 'user-1',
    mountainId: mountainId,
    path: path,
    nodeType: type,
    isStarred: isStarred,
    dueDate: dueDate,
    isComplete: isComplete,
    createdAt: createdAt ?? DateTime(2026, 1, 1, 12, 0),
    updatedAt: DateTime(2026, 1, 1, 12, 0),
  );
}

// ─────────────────────────────────────────────────────────────
// Priority sort — mirrors the Supabase ORDER BY logic in Dart
// ─────────────────────────────────────────────────────────────
List<Node> _sortByPriority(List<Node> nodes) {
  final sorted = [...nodes];
  sorted.sort((a, b) {
    // 1. Due Date ASC NULLS LAST
    if (a.dueDate != null && b.dueDate == null) return -1;
    if (a.dueDate == null && b.dueDate != null) return 1;
    if (a.dueDate != null && b.dueDate != null) {
      final cmp = a.dueDate!.compareTo(b.dueDate!);
      if (cmp != 0) return cmp;
    }
    // 2. Starred DESC (true before false)
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    // 3. FIFO (oldest createdAt first)
    return a.createdAt.compareTo(b.createdAt);
  });
  return sorted;
}

void main() {
  // ── LTREE PATH TESTS ──────────────────────────────────────

  group('LTREE path builder', () {
    test('UUID hyphens are replaced with underscores', () {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuid.ltreeLabel, '123e4567_e89b_12d3_a456_426614174000');
    });

    // LTREE paths include mountain_id as the first segment, so:
    // Boulder: {mountain_id}.{boulder_id}               → depth 2
    // Pebble:  {mountain_id}.{boulder_id}.{pebble_id}   → depth 3
    // Shard:   {mountain_id}.{boulder_id}.{pebble_id}.{shard_id} → depth 4

    test('Boulder path has depth 2 (mountain_id + boulder_id)', () {
      final path = buildBoulderPath('m-1', 'b-1');
      expect(nodeDepth(path), 2);
    });

    test('Pebble path has depth 3', () {
      final path = buildPebblePath('m-1', 'b-1', 'p-1');
      expect(nodeDepth(path), 3);
    });

    test('Shard path has depth 4', () {
      final path = buildShardPath('m-1', 'b-1', 'p-1', 's-1');
      expect(nodeDepth(path), 4);
    });

    test('parentPath strips last label from pebble → returns boulder path', () {
      final pebblePath = buildPebblePath('m-1', 'b-1', 'p-1');
      final boulderPath = buildBoulderPath('m-1', 'b-1');
      expect(parentPath(pebblePath), boulderPath);
    });

    test('parentPath on boulder returns mountain label (does not throw)', () {
      final boulderPath = buildBoulderPath('m-1', 'b-1');
      // Boulder has 2 segments — parent is the mountain label
      expect(parentPath(boulderPath), 'm_1');
    });

    test('parentPath throws only on single-segment path', () {
      expect(() => parentPath('only_one_segment'), throwsArgumentError);
    });
  });

  // ── NODE TYPE RULES ───────────────────────────────────────

  group('NodeType rules', () {
    test('Only pebble is completable', () {
      expect(NodeType.pebble.isCompletable, isTrue);
      expect(NodeType.boulder.isCompletable, isFalse);
      expect(NodeType.shard.isCompletable, isFalse);
    });

    test('Only pebble can enter satchel', () {
      expect(NodeType.pebble.canEnterSatchel, isTrue);
      expect(NodeType.boulder.canEnterSatchel, isFalse);
      expect(NodeType.shard.canEnterSatchel, isFalse);
    });

    test('Shard is visual-only', () {
      expect(NodeType.shard.isVisualOnly, isTrue);
      expect(NodeType.pebble.isVisualOnly, isFalse);
    });
  });

  // ── PRIORITY SORT ─────────────────────────────────────────

  group('Priority sort — Due Date > Starred > FIFO', () {
    test('Due date comes before starred and FIFO', () {
      final nodes = [
        _makeNode(id: 'fifo-1',   createdAt: DateTime(2026, 1, 1)),
        _makeNode(id: 'starred',  createdAt: DateTime(2026, 1, 2), isStarred: true),
        _makeNode(id: 'due-date', createdAt: DateTime(2026, 1, 3),
            dueDate: DateTime(2026, 4, 1)),
      ];
      final sorted = _sortByPriority(nodes);
      expect(sorted[0].id, 'due-date');
      expect(sorted[1].id, 'starred');
      expect(sorted[2].id, 'fifo-1');
    });

    test('Starred comes before FIFO when no due dates', () {
      final nodes = [
        _makeNode(id: 'first',   createdAt: DateTime(2026, 1, 1)),
        _makeNode(id: 'second',  createdAt: DateTime(2026, 1, 2)),
        _makeNode(id: 'starred', createdAt: DateTime(2026, 1, 3), isStarred: true),
      ];
      final sorted = _sortByPriority(nodes);
      expect(sorted[0].id, 'starred');
    });

    test('FIFO order preserved when no priority metadata', () {
      final nodes = [
        _makeNode(id: 'third',  createdAt: DateTime(2026, 1, 3)),
        _makeNode(id: 'first',  createdAt: DateTime(2026, 1, 1)),
        _makeNode(id: 'second', createdAt: DateTime(2026, 1, 2)),
      ];
      final sorted = _sortByPriority(nodes);
      expect(sorted.map((n) => n.id).toList(), ['first', 'second', 'third']);
    });

    test('Earlier due date wins over later due date', () {
      final nodes = [
        _makeNode(id: 'later',   dueDate: DateTime(2026, 6, 1)),
        _makeNode(id: 'earlier', dueDate: DateTime(2026, 4, 1)),
      ];
      final sorted = _sortByPriority(nodes);
      expect(sorted[0].id, 'earlier');
    });
  });

  // ── MALLET SPLIT — METADATA CLONE ────────────────────────

  group('Mallet split — metadata clone', () {
    test('New sibling inherits is_starred from source', () {
      final source = _makeNode(
        id: 'original',
        pebbleId: 'p-original',
        isStarred: true,
      );
      final sibling = source.cloneAsNewSibling(
        newId: 'sibling-id',
        siblingPath: buildPebblePath('mountain-1', 'boulder-1', 'sibling-id'),
      );
      expect(sibling.isStarred, isTrue);
    });

    test('New sibling inherits due_date from source', () {
      final due = DateTime(2026, 4, 1);
      final source = _makeNode(
        id: 'original',
        pebbleId: 'p-original',
        dueDate: due,
      );
      final sibling = source.cloneAsNewSibling(
        newId: 'sibling-id',
        siblingPath: buildPebblePath('mountain-1', 'boulder-1', 'sibling-id'),
      );
      expect(sibling.dueDate, due);
    });

    test('New sibling title is empty', () {
      final source = _makeNode(id: 'original', pebbleId: 'p-original')
          .copyWith(title: 'Important task');
      final sibling = source.cloneAsNewSibling(
        newId: 'sibling-id',
        siblingPath: buildPebblePath('mountain-1', 'boulder-1', 'sibling-id'),
      );
      expect(sibling.title, '');
    });

    test('New sibling is not complete', () {
      final source = _makeNode(id: 'original', pebbleId: 'p-original')
          .copyWith(isComplete: false);
      final sibling = source.cloneAsNewSibling(
        newId: 'sibling-id',
        siblingPath: buildPebblePath('mountain-1', 'boulder-1', 'sibling-id'),
      );
      expect(sibling.isComplete, isFalse);
    });

    test('Original node is unchanged after split', () {
      final source = _makeNode(
        id: 'original',
        pebbleId: 'p-original',
        isStarred: true,
      );
      source.cloneAsNewSibling(
        newId: 'sibling-id',
        siblingPath: buildPebblePath('mountain-1', 'boulder-1', 'sibling-id'),
      );
      expect(source.isStarred, isTrue);
      expect(source.id, 'original');
    });
  });
}
