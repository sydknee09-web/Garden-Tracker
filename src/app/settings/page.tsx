"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto pb-24">
      <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6">
        &larr; Back to Garden
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Settings</h1>
      <p className="text-sm text-neutral-500 mb-8">Profile, data, and developer tools.</p>

      <div className="space-y-3">
        <Link
          href="/settings/profile"
          className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
        >
          <h2 className="text-lg font-semibold text-neutral-800 mb-1">Profile</h2>
          <p className="text-sm text-neutral-500 mb-2">Planting zone, export data, tag manager, schedule defaults, household, and account (reset password, delete account, sign out).</p>
          <span className="text-sm text-emerald-600 font-medium">Open Profile &rarr;</span>
        </Link>

        <Link
          href="/settings/developer"
          className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
        >
          <h2 className="text-lg font-semibold text-neutral-800 mb-1">Developer</h2>
          <p className="text-sm text-neutral-500 mb-2">Archived plantings, import logs, plant data cache, archived purchases, repair hero photos, and trash.</p>
          <span className="text-sm text-emerald-600 font-medium">Open Developer &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
