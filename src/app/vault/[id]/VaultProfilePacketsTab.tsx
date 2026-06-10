"use client";

import Link from "next/link";
import type { SeedPacket } from "@/types/garden";
import { ICON_MAP } from "@/lib/styleDictionary";
import { qtyStatusToLabel } from "@/lib/packetQtyLabels";
import { getPacketImageUrls } from "./vaultProfileUtils";

export interface VaultProfilePacketsTabProps {
  sortedPackets: SeedPacket[];
  packetImagesByPacketId: Map<string, { image_path: string }[]>;
  canEdit: boolean;
  isPermanent: boolean;
  profileId: string;
  setAddPlantManualOpen: (v: boolean) => void;
}

/**
 * Summary list of a profile's packets. Each row taps through to the dedicated packet
 * detail page (`/vault/packets/[id]`), which is the canonical surface for per-packet
 * inventory + vendor-specific facts (VISION §1 four roles: packet = inventory + vendor facts).
 */
export function VaultProfilePacketsTab({
  sortedPackets,
  packetImagesByPacketId,
  canEdit,
  isPermanent,
  profileId,
  setAddPlantManualOpen,
}: VaultProfilePacketsTabProps) {
  if (sortedPackets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <p className="text-neutral-500 text-sm">No packets for this variety yet.</p>
        {canEdit && !isPermanent && (
          <>
            <p className="text-neutral-400 text-xs mt-1 mb-4">Add one by scanning, uploading, or typing in the details.</p>
            <button
              type="button"
              onClick={() => setAddPlantManualOpen(true)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-900 text-white font-medium text-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-900 focus:ring-offset-2"
            >
              Add a Packet
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <ul className="divide-y divide-neutral-100">
        {sortedPackets.map((pkt) => {
          const year = pkt.purchase_date ? new Date(pkt.purchase_date).getFullYear() : null;
          const extraImgs = packetImagesByPacketId.get(pkt.id) ?? [];
          const pktImageUrl = getPacketImageUrls(pkt, extraImgs)[0] ?? null;
          const isArchived = pkt.is_archived || (pkt.qty_status ?? 0) <= 0;
          return (
            <li key={pkt.id}>
              <Link
                href={`/vault/packets/${pkt.id}?from=profile&profileId=${profileId}`}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left min-h-[44px] hover:bg-gray-50 transition-colors ${isArchived ? "bg-neutral-50" : ""}`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center ${isArchived ? "bg-neutral-200 opacity-80" : "bg-neutral-100"}`}>
                  {pktImageUrl ? (
                    <img src={pktImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ICON_MAP.SeedPacket className="w-5 h-5 text-neutral-400" aria-hidden />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold truncate ${isArchived ? "text-neutral-500" : "text-neutral-900"}`}>
                    {pkt.vendor_name?.trim() || "—"}
                  </span>
                  {year != null && <span className="block text-xs text-neutral-500">{year}</span>}
                </span>
                <span className="shrink-0 inline-flex items-center">
                  {isArchived ? (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">Out</span>
                  ) : (
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded text-xs font-medium bg-black/10 text-neutral-700">{qtyStatusToLabel(pkt.qty_status)}</span>
                  )}
                </span>
                <ICON_MAP.ChevronRight className="w-4 h-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {canEdit && !isPermanent && (
        <div className="p-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => setAddPlantManualOpen(true)}
            className="min-h-[44px] min-w-[44px] px-3 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            + Add Another Packet
          </button>
        </div>
      )}
    </div>
  );
}
