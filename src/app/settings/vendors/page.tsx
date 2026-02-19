"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";

type PacketWithProfile = {
  id: string;
  plant_profile_id: string;
  vendor_name: string | null;
  packet_rating: number | null;
  profile_name: string;
  variety_name: string | null;
};

type VendorGroup = {
  vendor: string;
  avgRating: number | null;
  ratedCount: number;
  totalCount: number;
  packets: PacketWithProfile[];
};

function computeAvg(packets: PacketWithProfile[]): number | null {
  const rated = packets.filter((p) => p.packet_rating != null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, p) => sum + (p.packet_rating as number), 0) / rated.length;
}

function formatAvg(avg: number | null): string {
  if (avg == null) return "--";
  return avg.toFixed(1);
}

export default function VendorScorecardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<VendorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: packetData } = await supabase
        .from("seed_packets")
        .select("id, plant_profile_id, vendor_name, packet_rating")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const profileIds = Array.from(new Set((packetData ?? []).map((p: { plant_profile_id: string }) => p.plant_profile_id)));
      const { data: profiles } = profileIds.length > 0
        ? await supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds).is("deleted_at", null)
        : { data: [] };

      const nameMap: Record<string, { name: string; variety_name: string | null }> = {};
      (profiles ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
        nameMap[p.id] = { name: p.name, variety_name: p.variety_name };
      });

      const packets: PacketWithProfile[] = (packetData ?? []).map((p: { id: string; plant_profile_id: string; vendor_name: string | null; packet_rating: number | null }) => ({
        id: p.id,
        plant_profile_id: p.plant_profile_id,
        vendor_name: p.vendor_name,
        packet_rating: p.packet_rating,
        profile_name: nameMap[p.plant_profile_id]?.name ?? "Unknown",
        variety_name: nameMap[p.plant_profile_id]?.variety_name ?? null,
      }));

      // Group by vendor
      const vendorMap = new Map<string, PacketWithProfile[]>();
      for (const pkt of packets) {
        const key = pkt.vendor_name?.trim() || "Unknown Vendor";
        const list = vendorMap.get(key) ?? [];
        list.push(pkt);
        vendorMap.set(key, list);
      }

      const result: VendorGroup[] = Array.from(vendorMap.entries()).map(([vendor, pkts]) => ({
        vendor,
        avgRating: computeAvg(pkts),
        ratedCount: pkts.filter((p) => p.packet_rating != null).length,
        totalCount: pkts.length,
        packets: pkts,
      }));

      // Sort: rated vendors by avg descending, then unrated alphabetically at bottom
      result.sort((a, b) => {
        if (a.avgRating != null && b.avgRating != null) return b.avgRating - a.avgRating;
        if (a.avgRating != null) return -1;
        if (b.avgRating != null) return 1;
        return a.vendor.localeCompare(b.vendor, undefined, { sensitivity: "base" });
      });

      setGroups(result);
      setLoading(false);
    })();
  }, [user?.id]);

  function toggleVendor(vendor: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  }

  const ratedVendors = groups.filter((g) => g.avgRating != null);
  const unratedVendors = groups.filter((g) => g.avgRating == null);

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center">
        &larr; Back to Settings
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Vendor Scorecard</h1>
      <p className="text-sm text-neutral-500 mb-6">Average packet ratings by vendor, based on your personal ratings.</p>

      {loading ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500 font-medium mb-1">No packets yet</p>
          <p className="text-sm text-neutral-400">Add seed packets to your vault and rate them to see vendor scores here.</p>
        </div>
      ) : ratedVendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center mb-4">
          <p className="text-neutral-500 font-medium mb-1">No ratings yet</p>
          <p className="text-sm text-neutral-400">
            Open a plant in your <Link href="/vault" className="text-emerald-600 underline">Vault</Link>, expand a packet, and tap the stars to add your first rating.
          </p>
        </div>
      ) : null}

      {/* Rated vendors */}
      {ratedVendors.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4">
          {ratedVendors.map((group, idx) => {
            const isOpen = expanded.has(group.vendor);
            return (
              <div key={group.vendor} className={idx > 0 ? "border-t border-neutral-100" : ""}>
                <button
                  type="button"
                  onClick={() => toggleVendor(group.vendor)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-neutral-50 active:bg-neutral-100"
                  aria-expanded={isOpen}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-neutral-900 block truncate">{group.vendor}</span>
                    <span className="text-xs text-neutral-500">
                      {group.ratedCount} of {group.totalCount} rated
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StarRating value={Math.round(group.avgRating!)} size="sm" />
                    <span className="text-sm font-medium text-amber-600 w-8 text-right">{formatAvg(group.avgRating)}</span>
                    <span className="text-neutral-400 text-xs" aria-hidden>{isOpen ? "▴" : "▾"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-neutral-100 bg-neutral-50">
                    {group.packets.map((pkt) => {
                      const label = pkt.profile_name + (pkt.variety_name?.trim() ? ` (${pkt.variety_name})` : "");
                      return (
                        <div key={pkt.id} className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-neutral-100 last:border-b-0">
                          <Link
                            href={`/vault/${pkt.plant_profile_id}`}
                            className="text-sm text-neutral-800 hover:text-emerald-600 hover:underline truncate min-w-0 flex-1"
                          >
                            {label}
                          </Link>
                          <StarRating value={pkt.packet_rating} size="sm" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unrated vendors */}
      {unratedVendors.length > 0 && (
        <>
          <p className="text-xs font-medium uppercase text-neutral-400 tracking-wider mb-2 px-1">Not yet rated</p>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            {unratedVendors.map((group, idx) => {
              const isOpen = expanded.has(group.vendor);
              return (
                <div key={group.vendor} className={idx > 0 ? "border-t border-neutral-100" : ""}>
                  <button
                    type="button"
                    onClick={() => toggleVendor(group.vendor)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-neutral-50 active:bg-neutral-100"
                    aria-expanded={isOpen}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-neutral-900 block truncate">{group.vendor}</span>
                      <span className="text-xs text-neutral-500">{group.totalCount} packet{group.totalCount !== 1 ? "s" : ""} — not yet rated</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-neutral-400">--</span>
                      <span className="text-neutral-400 text-xs" aria-hidden>{isOpen ? "▴" : "▾"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-neutral-100 bg-neutral-50">
                      {group.packets.map((pkt) => {
                        const label = pkt.profile_name + (pkt.variety_name?.trim() ? ` (${pkt.variety_name})` : "");
                        return (
                          <div key={pkt.id} className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-neutral-100 last:border-b-0">
                            <Link
                              href={`/vault/${pkt.plant_profile_id}`}
                              className="text-sm text-neutral-800 hover:text-emerald-600 hover:underline truncate min-w-0 flex-1"
                            >
                              {label}
                            </Link>
                            <span className="text-sm text-neutral-400 shrink-0">--</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
