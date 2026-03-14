"use client";

/**
 * E3: Standardized empty-state card for "no X yet" screens.
 * Same padding, typography, and button style across Vault, Journal, Garden, Shed.
 */
export interface EmptyStateCardProps {
  /** Short title, e.g. "No journal entries yet" */
  title: string;
  /** One or two lines of body copy */
  body: React.ReactNode;
  /** Primary action label, e.g. "Add your first entry" */
  actionLabel?: string;
  /** Primary action handler */
  onAction?: () => void;
  /** Optional illustration (e.g. SVG) — same size across empty states */
  illustration?: React.ReactNode;
  className?: string;
}

export function EmptyStateCard({
  title,
  body,
  actionLabel,
  onAction,
  illustration,
  className = "",
}: EmptyStateCardProps) {
  return (
    <div
      className={`rounded-card-lg bg-white p-8 shadow-card border border-black/5 text-center max-w-md mx-auto ${className}`}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {illustration && (
        <div className="flex justify-center mb-4" aria-hidden>
          {illustration}
        </div>
      )}
      <p className="text-slate-600 font-medium mb-2">{title}</p>
      <div className="text-sm text-slate-500 mb-6">{body}</div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
