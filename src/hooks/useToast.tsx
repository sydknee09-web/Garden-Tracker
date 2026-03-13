"use client";

import { useState, useCallback, useRef } from "react";

const TOAST_DURATION_MS = 2500;

/**
 * Shared toast state hook.
 *
 * Returns { toast, showToast, ToastEl }.
 *
 * Usage:
 *   const { toast, showToast } = useToast();
 *   showToast("Saved!");
 *   // In JSX: {toast}
 *
 * Position: fixed top-20, horizontally centered.
 * Color: bg-emerald-600 (success) or bg-red-600 (error).
 * Duration: 2500ms.
 */
export function useToast(durationMs = TOAST_DURATION_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      timerRef.current = setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  const toast = message ? (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in whitespace-nowrap"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  ) : null;

  return { toast, showToast };
}
