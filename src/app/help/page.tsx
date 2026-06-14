"use client";

import Link from "next/link";

/** Help / "Where do I…?" page — permanent escape hatch after dismissing the FAB tip. */
export default function HelpPage() {
  return (
    <div className="px-6 py-6 max-w-2xl mx-auto pb-24">
      <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
        ← Home
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Where Do I…?</h1>
      <p className="text-sm text-neutral-500 mb-6">Quick reference: what you want to do → where to go.</p>

      <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5 mb-4">
        <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Adding Things</h2>
        <ul className="space-y-2 text-sm text-black/80">
          <li><strong>Add seeds</strong> — Tap <strong>+</strong> → Add Seed Packet → enter details, or use Link Import, Purchase Order, or Photo Import.</li>
          <li><strong>Add a plant</strong> — Tap <strong>+</strong> → Add Plant → Manual Entry or From Library. For an established plant (a tree, shrub, or anything already growing), use Manual Entry and set the plant type to Permanent.</li>
          <li><strong>Add a variety to your Library</strong> — Tap <strong>+</strong> → Add to Library. Builds your reference encyclopedia without adding seeds or plantings.</li>
          <li><strong>Add supplies</strong> — Tap <strong>+</strong> → Add to Shed.</li>
          <li><strong>Add a task</strong> — Tap <strong>+</strong> → Add Task.</li>
          <li><strong>Log a quick note</strong> — Tap <strong>+</strong> → Add Journal.</li>
          <li><strong>Add to shopping list</strong> — Home → Shopping List → Add Item, or from a plant/supply page.</li>
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5 mb-4">
        <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Viewing and Planning</h2>
        <ul className="space-y-2 text-sm text-black/80">
          <li><strong>When to Plant (by Zone)</strong> — Home → When to Plant (Action now, Monthly view, or Yearly view). Or <Link href="/resources" className="text-emerald-600 font-medium hover:underline">Resources</Link> for zone charts.</li>
          <li><strong>Tasks</strong> — Bottom nav → Calendar.</li>
          <li><strong>Plant varieties</strong> — Bottom nav → Library. Your encyclopedia of every variety you track.</li>
          <li><strong>Seed packets</strong> — Bottom nav → Vault → Packets tab.</li>
          <li><strong>Supplies</strong> — Bottom nav → Vault → Shed tab.</li>
          <li><strong>Active plantings</strong> — Bottom nav → Garden.</li>
          <li><strong>Journal entries</strong> — Bottom nav → Journal.</li>
          <li><strong>Shopping list</strong> — Shopping list icon in the header, or Home.</li>
        </ul>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
        <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Tips</h2>
        <p className="text-sm text-black/70">
          The <strong>+</strong> button (FAB) is the same on Home, Library, Garden, Vault, Calendar, and Journal — it always opens the same Add menu.
        </p>
      </section>
    </div>
  );
}
