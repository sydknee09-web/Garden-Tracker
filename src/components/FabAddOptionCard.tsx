"use client";

/**
 * FabAddOptionCard — the canonical method-picker option card for the FAB Add flow.
 *
 * Single shared primitive for every "how do you want to add X?" option button so the icon-chip +
 * title + subtitle shape can't drift between the Add Plant picker (UniversalAddMenu) and the Add
 * Seed Packet picker (SeedPacketForm). Add Plant's subtitle format is canonical (Syd 2026-06-14:
 * "I like the add plant format better for mobile"). Pass `subtitle` to match it; omit only when a
 * surface genuinely has no descriptor.
 *
 * Extracted Sprint 14 (Finding #70) — the prior FAB modal work rendered this card inline in two
 * places, which is exactly how the subtitle-present/absent divergence crept in.
 */
export function FabAddOptionCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  /** Icon element, e.g. `<ICON_MAP.Plant className="w-5 h-5" />`. */
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2.5 px-4 rounded-3xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-luxury/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
    >
      <span className="flex h-10 w-10 rounded-3xl bg-emerald-luxury/10 items-center justify-center shrink-0 text-emerald-luxury p-2.5">
        {icon}
      </span>
      <div>
        <div>{title}</div>
        {subtitle && <div className="text-xs font-normal text-neutral-500">{subtitle}</div>}
      </div>
    </button>
  );
}
