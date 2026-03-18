import 'dart:async';

/// Retries [fn] up to [maxAttempts] times with exponential backoff.
/// Only retries on transient failures: TimeoutException and errors
/// indicating connection/network issues. Platform-agnostic (no dart:io).
Future<T> retryWithBackoff<T>(
  Future<T> Function() fn, {
  int maxAttempts = 3,
  Duration initialDelay = const Duration(milliseconds: 500),
}) async {
  var attempt = 0;
  var delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (e, _) {
      attempt++;
      if (attempt >= maxAttempts) rethrow;

      if (!_isRetryable(e)) rethrow;

      await Future.delayed(delay);
      delay = Duration(
        milliseconds: delay.inMilliseconds * 2,
      );
    }
  }
}

bool _isRetryable(Object e) {
  if (e is TimeoutException) return true;

  final msg = e.toString().toLowerCase();
  if (msg.contains('socket') ||
      msg.contains('connection') ||
      msg.contains('network') ||
      msg.contains('host') ||
      msg.contains('timeout') ||
      msg.contains('unreachable') ||
      msg.contains('refused')) {
    return true;
  }

  return false;
}
