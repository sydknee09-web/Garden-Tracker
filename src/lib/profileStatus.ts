export const PROFILE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "vault", label: "In storage" },
  { value: "active", label: "Active (in garden)" },
  { value: "low_inventory", label: "Low inventory" },
  { value: "archived", label: "Archived" },
];

/** Returns the human-readable label for a given status value. */
export function getProfileStatusLabel(status: string): string {
  return (
    PROFILE_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
