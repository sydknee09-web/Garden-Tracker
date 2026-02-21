/**
 * Supply profile utilities for the Shed (Supplies Vault).
 */

/** Extracted N-P-K values for display. */
export type NpkParsed = { n: number; p: number; k: number };

/**
 * Extract first three numbers from raw NPK string for "N 5% | P 1% | K 1%" badges.
 * Handles: "5-1-1", "10-10-10 (Organic)", "Total Nitrogen: 5%", etc.
 * Returns null if parse fails → caller should show raw string.
 */
export function parseNpkForDisplay(raw: string | null | undefined): NpkParsed | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const numbers = trimmed.match(/\d+/g);
  if (!numbers || numbers.length < 3) return null;

  const n = parseInt(numbers[0]!, 10);
  const p = parseInt(numbers[1]!, 10);
  const k = parseInt(numbers[2]!, 10);

  if (Number.isNaN(n) || Number.isNaN(p) || Number.isNaN(k)) return null;
  if (n < 0 || p < 0 || k < 0) return null;

  return { n, p, k };
}
