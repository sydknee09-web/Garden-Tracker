"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type PacketRow = {
  id: string;
  plant_profile_id: string;
  vendor_name: string | null;
  purchase_date: string | null;
  qty_status: number;
  is_archived: boolean | null;
  created_at: string;
  profile_name: string;
  variety_name: string | null;
};

export default function AllPacketsPage() {
  const { user } = useAuth();
  const [packets, setPackets] = useState<PacketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [sortField, setSortField] = useState<"variety" | "vendor" | "date" | "qty">("date");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: packetData } = await supabase
        .from("seed_packets")
        .select("id, plant_profile_id, vendor_name, purchase_date, qty_status, is_archived, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const profileIds = Array.from(new Set((packetData ?? []).map((p: { plant_profile_id: string }) => p.plant_profile_id)));
      const { data: profiles } = profileIds.length > 0
        ? await supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds)
        : { data: [] };

      const nameMap: Record<string, { name: string; variety_name: string | null }> = {};
      (profiles ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
        nameMap[p.id] = { name: p.name, variety_name: p.variety_name };
      });

      setPackets(
        (packetData ?? []).map((p: { id: string; plant_profile_id: string; vendor_name: string | null; purchase_date: string | null; qty_status: number; is_archived: boolean | null; created_at: string }) => ({
          ...p,
          profile_name: nameMap[p.plant_profile_id]?.name ?? "Unknown",
          variety_name: nameMap[p.plant_profile_id]?.variety_name ?? null,
        }))
      );
      setLoading(false);
    })();
  }, [user?.id]);

  const filtered = packets.filter((p) => showArchived || !p.is_archived);
  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "variety") return (a.profile_name + (a.variety_name ?? "")).localeCompare(b.profile_name + (b.variety_name ?? ""));
    if (sortField === "vendor") return (a.vendor_name ?? "").localeCompare(b.vendor_name ?? "");
    if (sortField === "qty") return (b.qty_status ?? 0) - (a.qty_status ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalPackets = packets.length;
  const activePackets = packets.filter((p) => !p.is_archived).length;
  const avgQty = activePackets > 0 ? Math.round(packets.filter((p) => !p.is_archived).reduce((sum, p) => sum + p.qty_status, 0) / activePackets) : 0;

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">&larr; Back to Vault</Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">All My Packets</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-xs text-neutral-500">Total</p>
          <p className="text-lg font-bold text-neutral-900">{totalPackets}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-xs text-neutral-500">Active</p>
          <p className="text-lg font-bold text-emerald-700">{activePackets}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-xs text-neutral-500">Avg Qty</p>
          <p className="text-lg font-bold text-neutral-900">{avgQty}%</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" />
          Show archived
        </label>
        <select value={sortField} onChange={(e) => setSortField(e.target.value as typeof sortField)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:ring-emerald-500">
          <option value="date">Newest first</option>
          <option value="variety">By variety</option>
          <option value="vendor">By vendor</option>
          <option value="qty">By quantity</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">No packets found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Variety</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sorted.map((pkt) => {
                  const qtyColor = pkt.qty_status > 50 ? "text-emerald-600" : pkt.qty_status > 20 ? "text-amber-600" : "text-red-600";
                  return (
                    <tr key={pkt.id} className={`hover:bg-neutral-50 ${pkt.is_archived ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/vault/${pkt.plant_profile_id}`} className="font-medium text-neutral-800 hover:text-emerald-600 hover:underline">
                          {pkt.profile_name}{pkt.variety_name?.trim() ? ` (${pkt.variety_name})` : ""}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{pkt.vendor_name?.trim() || "--"}</td>
                      <td className="px-4 py-3 text-neutral-500">{pkt.purchase_date ? new Date(pkt.purchase_date).toLocaleDateString() : "--"}</td>
                      <td className={`px-4 py-3 font-medium ${qtyColor}`}>{pkt.qty_status}%</td>
                      <td className="px-4 py-3">
                        {pkt.is_archived ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Archived</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
