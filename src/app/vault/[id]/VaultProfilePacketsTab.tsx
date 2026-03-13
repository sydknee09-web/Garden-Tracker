"use client";

import type { SeedPacket, GrowInstance } from "@/types/garden";
import { PacketQtyOptions } from "@/components/PacketQtyOptions";
import { StarRating } from "@/components/StarRating";
import { ICON_MAP } from "@/lib/styleDictionary";
import { getPacketImageUrls, toDateInputValue, formatDisplayDate } from "./vaultProfileUtils";

export interface VaultProfilePacketsTabProps {
  sortedPackets: SeedPacket[];
  packetImagesByPacketId: Map<string, { image_path: string }[]>;
  journalByPacketId: Record<string, { id: string; note: string | null; created_at: string; grow_instance_id?: string | null }[]>;
  loadingJournalForPacket: Set<string>;
  growInstances: GrowInstance[];
  canEdit: boolean;
  isPermanent: boolean;
  openPacketDetails: Set<string>;
  togglePacketDetails: (packetId: string) => void;
  updatePacketRating: (packetId: string, rating: number | null) => void;
  updatePacketPurchaseDate: (packetId: string, date: string) => void;
  updatePacketQty: (packetId: string, qty: number) => void;
  updatePacketNotes: (packetId: string, notes: string, options?: { persist?: boolean }) => void;
  updatePacketStorageLocation: (packetId: string, location: string, options?: { persist?: boolean }) => void;
  deletePacket: (packetId: string) => void;
  setAddPlantManualOpen: (v: boolean) => void;
  setImageLightbox: (v: { urls: string[]; index: number } | null) => void;
}

