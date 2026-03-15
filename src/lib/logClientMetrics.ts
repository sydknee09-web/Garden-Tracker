/**
 * Structured client-side metrics for heavy operations (e.g. junction table inserts).
 * Logs one JSON line to console (Vercel log streams); no PII, no DB writes.
 * Use for observability of client-side bottlenecks like journal_entry_supplies insert.
 */

export function logClientMetrics(
  action: string,
  durationMs: number,
  extra?: Record<string, unknown>
): void {
  try {
    console.log(
      JSON.stringify({
        client_metric: action,
        duration_ms: durationMs,
        ...extra,
      })
    );
  } catch {
    // no-op if console is unavailable
  }
}
