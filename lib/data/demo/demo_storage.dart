import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import '../models/mountain.dart';
import '../models/node.dart';
import '../models/whetstone_item.dart';
import '../../core/enums/node_type.dart';
import '../repositories/whetstone_repository.dart';

const _keyMountains = 'demo_mountains';
const _keyNodes = 'demo_nodes';
const _keyWhetstoneItems = 'demo_whetstone_items';
const _keyWhetstoneCompletions = 'demo_whetstone_completions';
const _keySatchelSlots = 'demo_satchel_slots';

/// In-memory storage for demo mode, persisted to shared_preferences.
/// All mutations notify [_changeController] so streams can emit updates.
class DemoStorage {
  DemoStorage._();
  static final DemoStorage _instance = DemoStorage._();
  static DemoStorage get instance => _instance;

  final StreamController<void> _changeController =
      StreamController<void>.broadcast();
  Stream<void> get onChange => _changeController.stream;

  void _notify() => _changeController.add(null);

  List<Mountain> _mountains = [];
  List<Node> _nodes = [];
  List<WhetstoneItem> _whetstoneItems = [];
  List<Map<String, String>> _whetstoneCompletions =
      []; // item_id, completed_date, completed_at
  List<Map<String, dynamic>> _satchelSlots = [];

  static const String demoUserId = 'demo-user-id';

  /// Load from shared_preferences. Call once at startup when entering demo mode.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _mountains = _parseMountains(prefs.getString(_keyMountains));
    _nodes = _parseNodes(prefs.getString(_keyNodes));
    _whetstoneItems = _parseWhetstoneItems(prefs.getString(_keyWhetstoneItems));
    _whetstoneCompletions = _parseCompletions(
      prefs.getString(_keyWhetstoneCompletions),
    );
    _satchelSlots = _parseSlots(prefs.getString(_keySatchelSlots));

