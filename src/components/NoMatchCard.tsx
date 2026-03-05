"use client";

interface NoMatchCardProps {
  /** Primary message, e.g. "No plant profiles match your search or filters." */
  message: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action handler (e.g. Clear filters, Show all) */
  onAction?: () => void;
  className?: string;
}

/**
 * Standardized "no match" card for search/filter empty states.
 * Use across Vault (Plant Profiles, Seed Vault, Shed) and Garden (Active, My Plants)
 * so users get a consistent experience when nothing matches.
 */
export function NoMatchCard({ message, actionLabel, onAction, className = "" }: NoMatchCardProps) {
  return (
    <div
      className={`rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto ${className}`}
      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
    >
      <p className="text-black/70 font-medium mb-2">{message}</p>
      <p className="text-sm text-black/50 mb-6">Try changing filters or search.</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
