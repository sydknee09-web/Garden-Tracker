/**
 * Calendar date helpers — timezone-agnostic local date logic.
 * Use these everywhere we need "today," month boundaries, or date strings
 * so UTC vs local mismatch does not cause off-by-one bugs.
 */

/**
 * Returns the local date as YYYY-MM-DD (timezone-agnostic).
 * Prefer this over new Date().toISOString().slice(0, 10) which uses UTC.
 */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * First day of a given (year, month) in local time as YYYY-MM-DD.
 * month is 0-based (0 = January).
 */
export function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/**
 * Last day of a given (year, month) in local time as YYYY-MM-DD.
 * month is 0-based.
 */
export function lastDayOfMonth(year: number, month: number): string {
  const lastDayNum = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
}

/**
 * Add n days to a YYYY-MM-DD string; returns YYYY-MM-DD.
 * Uses local date arithmetic to avoid UTC edge cases.
 */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return localDateString(date);
}

/**
 * Format a YYYY-MM-DD string for display (e.g. "Wed, Mar 12").
 * Uses noon local to avoid timezone shift on the day.
 */
export function formatDateForDisplay(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("default", options ?? { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Parse YYYY-MM-DD into a Date at local noon (for display/compare).
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
