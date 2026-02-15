"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const SETTINGS_ITEMS = [
  { href: "/settings/profile", label: "Profile", subtitle: "Zone, export, tags, schedule, household, account" },
  { href: "/settings/feedback", label: "Feedback", subtitle: "Your submitted feedback" },
  { href: "/settings/import-catalog", label: "Import Vendor Catalog", subtitle: "Upload a PDF catalog to add to shared plant cache" },
  { href: "/settings/developer", label: "Developer", subtitle: "Fill in blanks, repair hero, cache, trash" },
  { href: "/settings/import-logs", label: "Import logs", subtitle: "Import history and status" },
  { href: "/settings/extract-cache", label: "Extract cache", subtitle: "Plant data cache" },
] as const;

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  const items = SETTINGS_ITEMS;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
      <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
        &larr; Back to Garden
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Settings</h1>
      <p className="text-sm text-neutral-500 mb-4">Profile, data, and developer tools.</p>

      <nav className="rounded-xl border border-black/10 bg-white overflow-hidden" aria-label="Settings">
        {items.map(({ href, label, subtitle }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between gap-3 min-h-[44px] px-4 py-3 text-left border-b border-black/5 last:border-b-0 hover:bg-black/[0.03] active:bg-black/5"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-neutral-900 block truncate">{label}</span>
              {subtitle && <span className="text-xs text-neutral-500 block truncate">{subtitle}</span>}
            </div>
            <span className="text-neutral-400 shrink-0" aria-hidden>›</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
