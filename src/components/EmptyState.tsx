"use client";

interface EmptyStateProps {
  icon?: string;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Shared empty-state placeholder used across pages for visual consistency. */
export function EmptyState({ icon = "🌱", message, detail, actionLabel, onAction, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-10 px-4 text-center ${className}`}>
      <span className="text-4xl mb-3" aria-hidden>{icon}</span>
      <p className="text-neutral-600 font-medium text-sm">{message}</p>
      {detail && <p className="text-neutral-400 text-xs mt-1 max-w-xs">{detail}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 min-h-[44px] min-w-[44px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
