"use client";

import type { ReactNode } from "react";

/**
 * Master modal template: unified look for Add Seed, Quick log, Garden add menu, New Task.
 * Design specs: 24px radius, bold 20px header, 14px muted subtext, action rows with icon in gray box, semi-bold 16px, standard cancel/primary footer.
 */

const MODAL_RADIUS = "rounded-3xl"; /* 24px */
const MODAL_SHADOW = "0 10px 30px rgba(0,0,0,0.08)";

export interface ModalShellProps {
  /** Bold, centered, 20px */
  title: string;
  /** Regular, 14px, muted gray. Optional. */
  subtext?: string;
  children: ReactNode;
  /** Footer: Cancel button label and handler. If provided, renders standard cancel at bottom. */
  cancelLabel?: string;
  onCancel?: () => void;
  /** For accessibility */
  ariaLabelledby?: string;
  /** Optional: position (default bottom sheet style). Use "center" for Calendar New Task style. */
  position?: "bottom" | "center";
  /** Optional extra container class */
  className?: string;
}

export function ModalShell({
  title,
  subtext,
  children,
  cancelLabel = "Cancel",
  onCancel,
  ariaLabelledby,
  position = "bottom",
  className = "",
}: ModalShellProps) {
  const containerPosition =
    position === "center"
      ? "left-4 right-4 top-1/2 -translate-y-1/2 max-w-md mx-auto"
      : "left-4 right-4 bottom-20 max-w-md mx-auto";

  return (
    <div
      className={`fixed ${containerPosition} z-50 max-h-[85vh] overflow-y-auto ${MODAL_RADIUS} bg-white p-6 border border-neutral-200/80 ${className}`}
      style={{ boxShadow: MODAL_SHADOW }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby ?? undefined}
    >
      <h2
        id={ariaLabelledby}
        className="text-xl font-bold text-center text-neutral-900 mb-1"
        style={{ fontSize: "var(--modal-header-size, 1.25rem)" }}
      >
        {title}
      </h2>
      {subtext != null && subtext !== "" && (
        <p
          className="text-center text-neutral-500 mb-4"
          style={{ fontSize: "var(--modal-subtext-size, 0.875rem)" }}
        >
          {subtext}
        </p>
      )}
      <div className="space-y-3">{children}</div>
      {onCancel != null && (
        <div className="pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="modal-cancel-btn w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]"
          >
            {cancelLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Single action row: light border, icon in rounded gray box, semi-bold 16px left-aligned text. */
export interface ModalActionButtonProps {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  /** Slightly smaller row (e.g. secondary action) */
  compact?: boolean;
  className?: string;
}

export function ModalActionButton({
  icon,
  children,
  onClick,
  compact = false,
  className = "",
}: ModalActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 ${className}`}
      style={{
        fontSize: "var(--modal-action-text-size, 1rem)",
        padding: compact ? "0.75rem 1rem" : "1rem 1rem",
        borderRadius: "12px",
        minHeight: 44,
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700"
        style={{ width: compact ? 32 : 40, height: compact ? 32 : 40 }}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

/** Primary footer button: solid green, full width, high-rounded. Use inside forms or custom footers. */
export function ModalPrimaryButton({
  children,
  disabled,
  className = "",
  ...rest
}: { children: ReactNode; disabled?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`w-full min-h-[44px] py-3 rounded-xl bg-emerald text-white font-semibold shadow-soft disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Cancel button only (for use in form footers next to primary). */
export function ModalCancelButton({
  children = "Cancel",
  onClick,
  className = "",
}: {
  children?: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px] ${className}`}
    >
      {children}
    </button>
  );
}
