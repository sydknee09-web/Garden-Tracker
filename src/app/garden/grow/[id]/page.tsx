"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { ICON_MAP } from "@/lib/styleDictionary";
import { GrowInstanceModal } from "@/components/GrowInstanceModal";
import { HarvestModal } from "@/components/HarvestModal";
import { getSwipeOrder } from "@/lib/swipeOrder";
import type { BatchLogBatch } from "@/components/BatchLogSheet";

/**
 * Standalone growing-instance detail page (Sprint 3). The 4th detail surface to reach real-page
 * parity with Library / Packet / Shed (NORTH_STAR "No duplicate paths"). Reuses GrowInstanceModal's
 * rich 4-tab render tree via `variant="page"`; this wrapper owns the Back chip, filter-aware swipe,
 * and the HarvestModal host (the modal previously delegated harvest to the Garden page parent).
 */
export default function GardenGrowDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  // Context-aware Back (Q3): from=library|packet carry the origin id; default = Garden.
  const fromParam = searchParams.get("from");
  const profileIdParam = searchParams.get("profileId");
  const packetIdParam = searchParams.get("packetId");

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [harvestBatch, setHarvestBatch] = useState<BatchLogBatch | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const backHref =
    fromParam === "library" && profileIdParam ? `/vault/${profileIdParam}`
    : fromParam === "packet" && packetIdParam ? `/vault/packets/${packetIdParam}`
    : "/garden";

  // Preserve entry context across swipes so the Back target stays consistent.
  const contextQuery =
    fromParam === "library" && profileIdParam ? `?from=library&profileId=${profileIdParam}`
    : fromParam === "packet" && packetIdParam ? `?from=packet&packetId=${packetIdParam}`
    : "";

  // Swipe order: prefer the Garden tab's filtered+sorted snapshot (so swipe follows what the user
  // was browsing); else the Q4-LOCKED fallback — the user's growing instances, newest sown first,
  // archived excluded.
  useEffect(() => {
    if (!user?.id || !id) return;
    let cancelled = false;
    (async () => {
      const snapshot = getSwipeOrder("instances", id);
      if (snapshot) { setOrderedIds(snapshot); return; }
      const { data } = await supabase
        .from("grow_instances")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "growing")
        .is("deleted_at", null)
        .order("sown_date", { ascending: false });
      if (cancelled || !data) return;
      setOrderedIds((data as { id: string }[]).map((r) => r.id));
    })();
    return () => { cancelled = true; };
  }, [user?.id, id]);

  const { prevId, nextId } = useMemo(() => {
    if (!id || orderedIds.length === 0) return { prevId: null as string | null, nextId: null as string | null };
    const idx = orderedIds.indexOf(id);
    if (idx < 0) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? orderedIds[idx - 1]! : null,
      nextId: idx < orderedIds.length - 1 ? orderedIds[idx + 1]! : null,
    };
  }, [id, orderedIds]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    // Suspend swipe while an internal sub-sheet (archive dialog / BatchLogSheet) is open.
    if (start == null || subSheetOpen) return;
    const end = e.changedTouches[0];
    if (!end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return; // 50px threshold — matches packet/shed
    if (dx < -50 && nextId) router.push(`/garden/grow/${nextId}${contextQuery}`); // swipe left → next
    else if (dx > 50 && prevId) router.push(`/garden/grow/${prevId}${contextQuery}`); // swipe right → previous
  }, [subSheetOpen, nextId, prevId, router, contextQuery]);

  if (!id) {
    return (
      <div className="px-6 pb-10 max-w-2xl mx-auto">
        <Link href="/garden" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">← Back</Link>
        <p className="text-neutral-600">Plant not found.</p>
      </div>
    );
  }

  const initialTab = (() => {
    const t = searchParams.get("instanceTab");
    return t === "care" || t === "journal" || t === "history" || t === "overview" ? t : undefined;
  })();

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Back chip — unframed transient nav (VISION §8 chrome-control framing). The framed action
          pills (Profile / Log / Archive) live in the instance content's own chrome strip below the hero. */}
      <div className="px-4 pt-4">
        <Link href={backHref} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline min-h-[44px]">
          ← Back
        </Link>
      </div>

      {/* Swipe left = next, right = previous; context-aware set. Desktop = arrow buttons (md+). */}
      <div className="relative touch-pan-y" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
        {prevId && (
          <Link
            href={`/garden/grow/${prevId}${contextQuery}`}
            className="absolute left-0 top-[30%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
            aria-label="Previous plant"
          >
            <ICON_MAP.ChevronLeft className="w-6 h-6" />
          </Link>
        )}
        {nextId && (
          <Link
            href={`/garden/grow/${nextId}${contextQuery}`}
            className="absolute right-0 top-[30%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
            aria-label="Next plant"
          >
            <ICON_MAP.ChevronRight className="w-6 h-6" />
          </Link>
        )}

        {/* key={id} → fresh mount per instance on swipe (scroll-to-top + overview); reloadKey refetches
            in place for the same instance (e.g. after a harvest is logged below). */}
        <GrowInstanceModal
          key={id}
          variant="page"
          growId={id}
          backHref={null}
          onClose={() => router.push(backHref)}
          initialTab={initialTab}
          focusScheduleId={searchParams.get("schedule") ?? undefined}
          onSubSheetOpenChange={setSubSheetOpen}
          reloadKey={reloadKey}
          onLogHarvest={(batch) => setHarvestBatch(batch)}
        />
      </div>

      {/* Harvest flow — hosted here on the standalone page (no Garden parent to delegate to). */}
      <HarvestModal
        open={!!harvestBatch}
        onClose={() => setHarvestBatch(null)}
        onSaved={() => { setHarvestBatch(null); setReloadKey((k) => k + 1); }}
        profileId={harvestBatch?.plant_profile_id ?? ""}
        growInstanceId={harvestBatch?.id ?? ""}
        displayName={harvestBatch ? (harvestBatch.profile_variety_name?.trim() ? `${harvestBatch.profile_name} (${harvestBatch.profile_variety_name})` : harvestBatch.profile_name) : ""}
      />
    </div>
  );
}
