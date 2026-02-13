"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { fetchScheduleDefaults } from "@/lib/scheduleDefaults";
import { getZone10bScheduleForPlant, toScheduleKey } from "@/data/zone10b_schedule";
import { copyCareTemplatesToInstance } from "@/lib/generateCareTasks";

type Profile = { id: string; name: string; variety_name: string | null; harvest_days: number | null };
type Packet = { id: string; plant_profile_id: string; qty_status: number; created_at?: string; tags?: string[] | null; vendor_name?: string | null };
type ProfileWithPackets = { profile: Profile; packets: Packet[] };
type SowingMethod = "direct_sow" | "greenhouse";

function brainSuggestsGreenhouse(plantName: string, scheduleDefaultsMap: Record<string, { sowing_method?: string }>): boolean {
  const key = toScheduleKey(plantName);
  const userSchedule = key ? scheduleDefaultsMap[key] : undefined;
  const staticSchedule = getZone10bScheduleForPlant(plantName);
  const sowingMethod = (userSchedule?.sowing_method ?? staticSchedule?.sowing_method ?? "").toLowerCase();
  return /indoors|greenhouse|transplant/.test(sowingMethod) && !/direct sow|direct_sow/.test(sowingMethod);
}

function VaultPlantPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [rows, setRows] = useState<ProfileWithPackets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantDate, setPlantDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plantLocation, setPlantLocation] = useState("");
  const [plantNotes, setPlantNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  /** Per-packet: % of that packet to use (0–100). Remaining = 100 - value. */
  const [usePercentByPacketId, setUsePercentByPacketId] = useState<Record<string, number>>({});
  /** For varieties with multiple packets: which packet IDs are included. Default oldest (FIFO). */
  const [selectedPacketIdsByProfileId, setSelectedPacketIdsByProfileId] = useState<Record<string, string[]>>({});
  const [sowingMethodByProfileId, setSowingMethodByProfileId] = useState<Record<string, SowingMethod>>({});
  const [masterSowingMethod, setMasterSowingMethod] = useState<SowingMethod>("direct_sow");
  const [showSeedlingCelebration, setShowSeedlingCelebration] = useState(false);

  const idsParam = searchParams.get("ids");
  const profileIds = idsParam ? idsParam.split(",").filter(Boolean) : [];

  const setUsePercentForPacket = useCallback((packetId: string, value: number) => {
    setUsePercentByPacketId((prev) => ({ ...prev, [packetId]: Math.max(0, Math.min(100, value)) }));
  }, []);

  const togglePacketSelection = useCallback((profileId: string, packetId: string) => {
    setSelectedPacketIdsByProfileId((prev) => {
      const current = prev[profileId] ?? [];
      const next = current.includes(packetId)
        ? current.filter((id) => id !== packetId)
        : [...current, packetId];
      return { ...prev, [profileId]: next };
    });
  }, []);

  const removeVarietyFromBatch = useCallback((profileId: string) => {
    setRows((prev) => prev.filter((r) => r.profile.id !== profileId));
  }, []);

  const setSowingMethodForProfile = useCallback((profileId: string, method: SowingMethod) => {
    setSowingMethodByProfileId((prev) => ({ ...prev, [profileId]: method }));
  }, []);

  const applyMasterSowing = useCallback((method: SowingMethod) => {
    setMasterSowingMethod(method);
    setSowingMethodByProfileId((prev) => {
      const next = { ...prev };
      rows.forEach((r) => { next[r.profile.id] = method; });
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!user?.id || profileIds.length === 0) {
      setLoading(false);
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [profilesRes, packetsRes, scheduleMap] = await Promise.all([
        supabase
          .from("plant_profiles")
          .select("id, name, variety_name, harvest_days")
          .in("id", profileIds)
          .eq("user_id", user.id),
        supabase
          .from("seed_packets")
          .select("id, plant_profile_id, qty_status, created_at, tags, vendor_name")
          .in("plant_profile_id", profileIds)
          .eq("user_id", user.id)
          .or("is_archived.eq.false,is_archived.is.null")
          .order("created_at", { ascending: true }),
        fetchScheduleDefaults(supabase),
      ]);
      if (cancelled) return;
      const profiles = (profilesRes.data ?? []) as Profile[];
      const packets = (packetsRes.data ?? []) as Packet[];
      const byProfile = new Map<string, Packet[]>();
      for (const p of packets) {
        const list = byProfile.get(p.plant_profile_id) ?? [];
        list.push(p);
        byProfile.set(p.plant_profile_id, list);
      }
      const ordered = profileIds
        .map((id) => {
          const profile = profiles.find((p) => p.id === id);
          if (!profile) return null;
          return { profile, packets: byProfile.get(id) ?? [] };
        })
        .filter((r): r is ProfileWithPackets => r != null);
      setRows(ordered);
      const initialSelected: Record<string, string[]> = {};
      const initialUsePercent: Record<string, number> = {};
      ordered.forEach(({ profile, packets }) => {
        if (packets.length) {
          initialSelected[profile.id] = [packets[0].id];
          packets.forEach((p) => { initialUsePercent[p.id] = 100; });
        }
      });
      setSelectedPacketIdsByProfileId(initialSelected);
      setUsePercentByPacketId(initialUsePercent);
      const methodByProfile: Record<string, SowingMethod> = {};
      ordered.forEach(({ profile, packets: pks }) => {
        const suggestsGreenhouse = brainSuggestsGreenhouse(profile.name, scheduleMap as Record<string, { sowing_method?: string }>);
        methodByProfile[profile.id] = suggestsGreenhouse ? "greenhouse" : "direct_sow";
      });
      setSowingMethodByProfileId(methodByProfile);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, idsParam, profileIds.length]);

  const handleConfirm = useCallback(async () => {
    if (!user?.id || rows.length === 0) return;
    setConfirming(true);
    const today = plantDate;
    const weatherSnapshot = await fetchWeatherSnapshot();
    let errMsg: string | null = null;

    for (const { profile, packets } of rows) {
      const selectedIds = selectedPacketIdsByProfileId[profile.id] ?? (packets.length === 1 ? [packets[0].id] : []);
      const method = sowingMethodByProfileId[profile.id] ?? "direct_sow";
      let totalUsed = 0;

      for (const pk of packets) {
        if (!selectedIds.includes(pk.id)) continue;
        const usePct = usePercentByPacketId[pk.id] ?? 0;
        if (usePct <= 0) continue;
        const packetValue = pk.qty_status / 100;
        const take = packetValue * (usePct / 100);
        totalUsed += take;
        const remaining = Math.round((packetValue - take) * 100);
        const newQty = Math.max(0, Math.min(100, remaining));
        const now = new Date().toISOString();
        if (newQty <= 0) {
          await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true, deleted_at: now }).eq("id", pk.id).eq("user_id", user.id);
        } else {
          await supabase.from("seed_packets").update({ qty_status: newQty }).eq("id", pk.id).eq("user_id", user.id);
        }
      }

      if (totalUsed <= 0) continue;

      const harvestDays = profile.harvest_days != null && profile.harvest_days > 0 ? profile.harvest_days : null;
      const expectedHarvestDate =
        harvestDays != null
          ? new Date(new Date(today).getTime() + harvestDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : null;

      const { data: growRow, error: growErr } = await supabase
        .from("grow_instances")
        .insert({
          user_id: user.id,
          plant_profile_id: profile.id,
          sown_date: today,
          expected_harvest_date: expectedHarvestDate ?? null,
          status: "growing",
          location: plantLocation.trim() || null,
        })
        .select("id")
        .single();
      if (growErr || !growRow?.id) {
        errMsg = growErr?.message ?? "Could not create planting record.";
        break;
      }

      const methodLabel = method === "greenhouse" ? "Greenhouse" : "Direct Sow";
      const noteParts = [
        `Planted via ${methodLabel}.`,
        plantNotes.trim() ? plantNotes.trim() : "",
      ].filter(Boolean);
      const note = noteParts.join(" ");
      await supabase.from("journal_entries").insert({
        user_id: user.id,
        plant_profile_id: profile.id,
        grow_instance_id: growRow.id,
        note,
        entry_type: "planting",
        weather_snapshot: weatherSnapshot ?? undefined,
      });

      // Copy care schedule templates to the new grow instance
      await copyCareTemplatesToInstance(profile.id, growRow.id, user.id, today);

      const nowIso = new Date().toISOString();
      const displayName = profile.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile.name;
      await supabase.from("tasks").insert({
        user_id: user.id,
        plant_profile_id: profile.id,
        grow_instance_id: growRow.id,
        category: "sow",
        due_date: today,
        completed_at: nowIso,
        title: `Sow ${displayName}`,
      });
      if (expectedHarvestDate) {
        await supabase.from("tasks").insert({
          user_id: user.id,
          plant_profile_id: profile.id,
          grow_instance_id: growRow.id,
          category: "harvest",
          due_date: expectedHarvestDate,
          title: `Harvest ${displayName}`,
        });
      }

      const { data: remaining } = await supabase
        .from("seed_packets")
        .select("id")
        .eq("plant_profile_id", profile.id)
        .eq("user_id", user.id)
        .or("is_archived.eq.false,is_archived.is.null");
      if (!remaining?.length) {
        await supabase.from("plant_profiles").update({ status: "out_of_stock" }).eq("id", profile.id).eq("user_id", user.id);
        await supabase.from("shopping_list").upsert(
          { user_id: user.id, plant_profile_id: profile.id, is_purchased: false },
          { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false }
        );
      }
    }

    setConfirming(false);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    setError(null);
    setShowSeedlingCelebration(true);
    setTimeout(() => {
      setShowSeedlingCelebration(false);
      router.push("/vault?tab=active");
    }, 1100);
  }, [user?.id, rows, plantDate, plantLocation, plantNotes, usePercentByPacketId, selectedPacketIdsByProfileId, sowingMethodByProfileId, router]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="px-6 py-8">
        <p className="text-black/50 text-sm">Loading…</p>
      </div>
    );
  }

  if (profileIds.length === 0) {
    return (
      <div className="px-6 py-8">
        <Link href="/vault" className="text-emerald-600 font-medium hover:underline">
          ← Back to Vault
        </Link>
        <p className="mt-4 text-black/60">No plants selected. Select items in the Vault and click Plant.</p>
      </div>
    );
  }

  return (
    <div className="px-6 pt-8 pb-40 max-w-2xl mx-auto">
      <div className="text-center mb-4">
        <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-2">
          ← Back to Vault
        </Link>
        <h1 className="text-xl font-semibold text-black mb-1">Planting</h1>
        <p className="text-sm text-black/60 mb-3">
          Set how much of each packet to use. Sliders 0–100%. Confirm to create journal entries and harvest tasks.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="plant-date" className="block text-xs font-medium text-black/60 mb-1">
            Planting date
          </label>
          <input
            id="plant-date"
            type="date"
            value={plantDate}
            onChange={(e) => setPlantDate(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-sm text-black"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="plant-location" className="block text-xs font-medium text-black/60 mb-1">
            Location
          </label>
          <input
            id="plant-location"
            type="text"
            value={plantLocation}
            onChange={(e) => setPlantLocation(e.target.value)}
            placeholder="e.g. Raised bed #2"
            className="w-full min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-sm text-black"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="plant-notes" className="block text-xs font-medium text-black/60 mb-1">
            Notes (optional)
          </label>
          <input
            id="plant-notes"
            type="text"
            value={plantNotes}
            onChange={(e) => setPlantNotes(e.target.value)}
            placeholder="e.g. Started indoors"
            className="w-full min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-sm text-black"
          />
        </div>
      </div>

      <section className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5" aria-label="Apply to All Packets">
        <h2 className="text-xs font-semibold text-emerald-900 mb-1.5">Set All</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2" role="group" aria-label="Sowing method for all">
            <span className="text-xs font-medium text-black/70">Sowing</span>
            <button
              type="button"
              onClick={() => applyMasterSowing("direct_sow")}
              className={`min-w-[44px] min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                masterSowingMethod === "direct_sow"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-black/70 border-gray-300 hover:border-gray-400"
              }`}
            >
              Direct
            </button>
            <button
              type="button"
              onClick={() => applyMasterSowing("greenhouse")}
              className={`min-w-[44px] min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                masterSowingMethod === "greenhouse"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-black/70 border-gray-300 hover:border-gray-400"
              }`}
            >
              Greenhouse
            </button>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full border-collapse text-sm" role="grid" aria-label="Planting varieties">
          <thead>
            <tr className="border-b border-black/10">
              <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 w-[36%] min-w-[100px]">Variety Name</th>
              <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 w-[22%]">Sowing Method</th>
              <th className="text-left py-2.5 pr-3 text-xs font-semibold text-black/70 min-w-[90px]">Remaining Inventory</th>
              <th className="text-right py-2.5 pl-3 text-xs font-semibold text-black/70 w-[52px]">Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ profile, packets }) => {
              const displayName = profile.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile.name;
              const hasF1 = packets.some((pk) => Array.isArray(pk.tags) && pk.tags.some((t) => String(t).toLowerCase() === "f1"));
              const selectedIds = selectedPacketIdsByProfileId[profile.id] ?? (packets.length === 1 ? [packets[0].id] : []);
              const selectedPackets = packets.filter((p) => selectedIds.includes(p.id));
              const method = sowingMethodByProfileId[profile.id] ?? "direct_sow";
              if (packets.length === 0) {
                return (
                  <tr key={profile.id} className="border-b border-black/5 align-middle">
                    <td colSpan={3} className="py-3 pr-3 text-xs text-black/50">
                      {displayName} — No packets
                    </td>
                    <td className="py-3 pl-3 text-right align-middle w-[52px]">
                      <button type="button" onClick={() => removeVarietyFromBatch(profile.id)} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50" aria-label={`Remove ${displayName} from batch`}><TrashIcon /></button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={profile.id} className="border-b border-black/5 align-middle">
                  <td className="py-3 pr-3 min-w-0 align-top">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-black line-clamp-2 inline-flex items-center gap-1.5 flex-wrap" title={displayName}>
                        {displayName}
                        {hasF1 && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="F1 hybrid – seeds may not breed true">F1</span>}
                      </span>
                      {packets.length > 1 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1" role="group" aria-label={`Select packets for ${displayName}`}>
                          {packets.map((pk, idx) => {
                            const checked = selectedIds.includes(pk.id);
                            const vendor = (pk.vendor_name ?? "").trim() || "Vendor";
                            const sameVendorCount = packets.filter((p) => ((p.vendor_name ?? "").trim() || "") === ((pk.vendor_name ?? "").trim() || "")).length;
                            const label = sameVendorCount > 1
                              ? `${vendor} (${packets.filter((p) => ((p.vendor_name ?? "").trim() || "") === ((pk.vendor_name ?? "").trim() || "")).findIndex((p) => p.id === pk.id) + 1})`
                              : vendor;
                            return (
                              <label key={pk.id} className="flex items-center gap-1.5 cursor-pointer text-xs text-black/70">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePacketSelection(profile.id, pk.id)}
                                  className="rounded border-gray-400"
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <div className="flex items-center gap-1.5" role="group" aria-label={`${displayName} sowing method`}>
                      <button
                        type="button"
                        onClick={() => setSowingMethodForProfile(profile.id, "direct_sow")}
                        className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                          method === "direct_sow" ? "bg-green-700 text-white border-green-700" : "bg-white text-black/70 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        Direct
                      </button>
                      <button
                        type="button"
                        onClick={() => setSowingMethodForProfile(profile.id, "greenhouse")}
                        className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                          method === "greenhouse" ? "bg-green-700 text-white border-green-700" : "bg-white text-black/70 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        Greenhouse
                      </button>
                    </div>
                  </td>
                  <td className="py-3 pr-3 min-w-[90px] align-middle">
                    <div className="flex flex-col gap-2">
                      {selectedPackets.length === 0 ? (
                        <span className="text-xs text-black/50">Select packets above</span>
                      ) : (
                        selectedPackets.map((pk, idx) => {
                          const usePct = usePercentByPacketId[pk.id] ?? 0;
                          const remainingPct = 100 - usePct;
                          const pktQty = pk.qty_status / 100;
                          const vendor = (pk.vendor_name ?? "").trim() || "Vendor";
                          const sameVendor = selectedPackets.filter((p) => ((p.vendor_name ?? "").trim() || "") === (vendor === "Vendor" ? "" : vendor));
                          const label = selectedPackets.length > 1 ? (sameVendor.length > 1 ? `${vendor} (${sameVendor.findIndex((p) => p.id === pk.id) + 1})` : vendor) : null;
                          return (
                            <div key={pk.id} className="flex items-center gap-2 min-h-[44px]">
                              {label && <span className="text-[10px] font-medium text-black/50 w-8 shrink-0">{label}</span>}
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={remainingPct}
                                onChange={(e) => setUsePercentForPacket(pk.id, 100 - Number(e.target.value))}
                                className="range-thumb-lg flex-1 min-w-0"
                                style={{ touchAction: "none" }}
                                aria-label={`${displayName} packet ${idx + 1} remaining (${pktQty.toFixed(1)} pkts)`}
                              />
                              <span className="text-xs text-black/70 tabular-nums shrink-0">
                                {remainingPct}% <span className="text-black/50">({pktQty.toFixed(1)})</span>
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="py-3 pl-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => removeVarietyFromBatch(profile.id)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${displayName} from batch`}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {showSeedlingCelebration && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-500/90"
          role="status"
          aria-live="polite"
          aria-label="Planting saved"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <span className="absolute text-4xl seedling-celebration-seed" aria-hidden>🌰</span>
              <span className="text-5xl seedling-celebration-sprout" aria-hidden>🌱</span>
            </div>
            <p className="text-white font-semibold text-lg">Planted!</p>
          </div>
        </div>
      )}

      <div
        className="fixed left-0 right-0 bottom-20 z-[100] p-4 bg-paper border-t border-black/10 shadow-card"
        style={{ paddingBottom: "max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))" }}
      >
        <button
          type="button"
          disabled={
            confirming ||
            rows.length === 0 ||
            !rows.some((r) => {
              const ids = selectedPacketIdsByProfileId[r.profile.id] ?? (r.packets.length === 1 ? [r.packets[0].id] : []);
              return ids.some((pid) => (usePercentByPacketId[pid] ?? 0) > 0);
            })
          }
          onClick={handleConfirm}
          className="w-full min-h-[56px] rounded-xl bg-emerald-500 text-white text-lg font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
        >
          {confirming ? "Planting…" : "Confirm Planting"}
        </button>
      </div>
    </div>
  );
}

export default function VaultPlantPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-600">Loading…</div>}>
      <VaultPlantPageInner />
    </Suspense>
  );
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
