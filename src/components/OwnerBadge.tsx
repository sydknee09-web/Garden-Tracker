"use client";

interface OwnerBadgeProps {
  /** e.g. "MAR" — shown inside the badge */
  shorthand: string;
  /** When false, renders a lock icon after the badge */
  canEdit: boolean;
  size?: "xs" | "sm";
}

/**
 * Displays a 1-4 char shorthand badge for a household member.
 * When canEdit is false, a lock icon is appended to indicate read-only.
 */
export function OwnerBadge({ shorthand, canEdit, size = "xs" }: OwnerBadgeProps) {
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";
  const padding = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-1";
  const iconSize = size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3";

  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className={`inline-flex items-center rounded ${padding} ${textSize} font-semibold leading-none bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`}
      >
        {shorthand.toUpperCase()}
      </span>
      {!canEdit && (
        <svg
          className={`${iconSize} text-slate-400 flex-shrink-0`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-label="Read only"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      )}
    </span>
  );
}
