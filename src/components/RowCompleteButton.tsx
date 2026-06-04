/**
 * Desktop checkmark "complete" button for task/item-complete rows.
 * Canonical reference: Calendar's `CalendarTaskRow` complete pill (emerald, 44px, check polyline).
 *
 * `hidden md:flex` is baked in: per VISION.md §8 "Complete-task affordance — responsive primitive
 * lock" + Principle 9, phone-portrait completes via swipe-left (see `SwipeCompleteRow`); the visible
 * button is the iPad-portrait+/desktop affordance. Keep this byte-identical across every surface so
 * the desktop checkmark reads the same app-wide.
 */
export function RowCompleteButton({
  onClick,
  disabled = false,
  ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 shrink-0"
      aria-label={ariaLabel}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}
