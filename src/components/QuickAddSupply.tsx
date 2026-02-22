"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { hapticSuccess } from "@/lib/haptics";
import { compressImage } from "@/lib/compressImage";
import type { SupplyProfile } from "@/types/garden";

const SUPPLY_CATEGORIES = ["fertilizer", "pesticide", "soil_amendment", "other"] as const;

interface QuickAddSupplyProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, modal is in Edit mode. */
  initialData?: SupplyProfile | null;
}

export function QuickAddSupply({ open, onClose, onSuccess, initialData }: QuickAddSupplyProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<string>("fertilizer");
  const [usageInstructions, setUsageInstructions] = useState("");
  const [applicationRate, setApplicationRate] = useState("");
  const [npk, setNpk] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initialData?.id;
  const existingImageUrl =
    initialData?.primary_image_path?.trim() && !photoFile
      ? supabase.storage.from("journal-photos").getPublicUrl(initialData.primary_image_path).data.publicUrl
      : null;

  useEffect(() => {
    if (open) {
      setError(null);
      setAdded(false);
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setPhotoRemoved(false);
      if (initialData) {
        setName(initialData.name ?? "");
        setBrand(initialData.brand ?? "");
        setCategory(initialData.category ?? "fertilizer");
        setUsageInstructions(initialData.usage_instructions ?? "");
        setApplicationRate(initialData.application_rate ?? "");
        setNpk(initialData.npk ?? "");
        setNotes(initialData.notes ?? "");
        setSourceUrl(initialData.source_url ?? "");
      } else {
        setName("");
        setBrand("");
        setCategory("fertilizer");
        setUsageInstructions("");
        setApplicationRate("");
        setNpk("");
        setNotes("");
        setSourceUrl("");
      }
    }
  }, [open, initialData]);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setPhotoFile(f);
      setPhotoPreviewUrl(URL.createObjectURL(f));
    }
    e.target.value = "";
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setPhotoFile(null);
    setPhotoRemoved(true);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
  }, [photoPreviewUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.id) return;
      const nameTrim = name.trim();
      if (!nameTrim) {
        setError("Name is required.");
        return;
      }
      if (!SUPPLY_CATEGORIES.includes(category as (typeof SUPPLY_CATEGORIES)[number])) {
        setError("Invalid category.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        let primaryImagePath: string | null =
          !photoRemoved && isEdit && initialData?.primary_image_path?.trim()
            ? initialData.primary_image_path
            : null;

        if (photoFile) {
          const { blob } = await compressImage(photoFile);
          const path = `${user.id}/supply-${crypto.randomUUID().slice(0, 8)}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (uploadErr) throw uploadErr;
          primaryImagePath = path;
        }

        const basePayload = {
          name: nameTrim,
          brand: brand.trim() || null,
          category,
          usage_instructions: usageInstructions.trim() || null,
          application_rate: applicationRate.trim() || null,
          npk: npk.trim() || null,
          notes: notes.trim() || null,
          source_url: sourceUrl.trim() || null,
          ...(primaryImagePath != null && { primary_image_path: primaryImagePath }),
        };

        if (isEdit && initialData?.id) {
          const updatePayload = { ...basePayload, updated_at: new Date().toISOString() };
          if (photoRemoved && !photoFile) (updatePayload as Record<string, unknown>).primary_image_path = null;
          const { error: updateErr } = await updateWithOfflineQueue(
            "supply_profiles",
            updatePayload,
            { id: initialData.id, user_id: user.id }
          );
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await insertWithOfflineQueue("supply_profiles", {
            user_id: user.id,
            ...basePayload,
          });
          if (insertErr) throw insertErr;
        }
        hapticSuccess();
        setAdded(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      user?.id,
      name,
      brand,
      category,
      usageInstructions,
      applicationRate,
      npk,
      notes,
      sourceUrl,
      photoFile,
      photoRemoved,
      isEdit,
      initialData?.id,
      initialData?.primary_image_path,
      onSuccess,
      onClose,
    ]
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        role="dialog"
        aria-labelledby="quick-add-supply-title"
        aria-modal="true"
      >
        <h2 id="quick-add-supply-title" className="text-xl font-bold text-neutral-900 mb-4">
          {isEdit ? "Edit Supply" : "Add Supply"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Add product photo"
            onChange={handlePhotoChange}
          />
          <div>
            <label htmlFor="supply-name" className="block text-sm font-medium text-black/80 mb-1">
              Product Name *
            </label>
            <input
              id="supply-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fish Emulsion 5-1-1"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Product name"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-black/80 mb-1">Photo (optional)</span>
            {photoPreviewUrl || (existingImageUrl && !photoRemoved) ? (
              <div className="space-y-2">
                <img
                  src={photoPreviewUrl ?? existingImageUrl ?? ""}
                  alt="Product"
                  className="w-full rounded-xl object-cover aspect-video max-h-40 bg-neutral-100"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-sm font-medium text-amber-600 hover:text-amber-700 min-h-[44px]"
                >
                  Remove photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-w-[44px] min-h-[44px] w-full py-4 rounded-xl border-2 border-dashed border-black/15 text-black/50 hover:border-emerald/40 hover:text-emerald-600 flex flex-col items-center justify-center gap-1 text-sm font-medium"
              >
                <span aria-hidden>📷</span>
                Take or choose photo
              </button>
            )}
          </div>
          <div>
            <label htmlFor="supply-brand" className="block text-sm font-medium text-black/80 mb-1">
              Brand
            </label>
            <input
              id="supply-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Neptune's Harvest"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Brand"
            />
          </div>
          <div>
            <label htmlFor="supply-category" className="block text-sm font-medium text-black/80 mb-1">
              Category
            </label>
            <select
              id="supply-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Category"
            >
              <option value="fertilizer">Fertilizer</option>
              <option value="pesticide">Pesticide</option>
              <option value="soil_amendment">Soil Amendment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="supply-npk" className="block text-sm font-medium text-black/80 mb-1">
              NPK (e.g. 5-1-1)
            </label>
            <input
              id="supply-npk"
              type="text"
              value={npk}
              onChange={(e) => setNpk(e.target.value)}
              placeholder="e.g. 5-1-1 or 10-10-10"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="NPK ratio"
            />
          </div>
          <div>
            <label htmlFor="supply-rate" className="block text-sm font-medium text-black/80 mb-1">
              Application Rate
            </label>
            <input
              id="supply-rate"
              type="text"
              value={applicationRate}
              onChange={(e) => setApplicationRate(e.target.value)}
              placeholder="e.g. 1 tbsp per gallon"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Application rate"
            />
          </div>
          <div>
            <label htmlFor="supply-instructions" className="block text-sm font-medium text-black/80 mb-1">
              Usage Instructions
            </label>
            <textarea
              id="supply-instructions"
              value={usageInstructions}
              onChange={(e) => setUsageInstructions(e.target.value)}
              placeholder="How to use, when to apply, etc."
              rows={3}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Usage instructions"
            />
          </div>
          <div>
            <label htmlFor="supply-notes" className="block text-sm font-medium text-black/80 mb-1">
              Notes
            </label>
            <textarea
              id="supply-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Your own notes"
              rows={2}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Notes"
            />
          </div>
          <div>
            <label htmlFor="supply-source" className="block text-sm font-medium text-black/80 mb-1">
              Product URL (optional)
            </label>
            <input
              id="supply-source"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
              aria-label="Product URL"
            />
          </div>
          {error && <p className="text-sm text-amber-600 font-medium">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || added}
              className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {added ? "Saved!" : submitting ? "Saving…" : isEdit ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
