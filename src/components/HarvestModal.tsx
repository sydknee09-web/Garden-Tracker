"use client";

import { useState, useCallback } from "react";
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

export function HarvestModal({ open, onClose, onSaved, profileId, growInstanceId, displayName }: Props) {
  const { user } = useAuth();
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  useEscapeKey(open, onClose);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      let imagePath: string | null = null;
      if (photo) {
        const { blob } = await compressImage(photo);
        const path = `${user.id}/harvest-${growInstanceId}-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (!uploadErr) imagePath = path;
      }

      const weather = await fetchWeatherSnapshot();
      const weightNum = weight.trim() ? parseFloat(weight) : null;
      const qtyNum = quantity.trim() ? parseFloat(quantity) : null;

      const { error } = await supabase.from("journal_entries").insert({
        user_id: user.id,
        plant_profile_id: profileId,
        grow_instance_id: growInstanceId,
        note: note.trim() || `Harvested ${displayName}`,
        entry_type: "harvest",
        harvest_weight: weightNum,
        harvest_unit: unit,
        harvest_quantity: qtyNum,
        image_file_path: imagePath,
        weather_snapshot: weather ?? undefined,
      });

      if (error) { console.error("HarvestModal save error", error.message); }

      setWeight(""); setUnit("lbs"); setQuantity(""); setNote(""); setPhoto(null); setPhotoPreview(null);
      onSaved();
      onClose();
    } catch (err) {
      console.error("HarvestModal: unexpected error", err);
    } finally {
      setSaving(false);
    }
  }, [user?.id, weight, unit, quantity, note, photo, profileId, growInstanceId, displayName, onSaved, onClose]);

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
            <label className="block text-sm font-medium text-neutral-700 mb-1">Victory Photo</label>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="text-sm" />
            {photoPreview && (
              <div className="mt-2 w-full max-w-[200px] rounded-lg overflow-hidden bg-neutral-100">
                <img src={photoPreview} alt="Preview" className="w-full h-auto object-cover" />
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
