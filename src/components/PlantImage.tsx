"use client";

import Image from "next/image";
import { useState } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";

/** Treat placeholder hero URL as "no image" so we show Seedling fallback (Law 7). */
function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return true;
  const u = url.trim();
  return u === "" || u === "/seedling-icon.svg" || u.endsWith("/seedling-icon.svg");
}

const SIZE_CLASSES = {
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

export type PlantImageSize = keyof typeof SIZE_CLASSES;

export interface PlantImageProps {
  /** Resolved image URL (hero_image_url, hero_image_path, or primary_image_path). Null/placeholder shows fallback. */
  imageUrl: string | null | undefined;
  alt: string;
  size?: PlantImageSize;
  /** Background for fallback: neutral (bg-neutral-50) or emerald (bg-emerald-50/30). */
  variant?: "neutral" | "emerald";
  /** When true, component fills parent (absolute inset-0); use inside a relative aspect-square container. */
  fill?: boolean;
  className?: string;
  /** Optional: called when image fails to load. */
  onError?: () => void;
  /** Optional: called when image loads. */
  onLoad?: () => void;
}

/**
 * Standardized plant profile image with fallback.
 * If imageUrl is null or placeholder, renders ICON_MAP.Seedling (1.5 stroke) centered in a
 * bg-neutral-50 or bg-emerald-50/30 square with rounded-xl. Icon color is muted (text-neutral-400 or soft emerald).
 */
export function PlantImage({
  imageUrl,
  alt,
  size = "md",
  variant = "neutral",
  fill = false,
  className = "",
  onError,
  onLoad,
}: PlantImageProps) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showFallback = !imageUrl || isPlaceholderImageUrl(imageUrl) || errored;

  const fallbackBg = variant === "emerald" ? "bg-emerald-50/30" : "bg-neutral-50";
  const iconColor = variant === "emerald" ? "text-emerald-600/70" : "text-neutral-400";

  const handleError = () => {
    setErrored(true);
    onError?.();
  };

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  if (showFallback) {
    const boxClass = fill
      ? `absolute inset-0 flex items-center justify-center rounded-xl ${fallbackBg} ${className}`
      : `${SIZE_CLASSES[size]} flex items-center justify-center rounded-xl ${fallbackBg} overflow-hidden ${className}`;
    return (
      <div className={boxClass} aria-hidden>
        <ICON_MAP.Seedling className={`${ICON_SIZES[size]} ${iconColor} shrink-0`} />
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className={`object-cover object-center rounded-xl transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
        sizes="(max-width: 768px) 50vw, 200px"
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={imageUrl.startsWith("data:") || !imageUrl.includes("supabase.co")}
      />
    );
  }

  const dim = size === "sm" ? 40 : size === "md" ? 48 : size === "lg" ? 56 : size === "xl" ? 64 : 80;
  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={dim}
      height={dim}
      className={`rounded-xl object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      onError={handleError}
      onLoad={handleLoad}
      unoptimized={imageUrl.startsWith("data:") || !imageUrl.includes("supabase.co")}
    />
  );
}
