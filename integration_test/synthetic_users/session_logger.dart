import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Event model for synthetic user session logging.
class SessionEvent {
  SessionEvent({
    required this.timestampMs,
    this.deltaMs,
    required this.screen,
    required this.action,
    required this.target,
    required this.success,
    this.note,
    required this.personaId,
    this.collision,
  });

  final int timestampMs;
  final int? deltaMs;
  final String screen;
  final String action;
  final String target;
  final bool success;
  final String? note;
  final String personaId;
  final VisualCollision? collision;

  Map<String, dynamic> toJson() => {
        'timestamp_ms': timestampMs,
        if (deltaMs != null) 'delta_ms': deltaMs,
        'screen': screen,
        'action': action,
        'target': target,
        'success': success,
        if (note != null) 'note': note,
        'persona_id': personaId,
        if (collision != null) 'collision': collision!.toJson(),
      };
}

/// Visual collision event: element obscured or off-screen.
class VisualCollision {
  VisualCollision({
    required this.type,
    this.obstructer,
    this.bounds,
  });

  final String type; // 'obscured' | 'overflow'
  final String? obstructer;
  final Map<String, dynamic>? bounds;

  Map<String, dynamic> toJson() => {
        'type': type,
        if (obstructer != null) 'obstructer': obstructer,
        if (bounds != null) 'bounds': bounds,
      };
}

/// Logs session events with delta time and optional collision detection.
class SessionLogger {
  SessionLogger({
    required this.personaId,
  });

  final String personaId;
  final List<SessionEvent> _events = [];
  int? _lastTimestampMs;

  List<SessionEvent> get events => List.unmodifiable(_events);

  void log({
    required String screen,
    required String action,
    required String target,
    required bool success,
    String? note,
    VisualCollision? collision,
  }) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final deltaMs = _lastTimestampMs != null ? now - _lastTimestampMs! : null;
    _lastTimestampMs = now;

    _events.add(SessionEvent(
      timestampMs: now,
      deltaMs: deltaMs,
      screen: screen,
      action: action,
      target: target,
      success: success,
      note: note,
      personaId: personaId,
      collision: collision,
    ));
  }

  /// Write session log to JSON file. On device (integration test), uses app temp dir.
  /// Also attempts to write to external Downloads so adb pull can retrieve after uninstall.
  Future<String> writeToFile() async {
    Directory dir;
    try {
      final appDir = await getTemporaryDirectory();
      dir = Directory('${appDir.path}/voyager_sanctuary_logs');
    } catch (_) {
      dir = Directory('integration_test/synthetic_users/output');
    }
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-').split('.').first;
    final path = '${dir.path}/${personaId}_$timestamp.json';
    final jsonStr = const JsonEncoder.withIndent('  ').convert({
      'persona_id': personaId,
      'session_start': _events.isNotEmpty ? _events.first.timestampMs : null,
      'session_end': _lastTimestampMs,
      'duration_ms': _lastTimestampMs != null && _events.isNotEmpty
          ? _lastTimestampMs! - _events.first.timestampMs
          : null,
      'events': _events.map((e) => e.toJson()).toList(),
    });
    final file = File(path);
    await file.writeAsString(jsonStr);

    // Best-effort: copy to shared storage for adb pull (survives app uninstall)
    if (Platform.isAndroid) {
      try {
        final pullDir = Directory('/sdcard/Download/voyager_sanctuary_logs');
        await pullDir.create(recursive: true);
        await File('${pullDir.path}/${personaId}_$timestamp.json').writeAsString(jsonStr);
      } catch (_) {}
    }

    return path;
  }

  void clear() {
    _events.clear();
    _lastTimestampMs = null;
  }
}
