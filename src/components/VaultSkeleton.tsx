"use client";

/**
 * Emerald-branded skeleton components for Vault loading states.
 * Uses animate-shimmer from globals.css; overflow-hidden on cards so shimmer does not leak.
 */

function ShimmerCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-neutral-100 relative z-0 ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 animate-shimmer rounded-xl overflow-hidden" aria-hidden />
    </div>
  );
}

/** Shed tab: grid of 3 square cards. */
export function ShedSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Loading supplies">
      {[1, 2, 3].map((i) => (
        <ShimmerCard key={i} className="aspect-square" />
      ))}
    </div>
  );
}

/** Seed Vault: grid matching photo (2-col) or condensed (2–3 col). */
export function GridSkeleton({ gridDisplayStyle = "condensed" }: { gridDisplayStyle?: "photo" | "condensed" }) {
  const gridClass =
    gridDisplayStyle === "photo" ? "grid-cols-2 gap-2" : "grid-cols-2 sm:grid-cols-3 gap-2";
  return (
    <div className={`grid ${gridClass}`}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-white border border-black/5 shadow-card">
          <ShimmerCard className="w-full aspect-square" />
          <div className="p-2 space-y-1.5">
            <div className="h-4 rounded bg-neutral-100 overflow-hidden">
              <div className="h-full w-full animate-shimmer rounded overflow-hidden" aria-hidden />
            </div>
            <div className="h-3 w-3/4 rounded bg-neutral-100 overflow-hidden">
              <div className="h-full w-full animate-shimmer rounded overflow-hidden" aria-hidden />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Garden list: rows with thumbnail + lines. Optional rowCount for Shed list loading (e.g. 5). */
export function ListSkeleton({ rowCount = 7 }: { rowCount?: number }) {
  const rows = [1, 2, 3, 4, 5, 6, 7].slice(0, Math.min(Math.max(1, rowCount), 7));
  return (
    <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
      <ul className="divide-y divide-black/5" role="list">
        {rows.map((i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 relative shrink-0">
              <div className="absolute inset-0 animate-shimmer rounded-lg overflow-hidden" aria-hidden />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 rounded bg-neutral-100 overflow-hidden max-w-[75%]">
                <div className="h-full w-full animate-shimmer rounded overflow-hidden" aria-hidden />
              </div>
              <div className="h-3 rounded bg-neutral-100 overflow-hidden max-w-[50%]">
                <div className="h-full w-full animate-shimmer rounded overflow-hidden" aria-hidden />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
