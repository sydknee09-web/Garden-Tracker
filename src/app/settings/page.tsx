"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useDeveloperUnlock } from "@/contexts/DeveloperUnlockContext";
import { SettingsSuccessSoundToggle } from "@/components/SettingsSuccessSoundToggle";

type SettingsItem = { href: string; label: string; subtitle?: string };

const ACCOUNT_ITEMS: readonly SettingsItem[] = [
  { href: "/settings/profile", label: "Profile", subtitle: "Zone, export, tags, schedule, account" },
  { href: "/settings/family", label: "Family", subtitle: "Members, approval, view/edit access by page" },
];

const PREFERENCE_ITEMS: readonly SettingsItem[] = [
  { href: "/help", label: "Help", subtitle: '"Where do I…?" — quick reference for finding things' },
];

const RESOURCE_ITEMS: readonly SettingsItem[] = [
  { href: "/resources", label: "Resources", subtitle: "Planting calendars, zone charts, frost dates" },
  { href: "/vault/history", label: "Planting History", subtitle: "Active and archived plantings" },
  { href: "/settings/vendors", label: "Vendor Ratings", subtitle: "Average packet ratings by vendor" },
];

const FEEDBACK_ITEMS: readonly SettingsItem[] = [
  { href: "/settings/feedback", label: "Feedback", subtitle: "Your submitted feedback" },
];

const ADMIN_ITEMS: readonly SettingsItem[] = [
  { href: "/settings/import-catalog", label: "Import Vendor Catalog", subtitle: "Upload a PDF catalog to add to shared plant cache" },
  { href: "/settings/developer", label: "Developer", subtitle: "Fill in blanks, repair hero, cache, trash" },
  { href: "/settings/developer/feedback-inbox", label: "Feedback Inbox", subtitle: "All user feedback (admin view)" },
  { href: "/settings/import-logs", label: "Import Logs", subtitle: "Import history and status" },
  { href: "/settings/extract-cache", label: "Extract Cache", subtitle: "Plant data cache" },
];

const SECTION_HEADER = "text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3";
const CARD = "rounded-xl border border-black/10 bg-white overflow-hidden";
const ROW =
  "flex items-center justify-between gap-3 min-h-[44px] px-4 py-3 text-left border-b border-black/5 last:border-b-0 hover:bg-black/[0.03] active:bg-black/5";

function SettingsLinkRow({ href, label, subtitle }: SettingsItem) {
  return (
    <Link key={href} href={href} className={ROW}>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-neutral-900 block truncate">{label}</span>
        {subtitle && <span className="text-xs text-neutral-500 block truncate">{subtitle}</span>}
      </div>
      <span className="text-neutral-400 shrink-0" aria-hidden>
        ›
      </span>
    </Link>
  );
}

function SettingsSection({ label, items }: { label: string; items: readonly SettingsItem[] }) {
  return (
    <section className="mb-6">
      <h2 className={SECTION_HEADER}>{label}</h2>
      <nav className={CARD} aria-label={label}>
        {items.map((item) => (
          <SettingsLinkRow key={item.href} {...item} />
        ))}
      </nav>
    </section>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { isUnlocked } = useDeveloperUnlock();

  if (!user) return null;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
      <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
        &larr; Home
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Settings</h1>
      <p className="text-sm text-neutral-500 mb-6">Profile, data, and developer tools.</p>

      <SettingsSection label="Account" items={ACCOUNT_ITEMS} />

      <section className="mb-6">
        <h2 className={SECTION_HEADER}>Preferences</h2>
        <nav className={CARD} aria-label="Preferences">
          <SettingsSuccessSoundToggle />
          {PREFERENCE_ITEMS.map((item) => (
            <SettingsLinkRow key={item.href} {...item} />
          ))}
        </nav>
      </section>

      <SettingsSection label="Resources" items={RESOURCE_ITEMS} />

      <SettingsSection label="Feedback" items={FEEDBACK_ITEMS} />

      {isUnlocked && <SettingsSection label="Admin" items={ADMIN_ITEMS} />}

      <section className="mb-6">
        <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={signOut}
            className="flex items-center w-full min-h-[44px] px-4 py-3 text-left text-red-600 font-medium hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
