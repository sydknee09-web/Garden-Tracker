"use client";

const SIZE_MAP = {
  sm: 20,
  md: 24,
  lg: 40,
  xl: 48,
} as const;

type Size = keyof typeof SIZE_MAP;

interface PlantPlaceholderIconProps {
  size?: Size;
  className?: string;
}

/** Plant profile placeholder image — replaces sprout emoji for missing hero images. */
export function PlantPlaceholderIcon({ size = "md", className = "" }: PlantPlaceholderIconProps) {
  const px = SIZE_MAP[size];
  return (
    <img
      src="/plant-placeholder.png"
      alt=""
      aria-hidden
      width={px}
      height={px}
      className={`object-contain ${className}`}
    />
  );
}
