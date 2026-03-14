"use client";

/**
 * Shared inline SVG illustrations for empty states (E3 polish).
 * No image files — all vector, same size and style across Vault, Journal, Garden, Shed.
 */
const SVG_PROPS = {
  width: 96,
  height: 96,
  viewBox: "0 0 64 64",
  fill: "none" as const,
  className: "text-emerald-200",
  "aria-hidden": true,
};

export function EmptyStateJournal(props: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={props.className ?? SVG_PROPS.className}>
      <rect x="8" y="4" width="48" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="12" width="40" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="32" cy="26" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M20 48h24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function EmptyStateVault(props: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={props.className ?? SVG_PROPS.className}>
      <rect x="10" y="6" width="44" height="52" rx="5" stroke="currentColor" strokeWidth="2" />
      <path d="M10 18h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 28h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M18 36h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M32 52v-6c0-2 2-4 4-6 1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0c-2 2-4 4-4 6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyStateSprout(props: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={props.className ?? SVG_PROPS.className}>
      <path d="M32 56V44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 44c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 34c-4 0-7-3-7-7s3-7 7-7 7 3 7 7-3 7-7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

export function EmptyStateCart(props: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={props.className ?? SVG_PROPS.className}>
      <path d="M12 18h40l-4 24H16L12 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 18V12a4 4 0 0 1 8 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="48" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="40" cy="48" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function EmptyStatePerennial(props: { className?: string }) {
  return (
    <svg {...SVG_PROPS} className={props.className ?? SVG_PROPS.className}>
      <path d="M32 60v-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <path d="M32 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 36c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}