    if (_mountains.isEmpty && _nodes.isEmpty) {
      await _seedInitialData();
    }
  }

  /// Seeds starter data in memory only — no SharedPreferences. Use when load() would hang
  /// (e.g. escape hatch, SKIP_AUTH). Caller must ensure demoModeProvider is updated.
  void seedInMemoryOnly() {
    if (_mountains.isNotEmpty || _nodes.isNotEmpty) return;
    _whetstoneItems = WhetstoneRepository.starterHabits
        .asMap()
        .entries
        .map(
          (e) => WhetstoneItem(
            id: 'wh-${e.key}',
            userId: demoUserId,
            title: e.value,
            orderIndex: e.key,
            isActive: true,
            createdAt: DateTime.now(),
          ),
        )
        .toList();
    _satchelSlots = List.generate(
      6,
      (i) => {
        'id': 'slot-${i + 1}',
        'user_id': demoUserId,
        'slot_index': i + 1,
        'node_id': null,
        'packed_at': DateTime.now().toIso8601String(),
        'ready_to_burn': false,
      },
    );
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _keyMountains,
      jsonEncode(_mountains.map((m) => m.toJson()).toList()),
    );
    await prefs.setString(
      _keyNodes,
      jsonEncode(_nodes.map((n) => n.toJson()).toList()),
    );
    await prefs.setString(
      _keyWhetstoneItems,
      jsonEncode(_whetstoneItems.map((w) => w.toJson()).toList()),
    );
    await prefs.setString(
      _keyWhetstoneCompletions,
      jsonEncode(_whetstoneCompletions),
    );
    await prefs.setString(_keySatchelSlots, jsonEncode(_satchelSlots));
  }

  List<Mountain> _parseMountains(String? raw) {
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => Mountain.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  List<Node> _parseNodes(String? raw) {
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => Node.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  List<WhetstoneItem> _parseWhetstoneItems(String? raw) {
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => WhetstoneItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  List<Map<String, String>> _parseCompletions(String? raw) {
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => Map<String, String>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  List<Map<String, dynamic>> _parseSlots(String? raw) {
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _seedInitialData() async {
    _whetstoneItems = WhetstoneRepository.starterHabits
        .asMap()
        .entries
        .map(
          (e) => WhetstoneItem(
            id: 'wh-${e.key}',
            userId: demoUserId,
            title: e.value,
            orderIndex: e.key,
            isActive: true,
            createdAt: DateTime.now(),
          ),
        )
        .toList();

    _satchelSlots = List.generate(
      6,
      (i) => {
        'id': 'slot-${i + 1}',
        'user_id': demoUserId,
        'slot_index': i + 1,
        'node_id': null,
        'packed_at': DateTime.now().toIso8601String(),
        'ready_to_burn': false,
      },
    );

    await _persist();
  }

  // ── Mountains ───────────────────────────────────────────────

  List<Mountain> get mountains => List.unmodifiable(_mountains);

  Future<void> addMountain(Mountain m) async {
    _mountains.add(m);
    await _persist();
    _notify();
  }

  Future<void> updateMountain(
    String id, {
    String? name,
    bool? isArchived,
    String? intentStatement,
    String? reflectionWhyPeak,
    String? reflectionPackJourney,
    String? layoutType,
    String? appearanceStyle,
  }) async {
    final i = _mountains.indexWhere((m) => m.id == id);
    if (i < 0) return;
    var m = _mountains[i];
    if (name != null) m = m.copyWith(name: name);
    if (isArchived != null) m = m.copyWith(isArchived: isArchived);
    if (intentStatement != null) {
      m = m.copyWith(intentStatement: intentStatement);
    }
    if (reflectionWhyPeak != null) {
      m = m.copyWith(reflectionWhyPeak: reflectionWhyPeak);
    }
    if (reflectionPackJourney != null) {
      m = m.copyWith(reflectionPackJourney: reflectionPackJourney);
    }
    if (layoutType != null) m = m.copyWith(layoutType: layoutType);
    if (appearanceStyle != null) {
      m = m.copyWith(appearanceStyle: appearanceStyle);
    }
    _mountains[i] = m;
    await _persist();
    _notify();
  }

  int get activeMountainCount => _mountains.where((m) => !m.isArchived).length;

  // ── Nodes ───────────────────────────────────────────────────

  List<Node> get nodes => List.unmodifiable(_nodes);

  List<Node> nodesForMountain(String mountainId) =>
      _nodes.where((n) => n.mountainId == mountainId).toList()
        ..sort((a, b) => a.path.compareTo(b.path));

  Future<void> addNode(Node n) async {
    _nodes.add(n);
    await _persist();
    _notify();
  }

  Future<void> updateNode(
    String id, {
    String? title,
    bool? isStarred,
    DateTime? dueDate,
    bool? isComplete,
    DateTime? completedAt,
    bool? isPendingRitual,
    bool? isArchived,
  }) async {
    final i = _nodes.indexWhere((n) => n.id == id);
    if (i < 0) return;
    var n = _nodes[i];
    if (title != null) n = n.copyWith(title: title);
    if (isStarred != null) n = n.copyWith(isStarred: isStarred);
    if (dueDate != null) n = n.copyWith(dueDate: dueDate);
    if (isComplete != null) {
      n = n.copyWith(isComplete: isComplete, completedAt: completedAt);
    }
    if (isPendingRitual != null) {
      n = n.copyWith(isPendingRitual: isPendingRitual);
    }
    if (isArchived != null) n = n.copyWith(isArchived: isArchived);
    _nodes[i] = n;
    await _persist();
    _notify();
  }

  Future<void> deleteNode(String id) async {
    _nodes.removeWhere((n) => n.id == id);
    await _persist();
    _notify();
  }

  Future<void> deleteNodesWhere(bool Function(Node) test) async {
    _nodes.removeWhere(test);
    await _persist();
    _notify();
  }

  List<DateTime> get burnTimestamps => _nodes
      .where(
        (n) =>
            (n.nodeType == NodeType.pebble || n.nodeType == NodeType.shard) &&
            n.isComplete &&
            n.completedAt != null,
      )
      .map((n) => n.completedAt!)
      .toList();

  List<DateTime> burnTimestampsForMountain(String mountainId) => _nodes
      .where(
        (n) =>
            n.mountainId == mountainId &&
            (n.nodeType == NodeType.pebble || n.nodeType == NodeType.shard) &&
            n.isComplete &&
            n.completedAt != null,
      )
      .map((n) => n.completedAt!)
      .toList();

  // ── Whetstone ───────────────────────────────────────────────

  List<WhetstoneItem> get whetstoneItems =>
      List.unmodifiable(_whetstoneItems.where((w) => w.isActive));

  Future<void> addWhetstoneItem(WhetstoneItem w) async {
    _whetstoneItems.add(w);
    await _persist();
    _notify();
  }

  Future<void> updateWhetstoneItem(
    String id, {
    String? title,
    int? orderIndex,
    bool? isActive,
  }) async {
    final i = _whetstoneItems.indexWhere((w) => w.id == id);
    if (i < 0) return;
    var w = _whetstoneItems[i];
    if (title != null) w = w.copyWith(title: title);
    if (orderIndex != null) w = w.copyWith(orderIndex: orderIndex);
    if (isActive != null) w = w.copyWith(isActive: isActive);
    _whetstoneItems[i] = w;
    await _persist();
    _notify();
  }

  Future<void> reorderWhetstoneItems(List<String> orderedIds) async {
    for (var i = 0; i < orderedIds.length; i++) {
      final idx = _whetstoneItems.indexWhere((w) => w.id == orderedIds[i]);
      if (idx >= 0) {
        _whetstoneItems[idx] = _whetstoneItems[idx].copyWith(orderIndex: i);
      }
    }
    _whetstoneItems.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
    await _persist();
    _notify();
  }

  Set<String> completedItemIdsForDate(String dateString) {
    return _whetstoneCompletions
        .where((c) => c['completed_date'] == dateString)
        .map((c) => c['item_id']!)
        .toSet();
  }

  Future<void> addCompletion(
    String itemId,
    String dateString,
    String completedAt,
  ) async {
    _whetstoneCompletions.removeWhere(
      (c) => c['item_id'] == itemId && c['completed_date'] == dateString,
    );
    _whetstoneCompletions.add({
      'item_id': itemId,
      'completed_date': dateString,
      'completed_at': completedAt,
    });
    await _persist();
    _notify();
  }

  Future<void> removeCompletion(String itemId, String dateString) async {
    _whetstoneCompletions.removeWhere(
      (c) => c['item_id'] == itemId && c['completed_date'] == dateString,
    );
    await _persist();
    _notify();
  }

  List<DateTime> get whetstoneCompletionTimestamps => _whetstoneCompletions
      .map((c) => DateTime.parse(c['completed_at']!).toLocal())
      .toList();

  // ── Satchel ──────────────────────────────────────────────────

  List<Map<String, dynamic>> get satchelSlotsRaw =>
      List.unmodifiable(_satchelSlots);

  Future<void> setSatchelSlots(List<Map<String, dynamic>> slots) async {
    _satchelSlots = slots;
    await _persist();
    _notify();
  }

  Future<void> updateSatchelSlot(
    String slotId, {
    String? nodeId,
    bool? readyToBurn,
  }) async {
    final i = _satchelSlots.indexWhere((s) => s['id'] == slotId);
    if (i < 0) return;
    if (nodeId != null) _satchelSlots[i]['node_id'] = nodeId;
    if (readyToBurn != null) _satchelSlots[i]['ready_to_burn'] = readyToBurn;
    _satchelSlots[i]['packed_at'] = DateTime.now().toIso8601String();
    await _persist();
    _notify();
  }

  Future<void> clearSatchelSlot(String slotId) async {
    final i = _satchelSlots.indexWhere((s) => s['id'] == slotId);
    if (i < 0) return;
    _satchelSlots[i]['node_id'] = null;
    _satchelSlots[i]['ready_to_burn'] = false;
    _satchelSlots[i]['packed_at'] = DateTime.now().toIso8601String();
    await _persist();
    _notify();
  }

  void dispose() {
    _changeController.close();
  }
}
