/**
 * Reusable skeleton placeholders for loading states.
 * Uses animate-pulse and neutral-200 to match existing patterns.
 *
 * 2026-06-12 chrome cohesion sweep: every page skeleton mirrors its loaded
 * layout 1:1 (same wrapper px/pt, same sticky-toolbar slot, same card grid)
 * so content doesn't shift when data lands. Canonical rhythm: page gutter
 * px-2, main owns pt-2, sticky toolbars at top-11 below the h-11 header.
 */

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`h-4 bg-neutral-200 rounded animate-pulse ${className}`} aria-hidden />;
}

/** Search-input placeholder matching the rounded-xl bg-neutral-100 py-2.5 toolbar inputs. */
function SkeletonSearchBar() {
  return <div className="flex-1 h-11 rounded-xl bg-neutral-200/80 animate-pulse" aria-hidden />;
}

/** Tab-slot pill placeholder matching the inline-flex rounded-xl p-1 bg-neutral-100 toggle. */
function SkeletonTabSlot({ tabs = 2 }: { tabs?: number }) {
  return (
    <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" aria-hidden>
      {Array.from({ length: tabs }).map((_, i) => (
        <div key={i} className="w-20 h-8 rounded-lg bg-neutral-200/80 animate-pulse" />
      ))}
    </div>
  );
}

