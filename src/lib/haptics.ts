/**
 * Tactile feedback via Vibration API.
 * Works on Android Chrome PWA. Degrades gracefully on unsupported devices (iOS Safari).
 */

export function hapticSuccess(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function hapticError(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
  }
}
