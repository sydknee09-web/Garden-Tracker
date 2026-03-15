/**
 * Structured request metrics for heavy API routes. Logs one JSON line to console
 * (Vercel log streams); no PII, no DB writes. Use in a finally block so duration
 * and status are always recorded even when the handler throws.
 */

export type RequestMetricsStatus = "ok" | "error";

export function logRequestMetrics(
  routeId: string,
  durationMs: number,
  statusCode: number,
  extra?: Record<string, unknown>
): void {
  const status: RequestMetricsStatus = statusCode >= 400 ? "error" : "ok";
  const payload = {
    route: routeId,
    duration_ms: durationMs,
    status,
    status_code: statusCode,
    ...extra,
  };
  try {
    console.log(JSON.stringify(payload));
  } catch {
    // no-op if console is unavailable
  }
}
