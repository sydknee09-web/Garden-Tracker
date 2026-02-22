/**
 * Reusable skeleton placeholders for loading states.
 * Uses animate-pulse and neutral-200 to match existing patterns.
 */

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`h-4 bg-neutral-200 rounded animate-pulse ${className}`} aria-hidden />;
}

export function PageSkeletonHome() {
  return (
    <div className="px-6 pt-2 pb-6 max-w-2xl mx-auto space-y-6">
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

/** Compact grid skeleton for SeedVaultView loading state (no header). */
export function VaultGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

export function PageSkeletonVault() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-black/5 px-4 py-3">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <SkeletonBar className="w-32 h-9 rounded-lg" />
          <SkeletonBar className="flex-1 max-w-xs h-9 rounded-lg" />
          <div className="flex gap-2">
            <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
            <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="p-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-white border border-black/5 shadow-card-soft">
              <div className="aspect-square bg-neutral-200 animate-pulse" />
              <div className="p-3 space-y-2">
                <SkeletonBar className="w-full h-4" />
                <SkeletonBar className="w-3/4 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeletonVaultDetail() {
  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-neutral-200 rounded w-1/3" />
        <div className="h-64 bg-neutral-200 rounded-2xl" />
        <div className="h-4 bg-neutral-200 rounded w-2/3" />
        <div className="h-4 bg-neutral-200 rounded w-1/2" />
        <div className="flex gap-2 mt-4">
          <div className="h-10 w-24 bg-neutral-200 rounded-lg" />
          <div className="h-10 w-24 bg-neutral-200 rounded-lg" />
          <div className="h-10 w-24 bg-neutral-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PageSkeletonCalendar() {
  return (
    <div className="min-h-screen bg-paper p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBar className="w-40 h-8" />
          <div className="flex gap-2">
            <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
            <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
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
  return (
    <div className="min-h-screen bg-paper p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBar className="w-32 h-8" />
          <div className="w-24 h-10 rounded-xl bg-neutral-200 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
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
    </div>
  );
}

export function PageSkeletonGarden() {
  return (
    <div className="min-h-screen bg-paper p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <SkeletonBar className="w-48 h-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-xl bg-neutral-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <SkeletonBar className="w-full h-4" />
                  <SkeletonBar className="w-3/4 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
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
