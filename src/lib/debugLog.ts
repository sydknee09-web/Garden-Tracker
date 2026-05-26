/**
 * Lightweight client-side telemetry into the sessionStorage debug buffer.
 * Parallels src/lib/apiErrorLog.ts (bracket-prefix format).
 *
 * Privacy: payload shape only (counts, ids, table, op, ms, error.message).
 * Never log payload content (user data, notes, plant names).
 */
export function logEvent(
  scope: string,
  action: string,
  payload?: Record<string, unknown>,
): void {
  try {
    console.log(`[${scope}] ${action}`, payload ?? {});
  } catch {
    // Never let logging crash the app
  }
}
