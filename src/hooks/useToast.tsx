"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { isSuccessSoundEnabled, playSuccessSound } from "@/lib/successSound";
import { logEvent } from "@/lib/debugLog";

const TOAST_DURATION_MS = 2500;

/**
 * Undo window for deferred-commit (swipe-complete) flows. The row is removed optimistically and the
 * real DB write fires when this window closes; tapping Undo within it cancels the write entirely.
 * 5s per Syd dogfood lock 2026-06-01 (Material actionable-snackbar guidance is 4–10s).
 */
export const UNDO_WINDOW_MS = 5000;

export type ToastVariant = "success" | "error";

export type ToastAction = {
  /** Button label, e.g. "Undo" (Title Case per casing convention). */
  label: string;
  /** Fired when the action button is tapped. Cancels the pending auto-dismiss (no commit). */
  onAction: () => void;
};

export type ToastOptions = {
  variant?: ToastVariant;
  /** Optional emoji or character to show before the message (e.g. "🌱" for seedling) */
  icon?: string;
  /** Right-aligned inline action button (e.g. Undo). When set, tapping it fires onAction and suppresses onAutoDismiss. */
  action?: ToastAction;
  /** Per-call duration override (ms). Defaults to the hook's durationMs. */
  durationMs?: number;
  /**
   * Fired when the toast auto-dismisses — timer expiry, being replaced by a newer toast, or unmount —
   * but NOT when the action button is tapped. This is the deferred-COMMIT trigger for undo flows:
   * the real DB write lives here so tapping Undo (which cancels it) never has to reverse a write.
   */
  onAutoDismiss?: () => void;
};

/**
 * Shared toast / snackbar state hook.
 *
 * Returns { toast, showToast, showErrorToast }.
 *
 * Usage:
 *   const { toast, showToast, showErrorToast } = useToast();
 *   showToast("Saved!");
 *   showToast("Your garden is ready!", { icon: "🌱" });
 *   showErrorToast("Something went wrong. Try again.");
 *
 * Deferred-commit (undo) usage — the actual write happens on onAutoDismiss, so Undo never reverses a write:
 *   setItems((prev) => prev.filter((i) => i.id !== item.id));   // optimistic remove
 *   showToast("Marked as purchased", {
 *     durationMs: 5000,
 *     action: { label: "Undo", onAction: () => setItems((prev) => restore(prev)) },
 *     onAutoDismiss: () => commitToDb(),
 *   });
 *
 * Position: fixed top-20, horizontally centered.
 * Success: bg-emerald-600, plays success sound when enabled.
 * Error: bg-amber-600, no sound.
 * Duration: 2500ms (override per-call via options.durationMs).
 */
export function useToast(durationMs = TOAST_DURATION_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<ToastVariant>("success");
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<ToastAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissRef = useRef<(() => void) | null>(null);

  const hide = useCallback(() => {
    setMessage(null);
    setIcon(undefined);
    setAction(null);
  }, []);

  /** Clear the timer and run any pending auto-dismiss (= commit the deferred action). */
  const flushPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const fn = autoDismissRef.current;
    autoDismissRef.current = null;
    if (fn) fn();
  }, []);

  /** Clear the timer WITHOUT running the pending auto-dismiss (= cancel the deferred action; used by Undo). */
  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    autoDismissRef.current = null;
  }, []);

  const showToast = useCallback(
    (msg: string, options: ToastVariant | ToastOptions = "success") => {
      // Replacing a toast commits any prior deferred action before showing the new one
      // (single-pending-slot: a new swipe commits the previous one, latest stays undoable).
      flushPending();
      const opts = typeof options === "string" ? { variant: options as ToastVariant } : options;
      setMessage(msg);
      setVariant(opts.variant ?? "success");
      setIcon(opts.icon);
      setAction(opts.action ?? null);
      autoDismissRef.current = opts.onAutoDismiss ?? null;
      if ((opts.variant ?? "success") === "success" && isSuccessSoundEnabled()) playSuccessSound();
      const ms = opts.durationMs ?? durationMs;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const fn = autoDismissRef.current;
        autoDismissRef.current = null;
        if (fn) fn();
        setMessage(null);
        setIcon(undefined);
        setAction(null);
      }, ms);
    },
    [durationMs, flushPending]
  );

  const showErrorToast = useCallback(
    (msg: string) => {
      logEvent("toast", "error", { message: msg });
      showToast(msg, "error");
    },
    [showToast]
  );

  // Commit any pending deferred action on unmount so navigating away within the
  // undo window still performs the write (matches iOS Mail flush-on-leave).
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const fn = autoDismissRef.current;
        autoDismissRef.current = null;
        if (fn) fn();
      }
    };
  }, []);

  const handleUndo = useCallback(() => {
    const fn = action?.onAction;
    cancelPending();
    hide();
    fn?.();
  }, [action, cancelPending, hide]);

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
      {action && (
        <button
          type="button"
          onClick={handleUndo}
          className="ml-1 shrink-0 min-h-[44px] inline-flex items-center font-semibold text-white underline underline-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  ) : null;

  return { toast, showToast, showErrorToast };
}
