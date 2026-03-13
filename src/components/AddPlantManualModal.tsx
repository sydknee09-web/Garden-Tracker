"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatAddFlowError } from "@/lib/addFlowError";
import { useAuth } from "@/contexts/AuthContext";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { ICON_MAP } from "@/lib/styleDictionary";
import type { Volume } from "@/types/vault";

const VOLUMES: Volume[] = ["full", "partial", "low", "empty"];
const VOLUME_LABELS: Record<Volume, string> = {
  full: "Full",
  partial: "Partial",
  low: "Low",
  empty: "Empty",
};

export interface AddPlantManualModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Required when linkToExisting is true: the plant profile to add a packet to. */
  profileId: string;
  /** Caller can pass the profile owner for status update (e.g. from household context). */
  profileOwnerId?: string | null;
}

export function AddPlantManualModal({
  open,
  onClose,
  onSuccess,
  profileId,
  profileOwnerId,
}: AddPlantManualModalProps) {
  const { user } = useAuth();
  const [vendor, setVendor] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState<Volume>("full");
  const [notes, setNotes] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    setVendor("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPurchaseUrl("");
    setPrice("");
    setVolume("full");
    setNotes("");
    setStorageLocation("");
    setError(null);
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.id || !profileId) return;
      setError(null);
      setSaving(true);
      const dateVal = purchaseDate.trim() || new Date().toISOString().slice(0, 10);
      const urlVal = purchaseUrl.trim() || null;
      const vendorVal = vendor.trim() || null;
      const volToQty: Record<Volume, number> = { full: 100, partial: 50, low: 25, empty: 0 };
      const qtyStatus = volToQty[volume] ?? 100;
      const notesVal = notes.trim() || null;
      const priceVal = price.trim() || null;
      const storageVal = storageLocation.trim() || null;
      const { error: packetErr } = await supabase.from("seed_packets").insert({
        plant_profile_id: profileId,
        user_id: user.id,
        vendor_name: vendorVal,
        purchase_url: urlVal,
        purchase_date: dateVal,
        qty_status: qtyStatus,
        ...(notesVal && { user_notes: notesVal }),
        ...(priceVal && { price: priceVal }),
        ...(storageVal && { storage_location: storageVal }),
      });
      setSaving(false);
      if (packetErr) {
        setError(formatAddFlowError(packetErr));
        return;
      }
      const owner = profileOwnerId ?? user.id;
      const { data: activeGrows } = await supabase
        .from("grow_instances")
        .select("id")
        .eq("plant_profile_id", profileId)
        .eq("user_id", owner)
        .is("deleted_at", null)
        .in("status", ["pending", "growing"]);
      const status = (activeGrows?.length ?? 0) > 0 ? "active" : "in_stock";
      await supabase.from("plant_profiles").update({ status }).eq("id", profileId).eq("user_id", owner);
      onSuccess?.();
      onClose();
    },
    [user?.id, profileId, profileOwnerId, vendor, purchaseDate, purchaseUrl, price, volume, notes, storageLocation, onSuccess, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="add-plant-manual-title">
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-md w-full max-h-[85vh] overflow-y-auto p-6">
        <h2 id="add-plant-manual-title" className="text-lg font-bold text-neutral-900 mb-4">
          Add seed packet
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-plant-manual-vendor" className="block text-sm font-medium text-neutral-700 mb-1">
              Vendor (optional)
            </label>
            <input
              id="add-plant-manual-vendor"
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Johnny's, Baker Creek"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              aria-label="Vendor name"
            />
          </div>
          <div>
            <label htmlFor="add-plant-manual-date" className="block text-sm font-medium text-neutral-700 mb-1">
              Purchase date
            </label>
            <input
              id="add-plant-manual-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              aria-label="Purchase date"
            />
          </div>
          <div>
            <label htmlFor="add-plant-manual-url" className="block text-sm font-medium text-neutral-700 mb-1">
              Purchase URL (optional)
            </label>
            <input
              id="add-plant-manual-url"
              type="url"
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              aria-label="Purchase URL"
            />
          </div>
          <div>
            <label htmlFor="add-plant-manual-price" className="block text-sm font-medium text-neutral-700 mb-1">
              Price (optional)
            </label>
            <input
              id="add-plant-manual-price"
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. $3.50"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              aria-label="Price"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-neutral-700 mb-2">Volume (optional)</span>
            <div className="flex gap-2 flex-wrap">
              {VOLUMES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVolume(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    volume === v ? "bg-emerald-600 text-white" : "bg-black/5 text-black/70 hover:bg-black/10"
                  }`}
                >
                  {VOLUME_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="add-plant-manual-notes" className="block text-sm font-medium text-neutral-700 mb-1">
              Packet notes (optional)
            </label>
            <textarea
              id="add-plant-manual-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. From seed swap"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px] resize-none"
              aria-label="Packet notes"
            />
          </div>
          <div>
            <label htmlFor="add-plant-manual-storage" className="block text-sm font-medium text-neutral-700 mb-1">
              Storage location (optional)
            </label>
            <input
              id="add-plant-manual-storage"
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="e.g. Fridge, Cool dry place"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              aria-label="Storage location"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-900 text-white font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <ICON_MAP.Save className="w-4 h-4" />
              {saving ? "Adding…" : "Add packet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
