/**
 * Shared request validation limits for API routes.
 * Use before parsing body where possible (e.g. Content-Length) to avoid processing oversized payloads.
 */

export const MAX_URL_LENGTH = 2048;
export const MAX_BODY_BYTES = 1_048_576; // 1MB
export const MAX_URLS_ARRAY_LENGTH = 50; // batch-import

/**
 * If Content-Length header exceeds MAX_BODY_BYTES, return { error } for 400 response; otherwise null.
 * Call before request.json() when you want to reject oversized bodies early.
 */
export function checkContentLength(request: Request): { error: string } | null {
  const raw = request.headers.get("content-length");
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n <= MAX_BODY_BYTES) return null;
  return { error: "Request body too large" };
}
