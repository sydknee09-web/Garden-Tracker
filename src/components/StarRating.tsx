"use client";

interface StarRatingProps {
  value: number | null | undefined;
  /** If true, stars are clickable. If false/omitted, display only. */
  interactive?: boolean;
  onChange?: (rating: number | null) => void;
  size?: "sm" | "md";
  /** Label for screen readers */
  label?: string;
}

/**
 * StarRating — renders 1–5 filled/empty stars.
 * In interactive mode, clicking a star sets the rating; clicking the same star again clears it.
 * In readonly mode, just displays the filled stars.
 */
export function StarRating({ value, interactive = false, onChange, size = "md", label = "Rating" }: StarRatingProps) {
  const starSize = size === "sm" ? "text-base" : "text-xl";
  const btnSize = size === "sm" ? "min-w-[28px] min-h-[28px]" : "min-w-[36px] min-h-[36px]";

  if (!interactive) {
    if (value == null) return <span className="text-neutral-400 text-sm">--</span>;
    return (
      <span className={`inline-flex items-center gap-0.5 ${starSize}`} aria-label={`${value} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < value ? "text-amber-400" : "text-neutral-300"} aria-hidden>
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        const filled = value != null && starValue <= value;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(value === starValue ? null : starValue)}
            className={`${btnSize} flex items-center justify-center ${starSize} rounded transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              filled ? "text-amber-400 hover:text-amber-500" : "text-neutral-300 hover:text-amber-300"
            }`}
            aria-label={`${starValue} star${starValue !== 1 ? "s" : ""}${value === starValue ? " (tap to clear)" : ""}`}
            aria-pressed={filled}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
