/**
 * Standard qty_status values: Full=100, Half=50, Low=25, Empty=0.
 * Used across PacketQtyOptions, plant flows, and display.
 */
export const QTY_STANDARD_VALUES = [100, 50, 25, 0] as const;

const REMAINING_LABELS: Record<number, string> = {
  100: "Full",
  50: "Half",
  25: "Low",
  0: "Empty",
};

const USED_LABELS: Record<number, string> = {
  100: "Whole",
  50: "Half",
  25: "Some",
};

/**
 * Maps qty_status (0–100) to human-readable label for display.
 * Standard values use labels; others fall back to "X%".
 */
export function qtyStatusToLabel(value: number): string {
  const v = Math.round(value);
  if (REMAINING_LABELS[v] !== undefined) return REMAINING_LABELS[v];
  return `${v}%`;
}

/**
 * Maps percent-used (0–100) to label for "how much did you use" context.
 * Used in PacketPickerModal summary etc.
 */
export function usedPercentToLabel(value: number): string {
  const v = Math.round(value);
  if (USED_LABELS[v] !== undefined) return USED_LABELS[v];
  return `${v}%`;
}
