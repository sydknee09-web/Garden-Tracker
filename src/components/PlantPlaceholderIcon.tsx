"use client";

const SIZE_MAP = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-14 h-14",
  xl: "w-16 h-16",
  "2xl": "w-20 h-20",
} as const;

type Size = keyof typeof SIZE_MAP;

interface PlantPlaceholderIconProps {
  size?: Size;
  className?: string;
  /** Background tint: neutral (bg-neutral-50) or emerald (bg-emerald-50/30). */
  variant?: "neutral" | "emerald";
}

/**
 * Plant profile placeholder — standardized fallback when no hero image.
 * Renders the /plant-placeholder.png asset centered in a soft container with rounded-xl.
 */
export function PlantPlaceholderIcon({ size = "md", className = "", variant = "neutral" }: PlantPlaceholderIconProps) {
  // White matches the placeholder PNG's background so there's no visible seam.
  const bg = variant === "emerald" ? "bg-emerald-50/30" : "bg-white";
  return (
    <div
      className={`${SIZE_MAP[size]} flex items-center justify-center rounded-xl ${bg} overflow-hidden ${className}`}
      aria-hidden
    >
      <img src="/plant-placeholder.png" alt="" className="w-full h-full object-contain p-1" />
    </div>
  );
}
