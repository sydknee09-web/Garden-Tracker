"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export type PacketSelection = { packetId: string; percentUsed: number };

interface PacketRow {
  id: string;
  vendor_name: string | null;
  purchase_date: string | null;
  qty_status: number;
  primary_image_path: string | null;
}

interface Props {
  profileId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (selections: PacketSelection[]) => void;
}

export function PacketPickerModal({ profileId, open, onClose, onConfirm }: Props) {
  const { user } = useAuth();
  const [packets, setPackets] = useState<PacketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    supabase
      .from("seed_packets")
      .select("id, vendor_name, purchase_date, qty_status, primary_image_path")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .or("is_archived.is.null,is_archived.eq.false")
      .gt("qty_status", 0)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setPackets((data ?? []) as PacketRow[]);
        // Default: first packet selected at 50%
        const first = (data ?? [])[0];
        if (first) {
          setSelected({ [(first as PacketRow).id]: Math.min(50, (first as PacketRow).qty_status) });
        } else {
          setSelected({});
        }
        setLoading(false);
      });
  }, [open, user?.id, profileId]);

  useEscapeKey(open, onClose);

  const togglePacket = useCallback((id: string, maxQty: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) { delete next[id]; } else { next[id] = Math.min(50, maxQty); }
      return next;
    });
  }, []);

  const updatePercent = useCallback((id: string, pct: number) => {
    setSelected((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, pct)) }));
  }, []);

  const handleConfirm = useCallback(() => {
    const selections: PacketSelection[] = Object.entries(selected)
      .filter(([, pct]) => pct > 0)
      .map(([packetId, percentUsed]) => ({ packetId, percentUsed }));
    if (selections.length === 0) return;
    onConfirm(selections);
    onClose();
  }, [selected, onConfirm, onClose]);

  if (!open) return null;

  const summary = Object.entries(selected)
    .filter(([, pct]) => pct > 0)
    .map(([pid, pct]) => {
      const p = packets.find((pk) => pk.id === pid);
      return `${pct}% of ${p?.vendor_name?.trim() || "Packet"}`;
    })
    .join(" + ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex-shrink-0 p-5 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Choose Seed Packets</h2>
          <p className="text-sm text-neutral-500 mt-1">Select which packet(s) to use and how much of each.</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <p className="text-neutral-400 text-sm">Loading packets...</p>
          ) : packets.length === 0 ? (
            <p className="text-neutral-500 text-sm">No available packets (all archived or empty).</p>
          ) : (
            packets.map((pkt) => {
              const checked = selected[pkt.id] !== undefined;
              const pctValue = selected[pkt.id] ?? 0;
              const year = pkt.purchase_date ? new Date(pkt.purchase_date).getFullYear() : null;
              const imgUrl = pkt.primary_image_path?.trim() ? supabase.storage.from("seed-packets").getPublicUrl(pkt.primary_image_path).data.publicUrl : null;
              return (
                <div key={pkt.id} className={`rounded-xl border p-3 ${checked ? "border-emerald-300 bg-emerald-50/50" : "border-neutral-200"}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePacket(pkt.id, pkt.qty_status)}
                      className="w-5 h-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                    />
                    {imgUrl && <div className="w-10 h-10 rounded overflow-hidden bg-neutral-100 shrink-0"><img src={imgUrl} alt="" className="w-full h-full object-cover" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{pkt.vendor_name?.trim() || "Unknown Vendor"} {year ? `(${year})` : ""}</p>
                      <p className="text-xs text-neutral-500">{pkt.qty_status}% remaining</p>
                    </div>
                  </div>
                  {checked && (
                    <div className="mt-3 flex items-center gap-3">
                      <label className="text-xs text-neutral-500 shrink-0">Use:</label>
                      <input
                        type="range"
                        min={1}
                        max={pkt.qty_status}
                        value={pctValue}
                        onChange={(e) => updatePercent(pkt.id, Number(e.target.value))}
                        className="flex-1 h-2 rounded-full appearance-none"
                        style={{ background: "linear-gradient(to right, #10b981, #eab308, #ef4444)" }}
                      />
                      <span className="text-xs text-neutral-700 font-medium w-10 text-right">{pctValue}%</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {summary && (
          <div className="flex-shrink-0 px-5 py-2 bg-neutral-50 border-t border-neutral-200">
            <p className="text-xs text-neutral-600">Using: {summary}</p>
          </div>
        )}

        <div className="flex-shrink-0 flex gap-3 justify-end p-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={Object.values(selected).filter((v) => v > 0).length === 0}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
