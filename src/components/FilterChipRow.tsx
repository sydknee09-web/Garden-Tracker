"use client";

/**
 * Primary filter chip group — Sprint 11.5 canonical primary-filter tier.
 *
 * Single source for the "tap a chip to filter, tap again to clear" primary row
 * that sits above the rich Refine drawer on Library / Packets / Garden. Visual
 * primitive anchored to the existing ShedView category chips (ShedView.tsx:341-355):
 * flat toggle chips, active = emerald-500 STATE token per VISION §8.
 *
 * One <FilterChipGroup> renders one dimension (e.g. plant_category, qty_status).
 * Surfaces compose multiple groups in a wrapping flex row.
 */
export type FilterChip = { value: string; label?: string; count?: number };

export function FilterChipGroup({
  chips,
  selected,
  onSelect,
  ariaLabelPrefix,
}: {
  chips: FilterChip[];
  /** Currently-selected value (null = none). */
  selected: string | null;
  /** Tap handler; receives the chip value, or null when toggling the active chip off. */
  onSelect: (value: string | null) => void;
  /** Prefix for each chip's aria-label, e.g. "Filter by category". */
  ariaLabelPrefix: string;
}) {
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map(({ value, label, count }) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(active ? null : value)}
            aria-pressed={active}
            aria-label={`${ariaLabelPrefix} ${label ?? value}`}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-sm font-medium ${
              active
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-black/10 text-black/70 hover:bg-black/5"
            }`}
          >
            {label ?? value}
            {typeof count === "number" ? ` (${count})` : ""}
          </button>
        );
      })}
    </>
  );
}
