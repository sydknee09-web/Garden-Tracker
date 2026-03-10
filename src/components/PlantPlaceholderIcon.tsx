"use client";

import { ICON_MAP } from "@/lib/styleDictionary";

const SIZE_MAP = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-14 h-14",
  xl: "w-16 h-16",
  "2xl": "w-20 h-20",
} as const;

const ICON_SIZES = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-10 h-10",
  "2xl": "w-12 h-12",
} as const;

type Size = keyof typeof SIZE_MAP;

interface PlantPlaceholderIconProps {
  size?: Size;
  className?: string;
  /** Use emerald tint for fallback background (e.g. garden cards). */
  variant?: "neutral" | "emerald";
}

/**
 * Plant profile placeholder — standardized fallback when no hero image.
 * Renders ICON_MAP.Seedling (1.5 stroke) centered in bg-neutral-50 or bg-emerald-50/30,
 * rounded-xl, muted icon color (text-neutral-400 or soft emerald).
 */
export function PlantPlaceholderIcon({ size = "md", className = "", variant = "neutral" }: PlantPlaceholderIconProps) {
  const bg = variant === "emerald" ? "bg-emerald-50/30" : "bg-neutral-50";
  const iconColor = variant === "emerald" ? "text-emerald-600/70" : "text-neutral-400";
  return (
    <div
      className={`${SIZE_MAP[size]} flex items-center justify-center rounded-xl ${bg} overflow-hidden ${className}`}
      aria-hidden
    >
      <ICON_MAP.Seedling className={`${ICON_SIZES[size]} ${iconColor} shrink-0`} />
    </div>
  );
}
