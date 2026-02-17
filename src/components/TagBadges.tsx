"use client";

import { memo } from "react";

const TAG_STYLES: Record<string, string> = {
  Heirloom: "bg-amber-100 text-amber-800 border-amber-200",
  Organic: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Non-GMO": "bg-violet-100 text-violet-800 border-violet-200",
  "Open Pollinated": "bg-teal-100 text-teal-800 border-teal-200",
  F1: "bg-sky-100 text-sky-800 border-sky-200",
  Hybrid: "bg-slate-100 text-slate-700 border-slate-200",
  "Hybrid F1": "bg-sky-100 text-sky-800 border-sky-200",
};

const DEFAULT_STYLE = "bg-neutral-100 text-neutral-700 border-neutral-200";

/** Tag name -> Tailwind classes for pill (used by TagBadges and vault tag filter dropdown). */
export function getTagStyle(tag: string): string {
  return TAG_STYLES[tag.trim()] ?? DEFAULT_STYLE;
}

export const TagBadges = memo(function TagBadges({ tags, className = "" }: { tags: string[]; className?: string }) {
  if (!tags?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => {
        const key = tag.trim();
        if (!key) return null;
        const style = getTagStyle(key);
        return (
          <span
            key={key}
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${style}`}
          >
            {key}
          </span>
        );
      })}
    </div>
  );
});
