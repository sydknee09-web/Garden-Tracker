"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, updateWithOfflineQueue, upsertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { QuickAddSupply } from "@/components/QuickAddSupply";
import { QuickLogModal } from "@/components/QuickLogModal";
import { ShedSupplyIcon } from "@/components/ShedView";
import { compressImage } from "@/lib/compressImage";
import { parseNpkForDisplay } from "@/lib/supplyProfiles";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { hapticSuccess } from "@/lib/haptics";
import type { SupplyProfile, JournalEntry } from "@/types/garden";

const SUPPLY_CATEGORY_LABELS: Record<string, string> = {
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  soil_amendment: "Soil Amendment",
  other: "Other",
};

function formatDisplayDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function VaultShedDetailPage() {
  const { user, session } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [orderedSupplyIds, setOrderedSupplyIds] = useState<string[]>([]);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [showSetPhotoModal, setShowSetPhotoModal] = useState(false);
  useEscapeKey(showSetPhotoModal, () => setShowSetPhotoModal(false));

  const [supply, setSupply] = useState<SupplyProfile | null>(null);
  const [history, setHistory] = useState<(JournalEntry & { plant_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [usedTodaySaving, setUsedTodaySaving] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [thumbLoadFailed, setThumbLoadFailed] = useState(false);
  const [shedSackFallbackFailed, setShedSackFallbackFailed] = useState(false);

  const categoryFromUrl = searchParams.get("category");
  const backHref = categoryFromUrl ? `/vault?tab=shed&category=${categoryFromUrl}` : "/vault?tab=shed";
  const canEdit = supply && (supply.user_id === user?.id ? true : canEditPage(supply.user_id, "shed"));

  const fetchSupply = useCallback(async () => {
    if (!id || !user?.id) return;
    const { data, error } = await supabase
      .from("supply_profiles")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) {
      setSupply(null);
      setLoading(false);
      return;
    }
    setSupply(data as SupplyProfile);
  }, [id, user?.id]);

  const fetchHistory = useCallback(async () => {
    if (!id || !user?.id) return;
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, plant_profile_id, grow_instance_id, note, created_at, entry_type")
      .eq("supply_profile_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      setHistory([]);
      return;
    }
    const entries = data as (JournalEntry & { plant_name?: string })[];
    const profileIds = [...new Set(entries.map((e) => e.plant_profile_id).filter(Boolean))] as string[];
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .in("id", profileIds);
      const byId = new Map<string, string>();
      for (const p of profiles ?? []) {
        const pp = p as { id: string; name: string; variety_name: string | null };
        byId.set(pp.id, pp.variety_name?.trim() ? `${pp.name} (${pp.variety_name})` : pp.name);
      }
      for (const e of entries) {
        if (e.plant_profile_id) e.plant_name = byId.get(e.plant_profile_id) ?? "Plant";
      }
    }
    setHistory(entries);
  }, [id, user?.id]);

  useEffect(() => {
    setThumbLoadFailed(false);
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await fetchSupply();
      if (!cancelled) await fetchHistory();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, fetchSupply, fetchHistory]);

  useEffect(() => {
    setShedSackFallbackFailed(false);
  }, [id]);

  // Fetch ordered supply IDs for swipe prev/next (updated_at desc, same as ShedView)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("supply_profiles")
        .select("id")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (!cancelled && data) setOrderedSupplyIds((data as { id: string }[]).map((r) => r.id));
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const { prevId, nextId } = useMemo(() => {
    if (!id || orderedSupplyIds.length === 0) return { prevId: null as string | null, nextId: null as string | null };
    const idx = orderedSupplyIds.indexOf(id);
    if (idx < 0) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? orderedSupplyIds[idx - 1]! : null,
      nextId: idx < orderedSupplyIds.length - 1 ? orderedSupplyIds[idx + 1]! : null,
    };
  }, [id, orderedSupplyIds]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start == null || editOpen) return;
    const end = e.changedTouches[0];
    if (!end) return;
    const deltaX = end.clientX - start.x;
    const deltaY = end.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    const category = categoryFromUrl ? `?category=${categoryFromUrl}` : "";
    if (deltaX < -50 && nextId) router.push(`/vault/shed/${nextId}${category}`);
    else if (deltaX > 50 && prevId) router.push(`/vault/shed/${prevId}${category}`);
  }, [editOpen, nextId, prevId, router, categoryFromUrl]);

  const handleAddToShoppingList = useCallback(async () => {
    if (!user?.id || !supply?.id) return;
    setAddingToList(true);
    const { error } = await upsertWithOfflineQueue(
      "shopping_list",
      { user_id: user.id, supply_profile_id: supply.id, is_purchased: false },
      { onConflict: "user_id,supply_profile_id" }
    );
    setAddingToList(false);
    if (error) {
      const { data: existing } = await supabase
        .from("shopping_list")
        .select("id")
        .eq("user_id", user.id)
        .eq("supply_profile_id", supply.id)
        .maybeSingle();
      if (existing) {
        await updateWithOfflineQueue("shopping_list", { is_purchased: false }, { id: (existing as { id: string }).id, user_id: user.id });
      }
    } else {
      setToastMessage("Added to shopping list");
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [user?.id, supply?.id]);

  const handleUsedToday = useCallback(() => {
    setQuickLogOpen(true);
  }, []);

  const handleSaveNotes = useCallback(
    async (value: string, persist: boolean) => {
      if (!supply?.id || !user?.id) return;
      if (persist) {
        const trimmed = value.trim() || null;
        setSupply((prev) => (prev ? { ...prev, notes: trimmed ?? undefined } : null));
        await updateWithOfflineQueue("supply_profiles", { notes: trimmed, updated_at: new Date().toISOString() }, { id: supply.id, user_id: user.id });
      } else {
        setSupply((prev) => (prev ? { ...prev, notes: value || undefined } : null));
      }
    },
    [supply?.id, user?.id]
  );

  const handleFillDetails = useCallback(async () => {
    if (!user?.id || !supply?.id || !session?.access_token) return;
    setEnriching(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };
      let data: {
        name?: string;
        brand?: string;
        category?: string;
        npk?: string;
        application_rate?: string;
        usage_instructions?: string;
        source_url?: string;
        primary_image_path?: string;
      };
      if (supply.source_url?.trim()?.startsWith("http")) {
        const res = await fetch("/api/supply/extract-from-url", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: supply.source_url.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Extraction failed");
        data = json;
      } else {
        const res = await fetch("/api/supply/enrich-from-name", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: supply.name, brand: supply.brand ?? "" }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Enrichment failed");
        data = json;
      }
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (!(supply.brand ?? "").trim() && (data.brand ?? "").trim()) updates.brand = data.brand!.trim();
      if (!(supply.category ?? "").trim() && (data.category ?? "").trim()) updates.category = data.category!.trim();
      if (!(supply.npk ?? "").trim() && (data.npk ?? "").trim()) updates.npk = data.npk!.trim();
      if (!(supply.application_rate ?? "").trim() && (data.application_rate ?? "").trim()) updates.application_rate = data.application_rate!.trim();
      if (!(supply.usage_instructions ?? "").trim() && (data.usage_instructions ?? "").trim()) updates.usage_instructions = data.usage_instructions!.trim();
      if (!(supply.source_url ?? "").trim() && (data.source_url ?? "").trim()) updates.source_url = data.source_url!.trim();
      if (!(supply.primary_image_path ?? "").trim() && (data.primary_image_path ?? "").trim()) updates.primary_image_path = data.primary_image_path!.trim();
      if (Object.keys(updates).length <= 1) {
        setToastMessage("No new details to add");
      } else {
        const { error } = await updateWithOfflineQueue("supply_profiles", updates, { id: supply.id, user_id: user.id });
        if (error) throw error;
        hapticSuccess();
        await fetchSupply();
        setToastMessage("Product details filled");
      }
      setTimeout(() => setToastMessage(null), 2500);
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : "Failed to fill details");
      setTimeout(() => setToastMessage(null), 2500);
    } finally {
      setEnriching(false);
    }
  }, [user?.id, supply, session?.access_token, fetchSupply]);

  const handleAddPhoto = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file?.type.startsWith("image/") || !user?.id || !supply?.id) return;
      setPhotoSaving(true);
      try {
        const { blob } = await compressImage(file);
        const path = `${user.id}/supply-${crypto.randomUUID().slice(0, 8)}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("journal-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
        if (uploadErr) throw uploadErr;
        const ownerId = supply.user_id ?? user.id;
        const { error } = await updateWithOfflineQueue(
          "supply_profiles",
          { primary_image_path: path, updated_at: new Date().toISOString() },
          { id: supply.id, user_id: ownerId }
        );
        if (error) throw error;
        hapticSuccess();
        setShowSetPhotoModal(false);
        await fetchSupply();
        setToastMessage("Photo added");
        setTimeout(() => setToastMessage(null), 2500);
      } catch (err) {
        setToastMessage(err instanceof Error ? err.message : "Failed to add photo");
        setTimeout(() => setToastMessage(null), 2500);
      } finally {
        setPhotoSaving(false);
      }
    },
    [user?.id, supply?.id, fetchSupply]
  );

  const handleRemovePhoto = useCallback(async () => {
    if (!user?.id || !supply?.id) return;
    setPhotoSaving(true);
    try {
      const ownerId = supply.user_id ?? user.id;
      const { error } = await updateWithOfflineQueue(
        "supply_profiles",
        { primary_image_path: null, updated_at: new Date().toISOString() },
        { id: supply.id, user_id: ownerId }
      );
      if (error) throw error;
      hapticSuccess();
      setShowSetPhotoModal(false);
      setSupply((prev) => (prev ? { ...prev, primary_image_path: null } : null));
      setToastMessage("Photo removed");
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to remove photo");
      setTimeout(() => setToastMessage(null), 2500);
    } finally {
      setPhotoSaving(false);
    }
  }, [user?.id, supply?.id]);

  if (loading || !supply) {
    return (
      <div className="p-6">
        {!loading && !supply ? (
          <div>
            <Link href={backHref} className="text-emerald-600 font-medium hover:underline mb-4 inline-block">
              ← Back to Shed
            </Link>
            <p className="text-neutral-600">Supply not found.</p>
          </div>
        ) : (
          <p className="text-neutral-500">Loading…</p>
        )}
      </div>
    );
  }

  const npk = parseNpkForDisplay(supply.npk);
  const thumbUrl = supply.primary_image_path
    ? supabase.storage.from("journal-photos").getPublicUrl(supply.primary_image_path).data.publicUrl
    : null;
  const showThumb = thumbUrl && !thumbLoadFailed;
  const isOwn = supply.user_id === user?.id;

  return (
    <div className="px-6 pb-10">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {showSetPhotoModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="shed-set-photo-title">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-4 border-b border-neutral-200 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 id="shed-set-photo-title" className="text-lg font-semibold text-neutral-900">Set Product Photo</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Take a photo or choose from files.</p>
              </div>
              <button type="button" onClick={() => setShowSetPhotoModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 flex-shrink-0" aria-label="Close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {thumbUrl && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Current photo</p>
                  <div className="relative inline-block w-20 h-20 rounded-lg overflow-hidden border-2 border-neutral-300 bg-neutral-100">
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={photoSaving}
                      className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                      aria-label="Remove current photo"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor={photoSaving ? undefined : "shed-photo-camera"} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-50 min-h-[44px] ${photoSaving ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                  Take photo
                </label>
                <input
                  id="shed-photo-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleAddPhoto}
                />
                <label htmlFor={photoSaving ? undefined : "shed-photo-gallery"} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-600 hover:border-emerald-500 hover:text-emerald-700 min-h-[44px] ${photoSaving ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                  {photoSaving ? "Uploading…" : "Choose from files"}
                </label>
                <input
                  id="shed-photo-gallery"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAddPhoto}
                />
              </div>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-neutral-200">
              <button type="button" onClick={() => setShowSetPhotoModal(false)} className="w-full py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px]">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content: swipe left/right on mobile to change product */}
      <div
        className="relative touch-pan-y"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {(prevId ?? nextId) && (
          <>
            {prevId ? (
              <Link
                href={`/vault/shed/${prevId}${categoryFromUrl ? `?category=${categoryFromUrl}` : ""}`}
                className="absolute left-0 top-[40%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
                aria-label="Previous product"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
            ) : null}
            {nextId ? (
              <Link
                href={`/vault/shed/${nextId}${categoryFromUrl ? `?category=${categoryFromUrl}` : ""}`}
                className="absolute right-0 top-[40%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
                aria-label="Next product"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            ) : null}
          </>
        )}
        <Link href={backHref} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">
          ← Back to Shed
        </Link>

      {!isOwn && householdViewMode === "family" && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Viewing {getShorthandForUser(supply.user_id)}&apos;s supply
        </div>
      )}

      <div className="rounded-xl bg-white border border-black/10 overflow-hidden mb-6">
        {showThumb ? (
          <div className="aspect-video bg-white relative">
            <img src={thumbUrl} alt="" className="w-full h-full object-contain" loading="lazy" onError={() => setThumbLoadFailed(true)} />
            {canEdit && (
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={() => setShowSetPhotoModal(true)}
                  disabled={photoSaving}
                  className="px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-neutral-700 shadow hover:bg-white min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                  aria-label="Change photo"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ) : canEdit ? (
          <div className="w-full aspect-video py-8 rounded-none border-0 border-b border-black/10 flex flex-col items-center justify-center gap-3 p-6 bg-white min-h-[44px]">
            {!shedSackFallbackFailed ? (
              <img src="/shed-sack.png" alt="" className="w-24 h-24 object-contain" onError={() => setShedSackFallbackFailed(true)} />
            ) : (
              <ShedSupplyIcon className="w-16 h-16 text-neutral-300" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => setShowSetPhotoModal(true)}
              disabled={photoSaving}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-700 min-w-[44px] min-h-[44px] disabled:opacity-50"
              aria-label="Add photo"
            >
              {photoSaving ? "Uploading…" : "Add Photo"}
            </button>
          </div>
        ) : (
          <div className="aspect-video bg-white flex items-center justify-center">
            {!shedSackFallbackFailed ? (
              <img src="/shed-sack.png" alt="" className="w-full h-full object-contain" onError={() => setShedSackFallbackFailed(true)} />
            ) : (
              <ShedSupplyIcon className="w-16 h-16 text-neutral-300" aria-hidden />
            )}
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">{supply.name}</h1>
              {supply.brand && <p className="text-neutral-600 text-sm">{supply.brand}</p>}
              <span className="inline-block mt-1 text-xs text-neutral-500 bg-neutral-100 rounded px-2 py-0.5">
                {SUPPLY_CATEGORY_LABELS[supply.category] ?? supply.category}
              </span>
              {npk && (
                <span className="ml-2 inline-block text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5">
                  N {npk.n}% | P {npk.p}% | K {npk.k}%
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleFillDetails}
                  disabled={enriching || !session?.access_token}
                  title="Fill product details from web"
                  className="min-w-[44px] min-h-[44px] px-3 rounded-xl border border-black/10 text-sm font-medium hover:bg-black/5 disabled:opacity-50"
                >
                  {enriching ? "…" : "★ Fill"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="min-w-[44px] min-h-[44px] px-3 rounded-xl border border-black/10 text-sm font-medium hover:bg-black/5"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {supply.application_rate && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-black/80">Application Rate</h3>
              <p className="text-neutral-700">{supply.application_rate}</p>
            </div>
          )}
          {supply.usage_instructions && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-black/80">Usage Instructions</h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{supply.usage_instructions}</p>
            </div>
          )}
          {canEdit ? (
            <div className="mt-4">
              <label htmlFor="supply-notes" className="block text-sm font-medium text-black/80 mb-1">
                Your notes
              </label>
              <textarea
                id="supply-notes"
                value={supply.notes ?? ""}
                onChange={(e) => handleSaveNotes(e.target.value, false)}
                onBlur={(e) => handleSaveNotes(e.target.value, true)}
                placeholder="Optional notes for this product"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                aria-label="Your notes"
              />
            </div>
          ) : (
            supply.notes?.trim() && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-black/80 mb-1">Your notes</h3>
                <p className="text-neutral-700 whitespace-pre-wrap">{supply.notes}</p>
              </div>
            )
          )}
          {supply.source_url && (
            <a
              href={supply.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-emerald-600 hover:underline"
            >
              View product page →
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {isOwn && (
          <>
            <button
              type="button"
              onClick={handleAddToShoppingList}
              disabled={addingToList}
              className="min-h-[44px] min-w-[44px] px-4 rounded-xl border border-black/10 bg-white font-medium hover:bg-black/5 disabled:opacity-50"
            >
              {addingToList ? "Adding…" : "Add to Shopping List"}
            </button>
            <button
              type="button"
              onClick={handleUsedToday}
              className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-emerald text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              I used this today
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl bg-white border border-black/10 p-4">
        <h2 className="text-lg font-semibold text-neutral-900 mb-3">History</h2>
        {history.length === 0 ? (
          <p className="text-neutral-500 text-sm">No usage recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 text-sm">
                <span className="text-neutral-700">{entry.note ?? "Used"}</span>
                {entry.plant_name && (
                  <span className="text-neutral-500 text-xs">on {entry.plant_name}</span>
                )}
                <span className="text-neutral-400 text-xs">{formatDisplayDate(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuickAddSupply
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => {
          fetchSupply();
          setEditOpen(false);
        }}
        initialData={supply}
      />
      <QuickLogModal
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        preSelectedSupplyId={supply?.id ?? null}
        defaultActionType={supply?.category === "fertilizer" ? "fertilize" : supply?.category === "pesticide" ? "spray" : "note"}
        onJournalAdded={() => {
          fetchHistory();
          setToastMessage("Usage logged");
          setTimeout(() => setToastMessage(null), 2500);
        }}
      />
      </div>
    </div>
  );
}
