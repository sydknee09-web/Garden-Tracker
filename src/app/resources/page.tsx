"use client";

import Link from "next/link";
import { ICON_MAP } from "@/lib/styleDictionary";

/** Planting calendar references: Zone 9/10 primary (SDSC), other zones, Farmers' Almanac. */
const PLANTING_CALENDAR_LINKS = [
  { label: "Zone 9/10 Quick-Glance (San Diego Seed Co)", url: "https://sandiegoseedcompany.com/wp-content/uploads/2023/03/SDSC-Planting-Chart-2023.pdf", primary: true },
  { label: "Zone 8", url: "https://sandiegoseedcompany.com/growing/zone-8-planting-calendar/", primary: false },
  { label: "Zone 7", url: "https://sandiegoseedcompany.com/growing/zone-7-planting-calendar/", primary: false },
  { label: "Zone 6", url: "https://sandiegoseedcompany.com/planting/zone-6-planting-calendar/", primary: false },
  { label: "Zone 5", url: "https://sandiegoseedcompany.com/growing/zone-5-planting-calendar/", primary: false },
  { label: "Farmers' Almanac planting dates", url: "https://www.almanac.com/gardening/planting-calendar", primary: false },
] as const;

export default function ResourcesPage() {
  return (
    <div className="px-6 py-6 max-w-2xl mx-auto pb-24">
      <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
        &larr; Back to Home
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Resources</h1>
      <p className="text-sm text-neutral-500 mb-6">Zone charts, planting calendars, and frost dates — open in a new tab to view or print.</p>

      <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
        <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Planting calendars</h2>
        <p className="text-xs text-black/50 mb-3">Zone charts and frost dates. Or use our in-app <Link href="/schedule" prefetch={false} className="text-emerald-600 font-medium hover:underline">Planting Schedule</Link> (Zone 10b reference).</p>
        <div className="space-y-3">
          {PLANTING_CALENDAR_LINKS.filter((c) => c.primary).map((cal) => (
            <a
              key={cal.url}
              href={cal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 min-w-[44px] min-h-[44px] w-full rounded-xl bg-emerald-50 border border-emerald-100/80 p-3 text-left hover:bg-emerald-100 transition-colors group"
            >
              <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700" aria-hidden>
                <ICON_MAP.Calendar stroke="currentColor" className="w-[22px] h-[22px]" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-emerald-800 group-hover:text-emerald-900">{cal.label}</span>
                <span className="ml-1.5 text-xs text-emerald-600">(opens in new tab)</span>
              </div>
              <span className="shrink-0 text-emerald-600" aria-hidden>↗</span>
            </a>
          ))}
          <div className="pt-2 border-t border-black/5">
            <p className="text-xs font-medium text-black/70 mb-2">Other zones &amp; references</p>
            <ul className="flex flex-wrap gap-2">
              {PLANTING_CALENDAR_LINKS.filter((c) => !c.primary).map((cal) => (
                <li key={cal.url}>
                  <a
                    href={cal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg border border-black/10 bg-white text-sm text-black/80 hover:bg-black/5 hover:border-black/20 transition-colors"
                  >
                    {cal.label}
                    <span className="text-black/40" aria-hidden>↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
