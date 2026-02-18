"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { getZone10bScheduleForPlant } from "@/data/zone10b_schedule";
import { copyCareTemplatesToInstance } from "@/lib/generateCareTasks";

type Profile = { id: string; name: string; variety_name: string | null; harvest_days: number | null; sowing_method?: string | null };
type Packet = { id: string; plant_profile_id: string; qty_status: number; created_at?: string; tags?: string[] | null; vendor_name?: string | null };
type ProfileWithPackets = { profile: Profile; packets: Packet[] };
type NewVarietyRow = { isNew: true; customName: string; rowId: string };
type PlantRow = ProfileWithPackets | NewVarietyRow;
type SowingMethod = "direct_sow" | "greenhouse";

function parseNameVariety(text: string): { name: string; variety_name: string | null } {
  const trimmed = text.trim();
  const match = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(trimmed);
  if (match) return { name: match[1].trim(), variety_name: match[2].trim() || null };
  return { name: trimmed || "", variety_name: null };
}

function suggestsGreenhouse(plantName: string): boolean {
  const schedule = getZone10bScheduleForPlant(plantName);
  const sowingMethod = (schedule?.sowing_method ?? "").toLowerCase();
  return /indoors|greenhouse|transplant/.test(sowingMethod) && !/direct sow|direct_sow/.test(sowingMethod);
}

function VaultPlantPageInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [rows, setRows] = useState<PlantRow[]>([]);
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
  const [addSeedOpen, setAddSeedOpen] = useState(false);
  const [addSeedSearch, setAddSeedSearch] = useState("");
  const [availableProfilesForPicker, setAvailableProfilesForPicker] = useState<ProfileWithPackets[]>([]);
  /** For profiles with no existing packets: vendor name for the new packet to create */
  const [newPacketVendorByProfileId, setNewPacketVendorByProfileId] = useState<Record<string, string>>({});
  /** For profiles with no existing packets: % of the new packet to use (0–100, default 100) */
  const [newPacketUsePctByProfileId, setNewPacketUsePctByProfileId] = useState<Record<string, number>>({});

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

  const removeRowFromBatch = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => ("profile" in r ? r.profile.id : r.rowId) !== id));
    setSowingMethodByProfileId((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setNewPacketVendorByProfileId((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setNewPacketUsePctByProfileId((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const setSowingMethodForProfile = useCallback((profileId: string, method: SowingMethod) => {
    setSowingMethodByProfileId((prev) => ({ ...prev, [profileId]: method }));
  }, []);

  const applyMasterSowing = useCallback((method: SowingMethod) => {
    setMasterSowingMethod(method);
    setSowingMethodByProfileId((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        const id = "profile" in r ? r.profile.id : r.rowId;
        next[id] = method;
      });
      return next;
    });
  }, [rows]);

  const addSeedToBatch = useCallback((row: PlantRow) => {
    setRows((prev) => [...prev, row]);
    if ("profile" in row) {
      const { profile, packets } = row;
      if (packets.length) {
        setSelectedPacketIdsByProfileId((p) => ({ ...p, [profile.id]: [packets[0].id] }));
        packets.forEach((p) => setUsePercentByPacketId((u) => ({ ...u, [p.id]: 100 })));
      } else {
        // No existing packets — default new packet to 100% use
        setNewPacketUsePctByProfileId((p) => ({ ...p, [profile.id]: 100 }));
      }
    }
    setAddSeedOpen(false);
    setAddSeedSearch("");
  }, []);

  const addNewVarietyToBatch = useCallback((customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const rowId = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const useGreenhouse = suggestsGreenhouse(parseNameVariety(trimmed).name);
    setRows((prev) => [...prev, { isNew: true, customName: trimmed, rowId }]);
    setSowingMethodByProfileId((prev) => ({ ...prev, [rowId]: useGreenhouse ? "greenhouse" : "direct_sow" }));
    setAddSeedOpen(false);
    setAddSeedSearch("");
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (profileIds.length === 0) {
      setLoading(false);
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [profilesRes, packetsRes] = await Promise.all([
        supabase
          .from("plant_profiles")
          .select("id, name, variety_name, harvest_days, sowing_method")
          .in("id", profileIds)
          .eq("user_id", user.id),
        supabase
          .from("seed_packets")
          .select("id, plant_profile_id, qty_status, created_at, tags, vendor_name")
          .in("plant_profile_id", profileIds)
          .eq("user_id", user.id)
          .or("is_archived.eq.false,is_archived.is.null")
          .order("created_at", { ascending: true }),
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
      const initialNewPktUsePct: Record<string, number> = {};
      ordered.forEach(({ profile, packets }) => {
        if (packets.length) {
          initialSelected[profile.id] = [packets[0].id];
          packets.forEach((p) => { initialUsePercent[p.id] = 100; });
        } else {
          // No existing packets — pre-seed new-packet state so the row is interactive immediately
          initialNewPktUsePct[profile.id] = 100;
        }
      });
      setSelectedPacketIdsByProfileId(initialSelected);
      setUsePercentByPacketId(initialUsePercent);
      setNewPacketUsePctByProfileId(initialNewPktUsePct);
      const methodByProfile: Record<string, SowingMethod> = {};
      ordered.forEach(({ profile }) => {
        const useGreenhouse = suggestsGreenhouse(profile.name);
        methodByProfile[profile.id] = useGreenhouse ? "greenhouse" : "direct_sow";
      });
      setSowingMethodByProfileId(methodByProfile);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, idsParam, profileIds.length]);

  useEffect(() => {
    if (!user?.id || !addSeedOpen) return;
    let cancelled = false;
    (async () => {
      const { data: profiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, harvest_days")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      if (cancelled || !profiles?.length) {
        setAvailableProfilesForPicker([]);
        return;
      }
      const { data: packets } = await supabase
        .from("seed_packets")
        .select("id, plant_profile_id, qty_status, created_at, tags, vendor_name")
        .in("plant_profile_id", profiles.map((p) => p.id))
        .eq("user_id", user.id)
        .or("is_archived.eq.false,is_archived.is.null")
        .order("created_at", { ascending: true });
      const byProfile = new Map<string, Packet[]>();
      (packets ?? []).forEach((p) => {
        const list = byProfile.get(p.plant_profile_id) ?? [];
        list.push(p as Packet);
        byProfile.set(p.plant_profile_id, list);
      });
      const withPackets = profiles
        .map((p) => ({ profile: p as Profile, packets: byProfile.get(p.id) ?? [] })) as ProfileWithPackets[];
      if (!cancelled) setAvailableProfilesForPicker(withPackets);
    })();
    return () => { cancelled = true; };
  }, [user?.id, addSeedOpen]);

  const handleConfirm = useCallback(async () => {
    if (!user?.id || rows.length === 0) return;
    setConfirming(true);
    let errMsg: string | null = null;
    try {
    const today = plantDate;
    const weatherSnapshot = await fetchWeatherSnapshot();

    for (const row of rows) {
      let profile: Profile;
      let totalUsed: number;

      if ("isNew" in row) {
        const { name, variety_name } = parseNameVariety(row.customName);
        if (!name.trim()) continue;
        const { data: newProfile, error: profileErr } = await supabase
          .from("plant_profiles")
          .insert({ user_id: user.id, name: name.trim(), variety_name: variety_name?.trim() || null, status: "in_stock" })
          .select("id, name, variety_name, harvest_days")
          .single();
        if (profileErr || !newProfile) {
          errMsg = profileErr?.message ?? "Could not create plant profile.";
          break;
        }
        profile = newProfile as Profile;
        const newVarietyVendor = (newPacketVendorByProfileId[row.rowId] ?? "").trim() || null;
        const { data: newPacket, error: packetErr } = await supabase
          .from("seed_packets")
          .insert({ user_id: user.id, plant_profile_id: profile.id, qty_status: 100, vendor_name: newVarietyVendor })
          .select("id")
          .single();
        if (packetErr || !newPacket) {
          errMsg = packetErr?.message ?? "Could not create seed packet.";
          break;
        }
        await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true, deleted_at: new Date().toISOString() }).eq("id", newPacket.id).eq("user_id", user.id);
        totalUsed = 1;
      } else {
        const { profile: p, packets } = row;
        profile = p;
        if (packets.length === 0) {
          // No existing packets — a new one will be created on confirm
          totalUsed = (newPacketUsePctByProfileId[profile.id] ?? 100) / 100;
        } else {
          const selectedIds = selectedPacketIdsByProfileId[profile.id] ?? (packets.length === 1 ? [packets[0].id] : []);
          totalUsed = 0;
          // Pre-calculate totalUsed — don't write packets yet (write after grow_instance succeeds)
          for (const pk of packets) {
            if (!selectedIds.includes(pk.id)) continue;
            const usePct = usePercentByPacketId[pk.id] ?? 0;
            if (usePct <= 0) continue;
            const packetValue = pk.qty_status / 100;
            const take = packetValue * (usePct / 100);
            totalUsed += take;
          }
        }
      }

      const method = sowingMethodByProfileId["profile" in row ? row.profile.id : row.rowId] ?? "direct_sow";
      if (totalUsed <= 0 && !("isNew" in row)) continue;

      const harvestDays = profile.harvest_days != null && profile.harvest_days > 0 ? profile.harvest_days : null;
      const expectedHarvestDate =
        harvestDays != null
          ? new Date(new Date(today).getTime() + harvestDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : null;

      // Create grow_instance FIRST — if this fails we don't want to have already archived the packet
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

      // Grow instance saved — now safe to write/create packets
      if (!("isNew" in row)) {
        const { profile: p2, packets } = row as ProfileWithPackets;
        const now = new Date().toISOString();
        if (packets.length === 0) {
          // Create a new seed packet on-the-fly for this profile
          const vendorName = (newPacketVendorByProfileId[p2.id] ?? "").trim() || null;
          const usePct = newPacketUsePctByProfileId[p2.id] ?? 100;
          const newQty = Math.max(0, 100 - usePct);
          const { data: newPkt } = await supabase
            .from("seed_packets")
            .insert({ user_id: user.id, plant_profile_id: p2.id, qty_status: 100, vendor_name: vendorName })
            .select("id")
            .single();
          if (newPkt?.id) {
            if (newQty <= 0) {
              await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true, deleted_at: now }).eq("id", newPkt.id).eq("user_id", user.id);
            } else {
              await supabase.from("seed_packets").update({ qty_status: newQty }).eq("id", newPkt.id).eq("user_id", user.id);
            }
            // Link the new packet back to the grow instance
            await supabase.from("grow_instances").update({ seed_packet_id: newPkt.id }).eq("id", growRow.id).eq("user_id", user.id);
          }
        } else {
          const selectedIds = selectedPacketIdsByProfileId[p2.id] ?? (packets.length === 1 ? [packets[0].id] : []);
          for (const pk of packets) {
            if (!selectedIds.includes(pk.id)) continue;
            const usePct = usePercentByPacketId[pk.id] ?? 0;
            if (usePct <= 0) continue;
            const packetValue = pk.qty_status / 100;
            const take = packetValue * (usePct / 100);
            const remaining = Math.round((packetValue - take) * 100);
            const newQty = Math.max(0, Math.min(100, remaining));
            if (newQty <= 0) {
              await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true, deleted_at: now }).eq("id", pk.id).eq("user_id", user.id);
            } else {
              await supabase.from("seed_packets").update({ qty_status: newQty }).eq("id", pk.id).eq("user_id", user.id);
            }
          }
        }
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

    if (errMsg) {
      setError(errMsg);
      return;
    }
    setError(null);
    setShowSeedlingCelebration(true);
    setTimeout(() => {
      setShowSeedlingCelebration(false);
      // Use hard navigation for reliable post-submit redirect (avoids PWA/client-router quirks)
      window.location.href = "/vault?tab=active";
    }, 800);
    } finally {
      setConfirming(false);
    }
  }, [user?.id, rows, plantDate, plantLocation, plantNotes, usePercentByPacketId, selectedPacketIdsByProfileId, sowingMethodByProfileId]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="px-6 py-8">
        <p className="text-black/50 text-sm">Loading…</p>
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
            {rows.map((row) => {
              if ("isNew" in row) {
                const method = sowingMethodByProfileId[row.rowId] ?? "direct_sow";
                return (
                  <tr key={row.rowId} className="border-b border-black/5 align-top">
                    <td className="py-2 pr-3 min-w-0 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-black">{row.customName}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">New variety</span>
                        </div>
                        <input
                          type="text"
                          value={newPacketVendorByProfileId[row.rowId] ?? ""}
                          onChange={(e) => setNewPacketVendorByProfileId((prev) => ({ ...prev, [row.rowId]: e.target.value }))}
                          placeholder="Vendor (optional)"
                          className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 min-h-[44px]"
                          aria-label={`Vendor for new ${row.customName} packet`}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-3 align-middle">
                      <div className="flex items-center gap-1.5" role="group">
                        <button type="button" onClick={() => setSowingMethodForProfile(row.rowId, "direct_sow")} className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${method === "direct_sow" ? "bg-green-700 text-white border-green-700" : "bg-white text-black/70 border-gray-300 hover:border-gray-400"}`}>Direct</button>
                        <button type="button" onClick={() => setSowingMethodForProfile(row.rowId, "greenhouse")} className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${method === "greenhouse" ? "bg-green-700 text-white border-green-700" : "bg-white text-black/70 border-gray-300 hover:border-gray-400"}`}>Greenhouse</button>
                      </div>
                    </td>
                    <td className="py-2 pr-3 min-w-[90px] align-middle">
                      <span className="text-xs text-black/70">100% (full packet)</span>
                    </td>
                    <td className="py-2 pl-3 text-right align-middle">
                      <button type="button" onClick={() => removeRowFromBatch(row.rowId)} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50" aria-label={`Remove ${row.customName} from batch`}><TrashIcon /></button>
                    </td>
                  </tr>
                );
              }
              const { profile, packets } = row;
              const displayName = profile.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile.name;
              const hasF1 = packets.some((pk) => Array.isArray(pk.tags) && pk.tags.some((t) => String(t).toLowerCase() === "f1"));
              const selectedIds = selectedPacketIdsByProfileId[profile.id] ?? (packets.length === 1 ? [packets[0].id] : []);
              const selectedPackets = packets.filter((p) => selectedIds.includes(p.id));
              const method = sowingMethodByProfileId[profile.id] ?? "direct_sow";
              if (packets.length === 0) {
                const newUsePct = newPacketUsePctByProfileId[profile.id] ?? 100;
                const remainingPct = 100 - newUsePct;
                return (
                  <tr key={profile.id} className="border-b border-black/5 align-top">
                    <td className="py-2 pr-3 min-w-0 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-black line-clamp-2">{displayName}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 self-start">New packet</span>
                        <input
                          type="text"
                          value={newPacketVendorByProfileId[profile.id] ?? ""}
                          onChange={(e) => setNewPacketVendorByProfileId((prev) => ({ ...prev, [profile.id]: e.target.value }))}
                          placeholder="Vendor (optional)"
                          className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 min-h-[44px]"
                          aria-label={`Vendor for new ${displayName} packet`}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-3 align-middle">
                      <div className="flex items-center gap-1.5" role="group" aria-label={`${displayName} sowing method`}>
                        <button type="button" onClick={() => setSowingMethodForProfile(profile.id, "direct_sow")} className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${method === "direct_sow" ? "bg-green-700 text-white border-green-700" : "bg-white text-black/70 border-gray-300 hover:border-gray-400"}`}>Direct</button>
                        <button type="button" onClick={() => setSowingMethodForProfile(profile.id, "greenhouse")} className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${method === "greenhouse" ? "bg-green-700 text-white border-green-700" : "bg-white text-black/70 border-gray-300 hover:border-gray-400"}`}>Greenhouse</button>
                      </div>
                    </td>
                    <td className="py-2 pr-3 min-w-[90px] align-middle">
                      <div className="flex items-center gap-2 min-h-[44px]">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={remainingPct}
                          onChange={(e) => setNewPacketUsePctByProfileId((prev) => ({ ...prev, [profile.id]: 100 - Number(e.target.value) }))}
                          className="range-thumb-lg flex-1 min-w-0"
                          style={{ touchAction: "none" }}
                          aria-label={`${displayName} new packet remaining`}
                        />
                        <span className="text-xs text-black/70 tabular-nums shrink-0">{remainingPct}%</span>
                      </div>
                    </td>
                    <td className="py-2 pl-3 text-right align-middle">
                      <button type="button" onClick={() => removeRowFromBatch(profile.id)} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50" aria-label={`Remove ${displayName} from batch`}><TrashIcon /></button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={profile.id} className="border-b border-black/5 align-middle">
                  <td className="py-2 pr-3 min-w-0 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-black line-clamp-2 inline-flex items-center gap-1.5 flex-wrap" title={displayName}>
                        {displayName}
                        {hasF1 && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="F1 hybrid – seeds may not breed true">F1</span>}
                      </span>
                      {packets.length === 1 && (
                        <span className="text-xs text-black/45 truncate">
                          {(packets[0].vendor_name ?? "").trim() || "—"}
                        </span>
                      )}
                      {packets.length > 1 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5" role="group" aria-label={`Select packets for ${displayName}`}>
                          {packets.map((pk, idx) => {
                            const checked = selectedIds.includes(pk.id);
                            const vendor = (pk.vendor_name ?? "").trim() || "—";
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
                  <td className="py-2 pr-3 align-middle">
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
                  <td className="py-2 pr-3 min-w-[90px] align-middle">
                    <div className="flex flex-col gap-1.5">
                      {selectedPackets.length === 0 ? (
                        <span className="text-xs text-black/50">Select packets above</span>
                      ) : (
                        selectedPackets.map((pk, idx) => {
                          const usePct = usePercentByPacketId[pk.id] ?? 0;
                          const remainingPct = 100 - usePct;
                          const pktQty = pk.qty_status / 100;
                          return (
                            <div key={pk.id} className="flex items-center gap-2 min-h-[44px]">
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
                  <td className="py-2 pl-3 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => removeRowFromBatch(profile.id)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/50 hover:text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${displayName} from batch`}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-black/5">
              <td colSpan={4} className="py-2 pr-3 pl-3">
                <button
                  type="button"
                  onClick={() => setAddSeedOpen(true)}
                  className="flex items-center gap-2 w-full min-h-[44px] rounded-lg border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50/80 hover:border-emerald-400 font-medium text-sm transition-colors"
                  aria-label="Add seed to planting"
                >
                  <PlusIcon className="w-5 h-5 shrink-0" />
                  Add Seed
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {addSeedOpen && (
        <>
          <div className="fixed inset-0 z-[110] bg-black/40" aria-hidden onClick={() => { setAddSeedOpen(false); setAddSeedSearch(""); }} />
          <div className="fixed left-4 right-4 top-1/2 z-[111] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto" role="dialog" aria-modal="true" aria-labelledby="add-seed-title">
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/10">
              <h2 id="add-seed-title" className="text-lg font-semibold text-black">Add Seed</h2>
              <button type="button" onClick={() => { setAddSeedOpen(false); setAddSeedSearch(""); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5" aria-label="Close">×</button>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              <input
                type="text"
                value={addSeedSearch}
                onChange={(e) => setAddSeedSearch(e.target.value)}
                placeholder="Search existing or type new variety"
                className="w-full min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-sm mb-3"
                aria-label="Search seeds or type new variety"
              />
              <div className="space-y-1 max-h-[280px] overflow-y-auto">
                {addSeedSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => addNewVarietyToBatch(addSeedSearch)}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 min-h-[44px]"
                  >
                    + Add &quot;{addSeedSearch.trim()}&quot; as new variety
                  </button>
                )}
                {availableProfilesForPicker
                  .filter((r) => {
                    const q = addSeedSearch.trim().toLowerCase();
                    if (!q) return true;
                    const dn = (r.profile.variety_name?.trim() ? `${r.profile.name} (${r.profile.variety_name})` : r.profile.name).toLowerCase();
                    return dn.includes(q) || r.profile.name.toLowerCase().includes(q) || (r.profile.variety_name ?? "").toLowerCase().includes(q);
                  })
                  .filter((r) => !rows.some((row) => "profile" in row && row.profile.id === r.profile.id))
                  .map((r) => {
                    const displayName = r.profile.variety_name?.trim() ? `${r.profile.name} (${r.profile.variety_name})` : r.profile.name;
                    const noPackets = r.packets.length === 0;
                    return (
                      <button
                        key={r.profile.id}
                        type="button"
                        onClick={() => addSeedToBatch(r)}
                        className="w-full text-left px-4 py-3 rounded-lg text-sm text-black/80 hover:bg-black/5 min-h-[44px] flex items-center justify-between gap-2"
                      >
                        <span>{displayName}</span>
                        {noPackets && (
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">+ new packet</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}

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
        className="fixed left-0 right-0 bottom-20 z-[100] px-4 py-2.5 bg-paper border-t border-black/10 shadow-card"
        style={{ paddingBottom: "max(0.625rem, calc(0.625rem + env(safe-area-inset-bottom, 0px)))" }}
      >
        <button
          type="button"
          disabled={
            confirming ||
            rows.length === 0 ||
            !rows.some((r) => {
              if ("isNew" in r) return true;
              // No existing packets: allow if the new-packet use% > 0
              if (r.packets.length === 0) return (newPacketUsePctByProfileId[r.profile.id] ?? 100) > 0;
              const ids = selectedPacketIdsByProfileId[r.profile.id] ?? (r.packets.length === 1 ? [r.packets[0].id] : []);
              return ids.some((pid) => (usePercentByPacketId[pid] ?? 0) > 0);
            })
          }
          onClick={handleConfirm}
          className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-white text-base font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