export function VaultProfilePacketsTab({
  sortedPackets,
  packetImagesByPacketId,
  journalByPacketId,
  loadingJournalForPacket,
  growInstances,
  canEdit,
  isPermanent,
  openPacketDetails,
  togglePacketDetails,
  updatePacketRating,
  updatePacketPurchaseDate,
  updatePacketQty,
  updatePacketNotes,
  updatePacketStorageLocation,
  deletePacket,
  setAddPlantManualOpen,
  setImageLightbox,
}: VaultProfilePacketsTabProps) {
  if (sortedPackets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <p className="text-neutral-500 text-sm">No seed packets yet.</p>
        {canEdit && !isPermanent && (
          <>
            <p className="text-neutral-400 text-xs mt-1 mb-4">Add a packet here or from the Vault import.</p>
            <button
              type="button"
              onClick={() => setAddPlantManualOpen(true)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-emerald-900 text-white font-medium text-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-900 focus:ring-offset-2"
            >
              Add seed packet
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
          const open = openPacketDetails.has(pkt.id);
          const extraImgs = packetImagesByPacketId.get(pkt.id) ?? [];
          const pktImageUrls = getPacketImageUrls(pkt, extraImgs);
          const pktImageUrl = pktImageUrls[0] ?? null;
          const isArchived = (pkt.qty_status ?? 0) <= 0;
          return (
            <li key={pkt.id} className={`p-4 ${isArchived ? "bg-neutral-50 text-neutral-500" : ""}`}>
              <div className="flex items-center gap-3">
                {pktImageUrl && (
                  <button
                    type="button"
                    onClick={() => pktImageUrls.length > 0 && setImageLightbox({ urls: pktImageUrls, index: 0 })}
                    className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 min-w-[56px] min-h-[56px] ${isArchived ? "bg-neutral-200 opacity-80" : "bg-neutral-100"} hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    aria-label="View packet photos"
                  >
                    <img src={pktImageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                )}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePacketDetails(pkt.id)}
                    className={`flex items-center gap-1 font-medium text-left min-h-[44px] -m-2 p-2 flex-1 min-w-0 ${isArchived ? "text-neutral-500 hover:text-neutral-700" : "text-neutral-900 hover:text-emerald-600"}`}
                    aria-expanded={open}
                    aria-label={`${pkt.vendor_name?.trim() || "Packet"} — tap to ${open ? "collapse" : "expand"}`}
                  >
                    <span className="truncate">{pkt.vendor_name?.trim() || "--"}</span>
                    {year != null && <span className="text-neutral-500 text-sm shrink-0">{year}</span>}
                  </button>
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <StarRating
                      value={pkt.packet_rating ?? null}
                      interactive={canEdit && open}
                      onChange={canEdit && open ? (rating) => updatePacketRating(pkt.id, rating) : undefined}
                      size="sm"
                      label="Packet rating"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePacketDetails(pkt.id)}
                    className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-emerald-600"
                    aria-label={open ? "Collapse packet details" : "Expand packet details"}
                  >
                    <span className={`inline-flex transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
                      <ICON_MAP.ChevronDown className="w-3 h-3" />
                    </span>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <input type="date" aria-label="Purchase date" value={pkt.purchase_date ? toDateInputValue(pkt.purchase_date) : ""} onChange={(e) => updatePacketPurchaseDate(pkt.id, e.target.value)} className="w-[8.5rem] px-2 py-1 text-sm rounded border border-neutral-300 focus:ring-emerald-500" disabled={!canEdit} />
                <PacketQtyOptions value={pkt.qty_status} onChange={(v) => updatePacketQty(pkt.id, v)} variant="remaining" disabled={!canEdit} />
              </div>
              {open && (
                <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
                  {pktImageUrls.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase text-neutral-500 mb-2">Packet photos</p>
                      <div className="flex flex-wrap gap-2">
                        {pktImageUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setImageLightbox({ urls: pktImageUrls, index: idx })}
                            className="w-16 h-16 rounded-lg overflow-hidden shrink-0 min-w-[64px] min-h-[64px] border-2 border-transparent hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-neutral-100"
                            aria-label={`View photo ${idx + 1} of ${pktImageUrls.length}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {pkt.scraped_details?.trim() && (<><p className="text-xs font-medium uppercase text-neutral-500 mb-1">Original Details</p><p className="text-neutral-800 whitespace-pre-wrap text-sm">{pkt.scraped_details}</p></>)}
                  {pkt.purchase_url?.trim() && <a href={pkt.purchase_url} target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 underline hover:text-neutral-700 inline-block">View purchase link</a>}
                  {canEdit && (
                    <>
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Your notes</p>
                        <textarea
                          value={pkt.user_notes ?? ""}
                          onChange={(e) => updatePacketNotes(pkt.id, e.target.value, { persist: false })}
                          onBlur={(e) => updatePacketNotes(pkt.id, e.target.value, { persist: true })}
                          placeholder="Optional notes for this packet"
                          rows={2}
                          className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                          aria-label="Packet notes"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</p>
                        <input
                          type="text"
                          value={pkt.storage_location ?? ""}
                          onChange={(e) => updatePacketStorageLocation(pkt.id, e.target.value, { persist: false })}
                          onBlur={(e) => updatePacketStorageLocation(pkt.id, e.target.value, { persist: true })}
                          placeholder="e.g. Green box, drawer"
                          className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                          aria-label="Storage location"
                        />
                      </div>
                    </>
                  )}
                  {!canEdit && pkt.user_notes?.trim() && (
                    <div>
                      <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Notes</p>
                      <p className="text-sm text-neutral-700">{pkt.user_notes}</p>
                    </div>
                  )}
                  {!canEdit && pkt.storage_location?.trim() && (
                    <div>
                      <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</p>
                      <p className="text-sm text-neutral-700">{pkt.storage_location}</p>
                    </div>
                  )}
                  {(() => {
                    const plantingsForPacket = growInstances.filter((gi) => (gi as { seed_packet_id?: string }).seed_packet_id === pkt.id);
                    const withGermination = plantingsForPacket.filter((gi) => (gi as GrowInstance).seeds_sown != null && (gi as GrowInstance).seeds_sprouted != null && (gi as GrowInstance).seeds_sown! > 0);
                    const avgGerm = withGermination.length >= 2
                      ? Math.round(withGermination.reduce((sum, gi) => sum + (100 * (gi as GrowInstance).seeds_sprouted! / (gi as GrowInstance).seeds_sown!), 0) / withGermination.length)
                      : null;
                    return (
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Germination</p>
                        {plantingsForPacket.length === 0 ? (
                          <p className="text-sm text-neutral-400">No plantings used this packet yet.</p>
                        ) : (
                          <ul className="space-y-1">
                            {plantingsForPacket.map((gi) => {
                              const g = gi as GrowInstance;
                              const germ = g.seeds_sown != null && g.seeds_sprouted != null && g.seeds_sown > 0
                                ? `${g.seeds_sprouted} of ${g.seeds_sown} sprouted`
                                : null;
                              return (
                                <li key={gi.id} className="text-sm">
                                  <span className="text-neutral-500">{formatDisplayDate(gi.sown_date)}</span>
                                  {gi.location && <span className="text-neutral-500"> · {gi.location}</span>}
                                  {germ && <span className="text-emerald-600 font-medium ml-1"> · {germ}</span>}
                                </li>
                              );
                            })}
                            {avgGerm != null && (
                              <li className="text-sm font-medium text-emerald-700 pt-1">Avg germination: {avgGerm}%</li>
                            )}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                  <div>
                    <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Used in journal</p>
                    {loadingJournalForPacket.has(pkt.id) ? <p className="text-sm text-neutral-400">Loading...</p> : (journalByPacketId[pkt.id]?.length ?? 0) > 0 ? (
                      <ul className="space-y-1.5">{journalByPacketId[pkt.id].map((entry) => (<li key={entry.id} className="text-sm"><span className="text-neutral-500">{formatDisplayDate(entry.created_at)}</span>{entry.note?.trim() && <span className="text-neutral-800"> - {entry.note.trim()}</span>}</li>))}</ul>
                    ) : <p className="text-sm text-neutral-400">No journal entries linked to this packet yet.</p>}
                  </div>
                  {canEdit && (
                    <div className="pt-2 border-t border-neutral-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => deletePacket(pkt.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[36px]"
                        aria-label="Remove packet"
                      >
                        <ICON_MAP.Trash className="w-4 h-4" />
                        Remove packet
                      </button>
                    </div>
                  )}
                </div>
              )}
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
            + Add another packet
          </button>
        </div>
      )}
    </div>
  );
}
