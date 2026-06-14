import { ICON_MAP } from "@/lib/styleDictionary";

/**
 * Canonical modal / popup close (X) button (Sprint 11 #65).
 *
 * One shared chrome primitive so every modal's close affordance reads identically — same icon
 * (flat Lucide X per the icon-style chrome convention; kills the legacy "×"/"✕" text glyphs),
 * same 44px tap target, same neutral-500 → neutral-700 hover, same rounded-lg framing. Placed
 * top-right of the modal header by the header's own `justify-between` layout.
 *
 * `className` passes through positional tweaks an individual header needs (e.g. `-mr-2` to pull
 * the button into the header's edge padding) without forking the chrome tokens.
 */
export function ModalCloseButton({
  onClick,
  ariaLabel = "Close",
  className = "",
}: {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100${className ? ` ${className}` : ""}`}
    >
      <ICON_MAP.Close className="w-5 h-5" />
    </button>
  );
}
