"use client";

import { useState, useCallback, useRef } from "react";
import { isSuccessSoundEnabled, playSuccessSound } from "@/lib/successSound";

const TOAST_DURATION_MS = 2500;

export type ToastVariant = "success" | "error";

/**
 * Shared toast state hook.
 *
 * Returns { toast, showToast, showErrorToast }.
 *
 * Usage:
 *   const { toast, showToast, showErrorToast } = useToast();
 *   showToast("Saved!");
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string, v: ToastVariant = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setVariant(v);
      if (v === "success" && isSuccessSoundEnabled()) playSuccessSound();
      timerRef.current = setTimeout(() => {
        setMessage(null);
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
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg animate-fade-in whitespace-nowrap ${
        variant === "error" ? "bg-amber-600" : "bg-emerald-600"
      }`}
      role="status"
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {message}
    </div>
  ) : null;

  return { toast, showToast, showErrorToast };
}
