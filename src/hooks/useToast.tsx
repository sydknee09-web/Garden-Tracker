"use client";

import { useState, useCallback, useRef } from "react";
import { isSuccessSoundEnabled, playSuccessSound } from "@/lib/successSound";

const TOAST_DURATION_MS = 2500;

export type ToastVariant = "success" | "error";

export type ToastOptions = {
  variant?: ToastVariant;
  /** Optional emoji or character to show before the message (e.g. "🌱" for seedling) */
  icon?: string;
};

/**
 * Shared toast state hook.
 *
 * Returns { toast, showToast, showErrorToast }.
 *
 * Usage:
 *   const { toast, showToast, showErrorToast } = useToast();
 *   showToast("Saved!");
 *   showToast("Your garden is ready!", { icon: "🌱" });
 *   showErrorToast("Something went wrong. Try again.");
 *
 * Position: fixed top-20, horizontally centered.
 * Success: bg-emerald-600, plays success sound when enabled.
 * Error: bg-amber-600, no sound.
 * Duration: 2500ms.
 */
export function useToast(durationMs = TOAST_DURATION_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<ToastVariant>("success");
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string, options: ToastVariant | ToastOptions = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const opts = typeof options === "string" ? { variant: options as ToastVariant } : options;
      setMessage(msg);
      setVariant(opts.variant ?? "success");
      setIcon(opts.icon);
      if ((opts.variant ?? "success") === "success" && isSuccessSoundEnabled()) playSuccessSound();
      timerRef.current = setTimeout(() => {
        setMessage(null);
        setIcon(undefined);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  const showErrorToast = useCallback(
    (msg: string) => showToast(msg, "error"),
    [showToast]
  );

  const toast = message ? (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg animate-fade-in flex items-center gap-2 ${
        variant === "error" ? "bg-amber-600" : "bg-emerald-600"
      }`}
      role="status"
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {icon && <span aria-hidden>{icon}</span>}
      <span className={icon ? "" : "whitespace-nowrap"}>{message}</span>
    </div>
  ) : null;

  return { toast, showToast, showErrorToast };
}
