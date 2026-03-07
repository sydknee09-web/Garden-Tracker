"use client";

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  profileId: string;
  growInstanceId: string;
  displayName: string;
}

const UNITS = ["lbs", "oz", "kg", "g", "count", "bunches", "heads", "ears"];
const MAX_JOURNAL_PHOTOS = 10;

type PhotoItem = { id: string; file: File; previewUrl: string };

export function HarvestModal({ open, onClose, onSaved, profileId, growInstanceId, displayName }: Props) {
  const { user } = useAuth();
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoGalleryRef = useRef<HTMLInputElement>(null);

  const handleCameraPhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && photos.length < MAX_JOURNAL_PHOTOS) {
      setPhotos((prev) => [...prev, { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }]);
    }
    e.target.value = "";
  }, [photos.length]);

  const handleGalleryPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      const toAdd = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, MAX_JOURNAL_PHOTOS - photos.length);
      setPhotos((prev) => [...prev, ...toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) }))]);
    }
    e.target.value = "";
  }, [photos.length]);

  useEscapeKey(open, onClose);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const uploadedPaths: string[] = [];
      for (const p of photos) {
        const { blob } = await compressImage(p.file);
        const path = `${user.id}/harvest-${growInstanceId}-${Date.now()}-${crypto.randomUUID()}.jpg`;
        const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
        if (!uploadErr) uploadedPaths.push(path);
      }
      const firstPath = uploadedPaths[0] ?? null;

      const weather = await fetchWeatherSnapshot();
      const weightNum = weight.trim() ? parseFloat(weight) : null;
      const qtyNum = quantity.trim() ? parseFloat(quantity) : null;

      const { data: entry, error } = await supabase.from("journal_entries").insert({
        user_id: user.id,
        plant_profile_id: profileId,
        grow_instance_id: growInstanceId,
        note: note.trim() || `Harvested ${displayName}`,
        entry_type: "harvest",
        harvest_weight: weightNum,
        harvest_unit: unit,
        harvest_quantity: qtyNum,
        image_file_path: firstPath,
        weather_snapshot: weather ?? undefined,
      }).select("id").single();

      if (error) {
        console.error("HarvestModal save error", error.message);
        setSaving(false);
        return;
      }

      if (entry && uploadedPaths.length > 0) {
        const entryId = (entry as { id: string }).id;
        await supabase.from("journal_entry_photos").insert(uploadedPaths.map((path, i) => ({ journal_entry_id: entryId, image_file_path: path, sort_order: i, user_id: user.id })));
      }

      setWeight(""); setUnit("lbs"); setQuantity(""); setNote("");
      photos.forEach((p) => { if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl); });
      setPhotos([]);
      onSaved();
      onClose();
    } catch (err) {
      console.error("HarvestModal: unexpected error", err);
    } finally {
      setSaving(false);
    }
  }, [user?.id, weight, unit, quantity, note, photos, profileId, growInstanceId, displayName, onSaved, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex-shrink-0 p-5 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Log Harvest</h2>
          <p className="text-sm text-neutral-500 mt-1">{displayName}</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="harvest-weight" className="block text-sm font-medium text-neutral-700 mb-1">Weight / Amount</label>
              <input id="harvest-weight" type="number" step="any" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 2.5" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label htmlFor="harvest-unit" className="block text-sm font-medium text-neutral-700 mb-1">Unit</label>
              <select id="harvest-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="harvest-qty" className="block text-sm font-medium text-neutral-700 mb-1">Count (optional)</label>
            <input id="harvest-qty" type="number" step="1" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 12 tomatoes" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
          </div>

          {/* Note */}
          <div>
            <label htmlFor="harvest-note" className="block text-sm font-medium text-neutral-700 mb-1">Note</label>
            <textarea id="harvest-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional harvest note..." className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Victory Photo (optional, max {MAX_JOURNAL_PHOTOS})</label>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraPhoto} className="sr-only" aria-label="Take harvest photo" />
            <input ref={photoGalleryRef} type="file" accept="image/*" multiple onChange={handleGalleryPhotos} className="sr-only" aria-label="Choose harvest photos from gallery" />
            {photos.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-neutral-100">
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setPhotos((prev) => { const x = prev.find((i) => i.id === p.id); if (x?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(x.previewUrl); return prev.filter((i) => i.id !== p.id); })} className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
                {photos.length < MAX_JOURNAL_PHOTOS && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="min-h-[44px] py-2 px-3 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-medium">Take photo</button>
                    <button type="button" onClick={() => photoGalleryRef.current?.click()} className="min-h-[44px] py-2 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium">From gallery</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => photoInputRef.current?.click()} className="flex-1 min-h-[44px] py-3 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Take photo</button>
                <button type="button" onClick={() => photoGalleryRef.current?.click()} className="flex-1 min-h-[44px] py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">From gallery</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-3 justify-end p-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving..." : "Save Harvest"}</button>
        </div>
      </div>
    </div>
  );
}