export function PageSkeletonHome() {
  // Mirrors src/app/page.tsx wrapper: px-2 pt-0 pb-6 max-w-2xl mx-auto (main adds pt-2)
  return (
    <div className="px-2 pt-0 pb-6 max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-sky-50 via-blue-50/50 to-amber-50/30 p-5 shadow-card-soft border border-black/5">
        <SkeletonBar className="w-48 h-5 mb-3 mx-auto" />
        <div className="flex justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
          <div className="space-y-1">
            <SkeletonBar className="w-16 h-6" />
            <SkeletonBar className="w-24 h-3" />
          </div>
        </div>
        <div className="flex gap-2 overflow-hidden py-1">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="min-w-[3.5rem] h-12 bg-neutral-200/80 rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
        <SkeletonBar className="w-36 h-5 mb-3" />
        <SkeletonBar className="w-full h-3 mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-neutral-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5 space-y-2">
          <SkeletonBar className="w-28 h-5 mb-3" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded bg-neutral-200 animate-pulse shrink-0" />
              <SkeletonBar className="flex-1 h-4" />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5 space-y-2">
          <SkeletonBar className="w-24 h-5 mb-3" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <SkeletonBar className="flex-1 h-4" />
              <div className="w-14 h-8 rounded-lg bg-neutral-200 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** List skeleton for PacketVaultView (Seed Vault tab) loading state — matches list row layout. */
export function VaultListSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
      <ul className="divide-y divide-black/5" role="list">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <SkeletonBar className="w-3/4 h-4" />
              <SkeletonBar className="w-1/2 h-3" />
            </div>
            <div className="w-12 h-6 rounded bg-neutral-200 animate-pulse shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact grid skeleton for SeedVaultView loading state (no header). Matches gridDisplayStyle: photo=2-col gallery, list=rows. */
export function VaultGridSkeleton({ gridDisplayStyle = "photo" }: { gridDisplayStyle?: "photo" | "list" }) {
  const gridClass = gridDisplayStyle === "photo" ? "grid-cols-2 gap-2" : "grid-cols-1 gap-0";
  return (
    <div className={`grid ${gridClass}`}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-white border border-black/5 shadow-card">
          <div className="aspect-square bg-neutral-200 animate-pulse" />
          <div className="p-2 space-y-1.5">
            <SkeletonBar className="w-full h-4" />
            <SkeletonBar className="w-3/4 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shared inventory-surface skeleton: page wrapper + sticky-toolbar slot + photo-card grid.
 *  Mirrors VaultPageContent (px-2 pt-0 pb-10; toolbar at top-11 with -mx-2 px-2 pt-1 pb-2). */
function InventorySurfaceSkeleton({ tabs }: { tabs: number }) {
  return (
    <div className="px-2 pt-0 pb-10">
      <div className="sticky top-11 z-10 -mx-2 px-2 pt-1 pb-2 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
        <div className="flex mb-3">
          <SkeletonTabSlot tabs={tabs} />
        </div>
        <div className="flex gap-2 mb-2">
          <SkeletonSearchBar />
        </div>
      </div>
      <div className="pt-2">
        <VaultGridSkeleton gridDisplayStyle="photo" />
      </div>
    </div>
  );
}

/** /vault — Packets + Shed tab slot, toolbar, photo grid. */
export function PageSkeletonVault() {
  return <InventorySurfaceSkeleton tabs={2} />;
}

/** /plants — Library single-state tab slot (VISION §8 single-state tab-slot), toolbar, photo grid. */
export function PageSkeletonLibrary() {
  return <InventorySurfaceSkeleton tabs={1} />;
}

/** Detail-page skeleton (plant profile / growing instance / packet / shed item):
 *  back chip at 16px below header, hero block, action pills, content cards. */
export function PageSkeletonVaultDetail() {
  return (
    <div className="px-6 pt-2 pb-10 max-w-2xl mx-auto space-y-4">
      <SkeletonBar className="w-20 h-5" />
      <div className="h-64 bg-neutral-200 rounded-2xl animate-pulse" />
      <div className="flex gap-2">
        <div className="h-10 w-24 bg-neutral-200 rounded-xl animate-pulse" />
        <div className="h-10 w-24 bg-neutral-200 rounded-xl animate-pulse" />
        <div className="h-10 w-24 bg-neutral-200 rounded-xl animate-pulse" />
      </div>
      <SkeletonBar className="w-2/3" />
      <SkeletonBar className="w-1/2" />
      <div className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5 space-y-2">
        <SkeletonBar className="w-28 h-5 mb-2" />
        <SkeletonBar className="w-full h-3" />
        <SkeletonBar className="w-3/4 h-3" />
      </div>
    </div>
  );
}

export function PageSkeletonCalendar() {
  // Mirrors src/app/calendar/page.tsx wrapper: px-2 pt-0 pb-6 (main adds pt-2)
  return (
    <div className="px-2 pt-0 pb-6">
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
          <SkeletonBar className="w-40 h-8" />
          <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card border border-black/5">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonBar key={i} className="h-6" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square bg-neutral-200/80 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-black/5">
              <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1">
                <SkeletonBar className="w-3/4 h-4" />
                <SkeletonBar className="w-1/2 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeletonJournal() {
  // Mirrors src/app/journal/page.tsx wrapper: px-2 pt-0 pb-24 + sticky toolbar at top-11
  return (
    <div className="px-2 pt-0 pb-24">
      <div className="sticky top-11 z-10 -mx-2 px-2 pt-2 pb-3 mb-4 bg-paper border-b border-black/5">
        <div className="flex gap-2 mb-2">
          <SkeletonSearchBar />
          <div className="w-24 h-11 rounded-xl bg-neutral-200/80 animate-pulse shrink-0" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow-card border border-black/10">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl bg-neutral-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBar className="w-full h-4" />
                <SkeletonBar className="w-2/3 h-3" />
                <SkeletonBar className="w-1/4 h-3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeletonGarden() {
  // Mirrors src/app/garden/page.tsx: px-2 pt-0 pb-6 + sticky GroupTabs/search toolbar
  // at top-11 (-mx-2 px-2 pt-1 pb-2) + 3-col card grid (GardenView grid view).
  return (
    <div className="px-2 pt-0 pb-6">
      <div className="sticky top-11 z-10 -mx-2 px-2 pt-1 pb-2 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-sm">
        <div className="flex mb-2">
          <SkeletonTabSlot tabs={2} />
        </div>
        <div className="flex gap-2 mb-2 mt-2">
          <SkeletonSearchBar />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="rounded-lg bg-white overflow-hidden border border-black/5 shadow-card">
            <div className="aspect-square bg-neutral-200 animate-pulse" />
            <div className="p-2 space-y-1.5">
              <SkeletonBar className="w-full h-3" />
              <SkeletonBar className="w-2/3 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeletonSchedule() {
  return (
    <div className="min-h-screen bg-paper p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex gap-2">
          <div className="w-28 h-10 rounded-xl bg-neutral-200 animate-pulse" />
          <div className="w-28 h-10 rounded-xl bg-neutral-200 animate-pulse" />
          <div className="w-28 h-10 rounded-xl bg-neutral-200 animate-pulse" />
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
          <SkeletonBar className="w-full h-8 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonBar key={i} className="w-full h-10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
