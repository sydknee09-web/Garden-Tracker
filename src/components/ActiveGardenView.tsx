"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot, formatWeatherBadge } from "@/lib/weatherSnapshot";
import type { WeatherSnapshotData } from "@/types/garden";

type PendingItem = {
  id: string;
  plant_profile_id: string | null;
  due_date: string;
  title: string;
};

type GrowingBatch = {
  id: string;
  plant_profile_id: string;
  sown_date: string;
  expected_harvest_date: string | null;
  status: string | null;
  profile_name: string;
  profile_variety_name: string | null;
  weather_snapshot: WeatherSnapshotData;
  harvest_count: number;
  planting_method_badge: string | null;
  location?: string | null;
};

export function ActiveGardenView({
  refetchTrigger,
  onLogGrowth,
  onLogHarvest,
  onEndCrop,
}: {
  refetchTrigger: number;
  onLogGrowth: (batch: GrowingBatch) => void;
  onLogHarvest: (batch: GrowingBatch) => void;
  onEndCrop: (batch: GrowingBatch) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [growing, setGrowing] = useState<GrowingBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk select state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Quick-tap toast
  const [quickToast, setQuickToast] = useState<string | null>(null);

  // End batch modal
  const [endBatchTarget, setEndBatchTarget] = useState<GrowingBatch | null>(null);
  const [endReason, setEndReason] = useState<string>("season_ended");
  const [endNote, setEndNote] = useState("");
  const [endSaving, setEndSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const today = new Date().toISOString().slice(0, 10);

    const { data: taskRows } = await supabase
      .from("tasks")
      .select("id, plant_profile_id, due_date, title")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("category", "sow")
      .is("completed_at", null)
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(50);
    setPending((taskRows ?? []) as PendingItem[]);

    const { data: growRows } = await supabase
      .from("grow_instances")
      .select("id, plant_profile_id, sown_date, expected_harvest_date, status, location")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("status", ["growing", "pending"])
      .order("sown_date", { ascending: false })
      .limit(100);

    if (!growRows?.length) { setGrowing([]); setLoading(false); return; }

    const profileIds = Array.from(new Set((growRows as { plant_profile_id: string }[]).map((r) => r.plant_profile_id).filter(Boolean)));
    const { data: profiles } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds);
    const profileMap = new Map((profiles ?? []).map((p: { id: string; name: string; variety_name: string | null }) => [p.id, p]));

    const growIds = (growRows as { id: string }[]).map((r) => r.id);
    const [weatherRes, harvestRes] = await Promise.all([
      supabase.from("journal_entries").select("grow_instance_id, weather_snapshot, note").in("grow_instance_id", growIds).like("note", "Planted%").order("created_at", { ascending: true }),
      supabase.from("journal_entries").select("grow_instance_id").in("grow_instance_id", growIds).eq("entry_type", "harvest"),
    ]);

    const weatherByGrow = new Map<string, WeatherSnapshotData>();
    const plantingNoteByGrow = new Map<string, string>();
    (weatherRes.data ?? []).forEach((j: { grow_instance_id: string; weather_snapshot: WeatherSnapshotData; note?: string }) => {
      if (j.grow_instance_id && !weatherByGrow.has(j.grow_instance_id)) {
        weatherByGrow.set(j.grow_instance_id, j.weather_snapshot ?? null);
        if (j.note?.trim()) plantingNoteByGrow.set(j.grow_instance_id, j.note.trim());
      }
    });
    function badgeFromNote(note: string | undefined): string | null {
      if (!note) return null;
      const hasDirect = /direct\s*sow|direct\s*&|direct\s*and/i.test(note);
      const hasGreenhouse = /greenhouse/i.test(note);
      if (hasDirect && hasGreenhouse) return "Direct & Greenhouse";
      if (hasGreenhouse) return "Greenhouse";
      if (hasDirect) return "Direct";
      return null;
    }
    const harvestCountByGrow = new Map<string, number>();
    (harvestRes.data ?? []).forEach((h: { grow_instance_id: string | null }) => {
      if (h.grow_instance_id) harvestCountByGrow.set(h.grow_instance_id, (harvestCountByGrow.get(h.grow_instance_id) ?? 0) + 1);
    });

    const batches: GrowingBatch[] = (growRows as { id: string; plant_profile_id: string; sown_date: string; expected_harvest_date: string | null; status: string | null; location?: string | null }[])
      .map((r) => {
        const p = profileMap.get(r.plant_profile_id);
        const note = plantingNoteByGrow.get(r.id);
        return {
          id: r.id, plant_profile_id: r.plant_profile_id, sown_date: r.sown_date,
          expected_harvest_date: r.expected_harvest_date, status: r.status,
          profile_name: p?.name ?? "Unknown", profile_variety_name: p?.variety_name ?? null,
          weather_snapshot: weatherByGrow.get(r.id) ?? null, harvest_count: harvestCountByGrow.get(r.id) ?? 0,
          planting_method_badge: badgeFromNote(note), location: r.location,
        };
      });
    setGrowing(batches);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  // Quick-tap handler
  const handleQuickTap = useCallback(async (batch: GrowingBatch, action: "water" | "fertilize" | "spray") => {
    if (!user?.id) return;
    const weather = await fetchWeatherSnapshot();
    const notes: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
    await supabase.from("journal_entries").insert({
      user_id: user.id,
      plant_profile_id: batch.plant_profile_id,
      grow_instance_id: batch.id,
      note: notes[action],
      entry_type: "quick",
      weather_snapshot: weather ?? undefined,
    });
    setQuickToast(`${notes[action]} ${displayName(batch.profile_name, batch.profile_variety_name)}`);
    setTimeout(() => setQuickToast(null), 2000);
  }, [user?.id]);

  // Bulk journal
  const handleBulkSubmit = useCallback(async () => {
    if (!user?.id || bulkSelected.size === 0 || !bulkNote.trim()) return;
    setBulkSaving(true);
    const weather = await fetchWeatherSnapshot();
    const entries = Array.from(bulkSelected).map((growId) => {
      const batch = growing.find((b) => b.id === growId);
      return {
        user_id: user.id,
        plant_profile_id: batch?.plant_profile_id ?? null,
        grow_instance_id: growId,
        note: bulkNote.trim(),
        entry_type: "note" as const,
        weather_snapshot: weather ?? undefined,
      };
    });
    await supabase.from("journal_entries").insert(entries);
    setBulkSaving(false);
    setBulkNote("");
    setBulkSelected(new Set());
    setBulkMode(false);
  }, [user?.id, bulkSelected, bulkNote, growing]);

  // End batch with reason
  const handleEndBatch = useCallback(async () => {
    if (!user?.id || !endBatchTarget) return;
    setEndSaving(true);
    const now = new Date().toISOString();
    const isDead = endReason === "plant_died";
    const status = isDead ? "dead" : "archived";

    await supabase.from("grow_instances").update({
      status,
      ended_at: now,
      end_reason: endReason,
    }).eq("id", endBatchTarget.id).eq("user_id", user.id);

    if (endNote.trim() || isDead) {
      const weather = await fetchWeatherSnapshot();
      await supabase.from("journal_entries").insert({
        user_id: user.id,
        plant_profile_id: endBatchTarget.plant_profile_id,
        grow_instance_id: endBatchTarget.id,
        note: endNote.trim() || (isDead ? "Plant died" : "Batch ended"),
        entry_type: isDead ? "death" : "note",
        weather_snapshot: weather ?? undefined,
      });
    }

    setEndSaving(false);
    setEndBatchTarget(null);
    setEndReason("season_ended");
    setEndNote("");
    load();
  }, [user?.id, endBatchTarget, endReason, endNote, load]);

  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  if (!user) return null;
  if (loading) return <div className="py-8 text-center text-black/50 text-sm">Loading Active Garden...</div>;

  const displayName = (name: string, variety: string | null) => variety?.trim() ? `${name} (${variety})` : name;

  return (
    <div className="space-y-6">
      {/* Quick toast */}
      {quickToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in">
          {quickToast}
        </div>
      )}

      {/* End Batch Modal */}
      {endBatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">End Batch</h2>
            <p className="text-sm text-neutral-600 mb-4">{displayName(endBatchTarget.profile_name, endBatchTarget.profile_variety_name)}</p>
            <div className="space-y-3 mb-4">
              {[
                { value: "season_ended", label: "Season Ended" },
                { value: "harvested_all", label: "Harvested All" },
                { value: "plant_died", label: "Plant Died" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="end-reason" value={opt.value} checked={endReason === opt.value} onChange={() => setEndReason(opt.value)} className="text-emerald-600 focus:ring-emerald-500" />
                  <span className={`text-sm font-medium ${opt.value === "plant_died" ? "text-red-600" : "text-neutral-700"}`}>{opt.label}</span>
                </label>
              ))}
            </div>
            <textarea
              placeholder="Optional note..."
              value={endNote}
              onChange={(e) => setEndNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm mb-4 focus:ring-emerald-500"
            />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEndBatchTarget(null)} className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
              <button type="button" onClick={handleEndBatch} disabled={endSaving} className={`px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${endReason === "plant_died" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                {endSaving ? "Saving..." : endReason === "plant_died" ? "Mark as Dead" : "End Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk mode controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setBulkMode((b) => !b); setBulkSelected(new Set()); }}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg border ${bulkMode ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
        >
          {bulkMode ? `Selecting (${bulkSelected.size})` : "Bulk Journal"}
        </button>
        {bulkMode && bulkSelected.size > 0 && (
          <div className="flex items-center gap-2 flex-1 ml-3">
            <input
              type="text"
              placeholder="Add note to selected..."
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={bulkSaving || !bulkNote.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {bulkSaving ? "..." : "Add"}
            </button>
          </div>
        )}
      </div>

      {/* Pending tasks */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 mb-3 flex items-center gap-2">Pending</h2>
          <ul className="space-y-3">
            {pending.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <span className="min-w-0 flex-1 text-sm font-medium text-black/90">{t.title.replace(/^Sow\s+/, "")}</span>
                <div className="flex shrink-0 flex-col items-end gap-0.5 min-w-[120px]">
                  <span className="text-xs text-black/60 whitespace-nowrap">Due {new Date(t.due_date).toLocaleDateString()}</span>
                  <button type="button" onClick={() => router.push("/calendar")} className="text-xs font-medium text-amber-700 hover:underline">View Calendar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Growing batches */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700 mb-3 flex items-center gap-2">Growing ({growing.length})</h2>
        {growing.length === 0 ? (
          <p className="text-black/50 text-sm py-4">No active batches. Plant from the Seed Vault to see them here.</p>
        ) : (
          <ul className="space-y-4">
            {growing.map((batch) => {
              const sown = new Date(batch.sown_date).getTime();
              const expected = batch.expected_harvest_date ? new Date(batch.expected_harvest_date).getTime() : null;
              const now = Date.now();
              const daysTotal = expected ? Math.max(1, (expected - sown) / 86400000) : null;
              const daysElapsed = (now - sown) / 86400000;
              const progress = daysTotal ? Math.min(1, Math.max(0, daysElapsed / daysTotal)) : null;
              const label = batch.expected_harvest_date ? `Harvest ~${new Date(batch.expected_harvest_date).toLocaleDateString()}` : "No maturity set";

              return (
                <li key={batch.id} className="rounded-xl border border-emerald-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    {/* Bulk checkbox */}
                    {bulkMode && (
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(batch.id)}
                        onChange={() => toggleBulkSelect(batch.id)}
                        className="mt-1 w-5 h-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-black/90">{displayName(batch.profile_name, batch.profile_variety_name)}</p>
                        {batch.planting_method_badge && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{batch.planting_method_badge}</span>}
                        {batch.location && <span className="text-xs text-neutral-500">{batch.location}</span>}
                      </div>
                      <p className="text-xs text-black/50 mt-0.5">
                        Sown {new Date(batch.sown_date).toLocaleDateString()} -- {label}
                        {batch.harvest_count > 0 && <span className="ml-1 text-emerald-600 font-medium"> -- Harvested {batch.harvest_count}x</span>}
                      </p>
                      {progress != null && (
                        <div className="mt-2 h-2 rounded-full bg-black/10 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress * 100}%` }} />
                        </div>
                      )}
                      {batch.weather_snapshot && (
                        <p className="text-xs text-sky-700 mt-2 py-1 px-2 rounded-lg bg-sky-50 border border-sky-100 inline-block">
                          Weather at planting: {formatWeatherBadge(batch.weather_snapshot)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col gap-1">
                      {/* Quick-tap actions */}
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => handleQuickTap(batch, "water")} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs" title="Water" aria-label="Water">
                          💧
                        </button>
                        <button type="button" onClick={() => handleQuickTap(batch, "fertilize")} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs" title="Fertilize" aria-label="Fertilize">
                          🌿
                        </button>
                        <button type="button" onClick={() => handleQuickTap(batch, "spray")} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 text-xs" title="Spray" aria-label="Spray">
                          🧴
                        </button>
                      </div>
                      {/* Main actions */}
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onLogHarvest(batch)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-black/70 hover:bg-black/5" aria-label="Log harvest" title="Log harvest"><BasketIcon /></button>
                        <button type="button" onClick={() => onLogGrowth(batch)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-black/10 bg-white text-black/70 hover:bg-black/5" aria-label="Log growth" title="Log growth"><CameraIcon /></button>
                        <button type="button" onClick={() => setEndBatchTarget(batch)} className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" aria-label="End batch" title="End batch"><ArchiveIcon /></button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CameraIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>; }
function BasketIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.5 10H6.5L5 8z" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M4 10h16" /></svg>; }
function ArchiveIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></svg>; }
