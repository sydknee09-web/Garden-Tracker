/**
 * Standard error copy for add/create flows (seed, plant, supply, task, journal, etc.).
 * Use for save/insert/API failures; keep validation messages (e.g. "Title is required") as-is.
 */

export const ADD_FLOW_ERROR_PRIMARY = "Something went wrong. Try again.";

const MAX_DETAIL_LENGTH = 120;
const UNSAFE_PATTERNS = [/file:\/\//i, /\/[\w-]+\/[\w-]+\.(tsx?|jsx?|mjs)/, /at\s+\S+\s+\(/];

function isSafeDetail(msg: string): boolean {
  const trimmed = msg.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DETAIL_LENGTH) return false;
  return !UNSAFE_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Returns the standard add-flow error message, optionally with safe detail from a caught error.
 * Use for DB/insert/API failures. For validation (e.g. "Select a variety"), set the specific message directly.
 */
export function formatAddFlowError(err: unknown): string {
  const detail =
    err instanceof Error ? err.message : typeof err === "string" ? err : null;
  if (!detail?.trim() || !isSafeDetail(detail)) {
    return ADD_FLOW_ERROR_PRIMARY;
  }
  const oneLine = detail.trim().split(/\n/)[0]!.slice(0, MAX_DETAIL_LENGTH);
  return `${ADD_FLOW_ERROR_PRIMARY} ${oneLine}`;
}
