import 'dart:async';

import '../models/mountain.dart';
import '../repositories/mountain_repository.dart';
import 'demo_storage.dart';

/// Demo implementation of MountainRepository using local storage.
class DemoMountainRepository implements MountainRepository {
  final DemoStorage _storage = DemoStorage.instance;

  @override
  Stream<List<Mountain>> watchActive() async* {
    yield _storage.mountains.where((m) => !m.isArchived).toList()
      ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
    await for (final _ in _storage.onChange) {
      yield _storage.mountains.where((m) => !m.isArchived).toList()
        ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
    }
  }

  @override
  Stream<List<Mountain>> watchArchived() async* {
    yield _storage.mountains.where((m) => m.isArchived).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    await for (final _ in _storage.onChange) {
      yield _storage.mountains.where((m) => m.isArchived).toList()
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    }
  }

  @override
  Future<Mountain?> getById(String id) async {
    try {
      return _storage.mountains.firstWhere((m) => m.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<int> countActive() async =>
      _storage.mountains.where((m) => !m.isArchived).length;

  @override
  Future<Mountain> create({
    required String name,
    String? intentStatement,
    String layoutType = 'climb',
    String appearanceStyle = 'slate',
  }) async {
    if (await countActive() >= MountainRepository.maxActive) {
      throw StateError(
        'You are climbing ${MountainRepository.maxActive} mountains. Chronicle one peak before opening a new path.',
      );
    }
    final count = await countActive();
    final m = Mountain(
      id: 'mt-${DateTime.now().millisecondsSinceEpoch}',
      userId: DemoStorage.demoUserId,
      name: name,
      orderIndex: count,
      isArchived: false,
      intentStatement: intentStatement,
      layoutType: layoutType,
      appearanceStyle: appearanceStyle,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    await _storage.addMountain(m);
    return m;
  }

  @override
  Future<void> updateBlueprint({
    required String id,
    String? intentStatement,
    String? layoutType,
    String? appearanceStyle,
  }) async {
    await _storage.updateMountain(id, intentStatement: intentStatement, layoutType: layoutType, appearanceStyle: appearanceStyle);
  }

  @override
  Future<void> rename({required String id, required String name}) async {
    await _storage.updateMountain(id, name: name);
  }

  @override
  Future<void> archive(String id) async {
    await _storage.updateMountain(id, isArchived: true);
  }

  @override
  Future<void> restore(String id) async {
    if (await countActive() >= MountainRepository.maxActive) {
      throw StateError(
        'You are already climbing ${MountainRepository.maxActive} mountains. Chronicle one peak before restoring another.',
      );
    }
    await _storage.updateMountain(id, isArchived: false);
  }

  @override
  Future<int> countIncompleteLeaves(String mountainId) async {
    final nodes = _storage.nodes
        .where((n) => n.mountainId == mountainId && !n.isComplete)
        .toList();
    final leaves = nodes.where((n) =>
        !_storage.nodes.any((c) => c.parentPath == n.path));
    return leaves.length;
  }

  @override
  Future<double> getProgress(String mountainId) async {
    final nodes = _storage.nodes
        .where((n) => n.mountainId == mountainId)
        .toList();
    final leaves = nodes.where((n) =>
        !nodes.any((c) => c.parentPath == n.path));
    if (leaves.isEmpty) return 0.0;
    final complete = leaves.where((l) => l.isComplete).length;
    return complete / leaves.length;
  }
}
