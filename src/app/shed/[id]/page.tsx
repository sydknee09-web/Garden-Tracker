"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, updateWithOfflineQueue, upsertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { QuickAddSupply } from "@/components/QuickAddSupply";
import { parseNpkForDisplay } from "@/lib/supplyProfiles";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { hapticSuccess } from "@/lib/haptics";
import type { SupplyProfile, JournalEntry } from "@/types/garden";

function formatDisplayDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ShedDetailPage() {
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditUser } = useHousehold();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;

  const [supply, setSupply] = useState<SupplyProfile | null>(null);
  const [history, setHistory] = useState<(JournalEntry & { plant_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [usedTodaySaving, setUsedTodaySaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categoryFromUrl = searchParams.get("category");
  const backHref = categoryFromUrl ? `/vault?tab=shed&category=${categoryFromUrl}` : "/vault?tab=shed";
  const canEdit = supply && (supply.user_id === user?.id ? true : canEditUser(supply.user_id));

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

  const handleUsedToday = useCallback(async () => {
    if (!user?.id || !supply?.id) return;
    const optimisticEntry: JournalEntry & { plant_name?: string } = {
      id: "temp-used",
      plant_profile_id: null,
      plant_variety_id: null,
      grow_instance_id: null,
      note: `Used ${supply.name}`,
      photo_url: null,
      image_file_path: null,
      entry_type: "care",
      created_at: new Date().toISOString(),
      user_id: user.id,
    };
    setHistory((prev) => [optimisticEntry, ...prev]);
    setUsedTodaySaving(true);
    const weather = await fetchWeatherSnapshot();
    const { error } = await insertWithOfflineQueue("journal_entries", {
      user_id: user.id,
      supply_profile_id: supply.id,
      note: `Used ${supply.name}`,
      entry_type: "care",
      weather_snapshot: weather ?? undefined,
    });
    setUsedTodaySaving(false);
    if (error) {
      setHistory((prev) => prev.filter((e) => e.id !== "temp-used"));
    } else {
      hapticSuccess();
      fetchHistory();
      setToastMessage("Usage logged");
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [user?.id, supply?.id, supply?.name, fetchHistory]);

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
  const isOwn = supply.user_id === user?.id;

  return (
    <div className="px-6 pb-10">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in" role="status" aria-live="polite">
          {toastMessage}
        </div>
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
        {thumbUrl && (
          <div className="aspect-video bg-neutral-100 relative">
            <img src={thumbUrl} alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">{supply.name}</h1>
              {supply.brand && <p className="text-neutral-600 text-sm">{supply.brand}</p>}
              <span className="inline-block mt-1 text-xs text-neutral-500 bg-neutral-100 rounded px-2 py-0.5">
                {supply.category}
              </span>
              {npk && (
                <span className="ml-2 inline-block text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5">
                  N {npk.n}% | P {npk.p}% | K {npk.k}%
                </span>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="min-w-[44px] min-h-[44px] px-3 rounded-xl border border-black/10 text-sm font-medium hover:bg-black/5 shrink-0"
              >
                Edit
              </button>
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
          {supply.notes && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-black/80">Notes</h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{supply.notes}</p>
            </div>
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
              disabled={usedTodaySaving}
              className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-emerald text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {usedTodaySaving ? "Saving…" : "I used this today"}
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
    </div>
  );
}
