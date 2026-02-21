"use client";

/** Discrete options for packet quantity instead of a continuous slider.
 * Values align with QTY_STANDARD_VALUES in @/lib/packetQtyLabels. */

const REMAINING_OPTIONS = [
  { value: 100, label: "Full" },
  { value: 50, label: "Half" },
  { value: 25, label: "Low" },
  { value: 0, label: "Empty" },
] as const;

const USED_OPTIONS = [
  { value: 100, label: "Whole" },
  { value: 50, label: "Half" },
  { value: 25, label: "Some" },
] as const;

/** Build used options, adding "All" when maxValue < 100 (use all remaining). */
function getUsedOptions(maxValue: number): { value: number; label: string }[] {
  const base = USED_OPTIONS.filter((o) => o.value <= maxValue);
  if (maxValue >= 100) return [...base];
  const allOpt = { value: maxValue, label: "All" };
  return [allOpt, ...base.filter((o) => o.value < maxValue)];
}

/** Find the option whose value is closest to the given value. */
function closestOption(value: number, options: { value: number }[]): number {
  if (options.length === 0) return value;
  let nearest = options[0].value;
  let minDist = Math.abs(value - options[0].value);
  for (const o of options) {
    const d = Math.abs(value - o.value);
    if (d < minDist) {
      minDist = d;
      nearest = o.value;
    }
  }
  return nearest;
}

interface PacketQtyOptionsProps {
  /** Current value (0–100). */
  value: number;
  /** Called when user selects an option. */
  onChange: (value: number) => void;
  /** "remaining" = packet fullness (Full/Half/Low/Empty). "used" = how much to use when planting (Whole/Half/Some). */
  variant: "remaining" | "used";
  /** For "used" variant: max value (e.g. packet qty_status). Filters options to those <= max. */
  maxValue?: number;
  /** Whether the control is disabled/read-only. */
  disabled?: boolean;
  /** Optional class for the container. */
  className?: string;
}

export function PacketQtyOptions({
  value,
  onChange,
  variant,
  maxValue = 100,
  disabled = false,
  className = "",
}: PacketQtyOptionsProps) {
  const options =
    variant === "remaining"
      ? [...REMAINING_OPTIONS]
      : getUsedOptions(maxValue);

  const handleSelect = (v: number) => {
    if (disabled) return;
    onChange(v);
  };

  return (
    <div className={className}>
      {variant === "used" && (
        <p className="text-xs text-black/60 mb-1.5">
          Amount of packet to use for this planting (not how much is left)
        </p>
      )}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={variant === "remaining" ? "Packet fullness" : "How much to use"}
      >
      {options.map((opt) => {
        const exactMatch = value === opt.value;
        const displaySelected = exactMatch || (options.length > 0 && closestOption(value, options) === opt.value);
        const isSelected = displaySelected;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            disabled={disabled}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isSelected
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
            aria-pressed={isSelected}
            aria-label={`${opt.label} (${opt.value}%)`}
          >
            {opt.label}
          </button>
        );
      })}
      </div>
    </div>
  );
}
