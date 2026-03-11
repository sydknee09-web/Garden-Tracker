"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PacketQtyOptions } from "@/components/PacketQtyOptions";
import { LoadingState } from "@/components/LoadingState";
import { StarRating } from "@/components/StarRating";
import { ICON_MAP } from "@/lib/styleDictionary";
import { hapticSuccess, hapticError } from "@/lib/haptics";

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type PacketData = {
  id: string;
  plant_profile_id: string;
  vendor_name: string | null;
  purchase_date: string | null;
  purchase_url: string | null;
  price: string | null;
  qty_status: number;
  packet_rating: number | null;
  user_notes: string | null;
  storage_location: string | null;
  tags: string[] | null;
};

interface EditPacketModalProps {
  packetId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditPacketModal({ packetId, onClose, onSaved }: EditPacketModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [price, setPrice] = useState("");
  const [qtyStatus, setQtyStatus] = useState(100);
  const [packetRating, setPacketRating] = useState<number | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const loadPacket = useCallback(async () => {
    if (!user?.id || !packetId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("seed_packets")
      .select("id, plant_profile_id, vendor_name, purchase_date, purchase_url, price, qty_status, packet_rating, user_notes, storage_location, tags")
      .eq("id", packetId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    setLoading(false);
    if (err || !data) {
      setError(err?.message ?? "Packet not found");
      return;
    }
    const p = data as PacketData;
    setVendorName(p.vendor_name?.trim() ?? "");
    setPurchaseDate(toDateInputValue(p.purchase_date));
    setPurchaseUrl(p.purchase_url?.trim() ?? "");
    setPrice(p.price?.trim() ?? "");
    setQtyStatus(p.qty_status ?? 100);
    setPacketRating(p.packet_rating ?? null);
    setUserNotes(p.user_notes?.trim() ?? "");
    setStorageLocation(p.storage_location?.trim() ?? "");
    setTagsInput(Array.isArray(p.tags) ? p.tags.filter(Boolean).join(", ") : "");
  }, [user?.id, packetId]);

  useEffect(() => {
    loadPacket();
  }, [loadPacket]);

  const handleSave = useCallback(async () => {
    if (!user?.id || !packetId) return;
    setSaving(true);
    setError(null);
    setSaveError(null);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { error: err } = await supabase
      .from("seed_packets")
      .update({
        vendor_name: vendorName.trim() || null,
        purchase_date: purchaseDate.trim() || null,
        purchase_url: purchaseUrl.trim() || null,
        price: price.trim() || null,
        qty_status: qtyStatus,
        packet_rating: packetRating,
        user_notes: userNotes.trim() || null,
        storage_location: storageLocation.trim() || null,
        tags: tags.length > 0 ? tags : null,
      })
      .eq("id", packetId)
      .eq("user_id", user.id);
    setSaving(false);
    if (err) {
      setSaveError(err.message);
      hapticError();
      return;
    }
    hapticSuccess();
    onSaved();
    onClose();
  }, [user?.id, packetId, vendorName, purchaseDate, purchaseUrl, price, qtyStatus, packetRating, userNotes, storageLocation, tagsInput, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="edit-packet-title">
      <div className="bg-white w-full max-w-md md:rounded-2xl shadow-lg border border-black/10 min-h-[100dvh] md:min-h-0 max-h-[100dvh] md:max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl md:rounded-2xl">
        <div className="flex-shrink-0 px-4 py-3 border-b border-black/10">
          <h2 id="edit-packet-title" className="text-lg font-semibold text-black">Edit packet</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <LoadingState message="Loading…" className="py-4" />
          ) : error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : (
            <>
              <div>
                <label htmlFor="edit-vendor" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Vendor / Nursery</label>
                <input
                  id="edit-vendor"
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Johnny's Seeds"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Vendor name"
                />
              </div>
              <div>
                <label htmlFor="edit-date" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Purchase date</label>
                <input
                  id="edit-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Purchase date"
                />
              </div>
              <div>
                <label htmlFor="edit-url" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Purchase URL</label>
                <input
                  id="edit-url"
                  type="url"
                  value={purchaseUrl}
                  onChange={(e) => setPurchaseUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Purchase URL"
                />
              </div>
              <div>
                <label htmlFor="edit-price" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Price</label>
                <input
                  id="edit-price"
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. $4.99"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Price"
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Quantity remaining</p>
                <PacketQtyOptions value={qtyStatus} onChange={setQtyStatus} variant="remaining" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Rating</p>
                <StarRating value={packetRating} interactive onChange={setPacketRating} size="sm" label="Packet rating" />
              </div>
              <div>
                <label htmlFor="edit-notes" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Notes</label>
                <textarea
                  id="edit-notes"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Optional notes for this packet"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Packet notes"
                />
              </div>
              <div>
                <label htmlFor="edit-storage" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</label>
                <input
                  id="edit-storage"
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g. Green box, drawer"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Storage location"
                />
              </div>
              <div>
                <label htmlFor="edit-tags" className="block text-xs font-medium uppercase text-neutral-500 mb-1">Tags</label>
                <input
                  id="edit-tags"
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Comma-separated: Organic, Heirloom"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Tags"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex-shrink-0 p-4 border-t border-black/10">
          {saveError && <p className="text-sm text-red-600 mb-3" role="alert">{saveError}</p>}
          <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            <ICON_MAP.Cancel className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <ICON_MAP.Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
