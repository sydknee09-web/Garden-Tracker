/**
 * Centralized API error logging. Use in route handlers for consistent error reporting.
 */
export function logApiError(route: string, error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[API ${route}]`, message, context ?? {}, stack);
}
