import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

/// Centralized audio service using just_audio for web stability.
/// Migrates scroll sounds first; other sounds can follow incrementally.
class AppAudioService {
  AppAudioService._();
  static final AppAudioService instance = AppAudioService._();

  AudioPlayer? _scrollPlayer;
  Timer? _scrollFadeTimer;

  AudioPlayer get _scroll => _scrollPlayer ??= AudioPlayer();

  /// Plays scroll_open. Limits to 2s; at 1.5s fades volume to 0 over 500ms, then stops.
  Future<void> playScrollOpen() async {
    await _scroll.stop();
    _scrollFadeTimer?.cancel();

    try {
      await _scroll.setAsset('assets/sounds/scroll_open.mp3');
    } catch (_) {
      try {
        await _scroll.setAsset('assets/sounds/scroll_open.wav');
      } catch (e) {
        if (kDebugMode) debugPrint('AppAudioService: scroll_open not found: $e');
        return;
      }
    }

    final rate = 0.95 + (DateTime.now().millisecondsSinceEpoch % 11) / 100;
    await _scroll.setSpeed(rate);
    await _scroll.setVolume(1.0);
    await _scroll.play();

    _scrollFadeTimer = Timer(const Duration(milliseconds: 1500), () async {
      if (!_scroll.playing) return;
      const steps = 10;
      const stepMs = 50;
      for (var i = 1; i <= steps; i++) {
        if (!_scroll.playing) break;
        await Future.delayed(const Duration(milliseconds: stepMs));
        if (!_scroll.playing) break;
        final v = 1.0 - (i / steps);
        await _scroll.setVolume(v);
      }
      await _scroll.stop();
    });
  }

  /// Plays scroll_close when leaving the Map. Fire-and-forget.
  Future<void> playScrollClose() async {
    _scrollFadeTimer?.cancel();
    await _scroll.stop();

    try {
      await _scroll.setAsset('assets/sounds/scroll_close.wav');
    } catch (_) {
      try {
        await _scroll.setAsset('assets/sounds/scroll_close.mp3');
      } catch (e) {
        if (kDebugMode) debugPrint('AppAudioService: scroll_close not found: $e');
        return;
      }
    }

    await _scroll.setVolume(1.0);
    await _scroll.play();
  }

  /// Stops scroll audio (e.g. on dispose). Call when leaving scroll route.
  Future<void> stopScroll() async {
    _scrollFadeTimer?.cancel();
    await _scroll.stop();
  }

  /// Dispose scroll player. Call from app shutdown if needed.
  Future<void> dispose() async {
    _scrollFadeTimer?.cancel();
    await _scroll.dispose();
    _scrollPlayer = null;
  }
}
