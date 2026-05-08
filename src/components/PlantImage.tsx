"use client";

import Image from "next/image";
import { useState } from "react";

const PLANT_PLACEHOLDER = "/plant-placeholder.png";

/** Treat placeholder hero URL as "no image" so we render the plant-placeholder fallback (Law 7). Recognizes both legacy /seedling-icon.svg and current /plant-placeholder.png. */
function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return true;
  const u = url.trim();
  return (
    u === "" ||
    u === "/seedling-icon.svg" ||
    u.endsWith("/seedling-icon.svg") ||
    u === PLANT_PLACEHOLDER ||
    u.endsWith(PLANT_PLACEHOLDER)
  );
}

const SIZE_CLASSES = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-14 h-14",
  xl: "w-16 h-16",
  "2xl": "w-20 h-20",
} as const;

export type PlantImageSize = keyof typeof SIZE_CLASSES;

export interface PlantImageProps {
  /** Resolved image URL (hero_image_url, hero_image_path, or primary_image_path). Null/placeholder shows fallback. */
  imageUrl: string | null | undefined;
  alt: string;
  size?: PlantImageSize;
  /** Background for fallback container. Both variants now use a soft wash so the plant-placeholder PNG reads cleanly. */
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
 * If imageUrl is null or placeholder, renders /plant-placeholder.png centered in a soft container.
 * Otherwise renders the real image.
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

  // White matches the placeholder PNG's background so there's no visible seam.
  const fallbackBg = variant === "emerald" ? "bg-emerald-50/30" : "bg-white";

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
        <img src={PLANT_PLACEHOLDER} alt="" className="w-full h-full object-contain p-1" />
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
