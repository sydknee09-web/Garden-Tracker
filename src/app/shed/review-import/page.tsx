"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSupplyReviewData,
  clearSupplyReviewData,
  type SupplyReviewItem,
} from "@/lib/supplyReviewStorage";
import { hapticSuccess } from "@/lib/haptics";
import { compressImage } from "@/lib/compressImage";

const SUPPLY_CATEGORIES = ["fertilizer", "pesticide", "soil_amendment", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  soil_amendment: "Soil Amendment",
  other: "Other",
};

export default function ShedReviewImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<SupplyReviewItem[]>([]);
  const [originalExtracted, setOriginalExtracted] = useState<Record<string, SupplyReviewItem>>({});
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [itemPhotos, setItemPhotos] = useState<Record<string, { file: File; previewUrl: string }>>({});
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const photoGalleryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const data = getSupplyReviewData();
    if (data?.items?.length) {
      setItems(data.items);
      const byId: Record<string, SupplyReviewItem> = {};
      for (const i of data.items) byId[i.id] = { ...i };
      setOriginalExtracted(byId);
      return;
    }
    let cancelled = false;
    const delays = [100, 250, 500, 1000];
    const ids: ReturnType<typeof setTimeout>[] = [];
    for (const ms of delays) {
      const id = setTimeout(() => {
        if (cancelled) return;
        const retry = getSupplyReviewData();
        if (retry?.items?.length) {
          setItems(retry.items);
          const byId: Record<string, SupplyReviewItem> = {};
          for (const i of retry.items) byId[i.id] = { ...i };
          setOriginalExtracted(byId);
        } else if (ms === delays[delays.length - 1]) {
          router.replace("/vault?tab=shed");
        }
      }, ms);
      ids.push(id);
    }
    return () => {
      cancelled = true;
      ids.forEach((id) => clearTimeout(id));
    };
  }, [router]);

  const updateItem = useCallback((id: string, updates: Partial<SupplyReviewItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length === 0) {
        clearSupplyReviewData();
        router.replace("/vault?tab=shed");
      }
      return next;
    });
    setItemPhotos((prev) => {
      const next = { ...prev };
      const p = next[id];
      if (p?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      delete next[id];
      return next;
    });
  }, [router]);

  const handleItemPhotoChange = useCallback((itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f?.type.startsWith("image/")) return;
    setItemPhotos((prev) => {
      const old = prev[itemId];
      if (old?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(old.previewUrl);
      return { ...prev, [itemId]: { file: f, previewUrl: URL.createObjectURL(f) } };
    });
  }, []);

  const removeItemPhoto = useCallback((itemId: string) => {
    setItemPhotos((prev) => {
      const p = prev[itemId];
      if (p?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!user?.id || items.length === 0) return;
    setSaving(true);
    setError(null);
    let count = 0;
    try {
      for (const item of items) {
        const orig = originalExtracted[item.id];
        const nameTrim = ((item.name ?? "").trim() || (orig?.name ?? "").trim()) || "";
        if (!nameTrim) continue;
        const catRaw = (item.category ?? "").trim() || (orig?.category ?? "").trim();
        const category = SUPPLY_CATEGORIES.includes(catRaw as (typeof SUPPLY_CATEGORIES)[number])
          ? catRaw
          : "other";
        let primaryImagePath: string | null = null;
        const photo = itemPhotos[item.id];
        if (photo?.file) {
          const { blob } = await compressImage(photo.file);
          const path = `${user.id}/supply-${crypto.randomUUID().slice(0, 8)}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
          if (!uploadErr) primaryImagePath = path;
        } else if (item.primary_image_path) {
          primaryImagePath = item.primary_image_path;
        }
        const vendorVal = (item.vendor ?? "").trim() || (orig?.vendor ?? "").trim();
        const vendorNote = vendorVal ? `Vendor: ${vendorVal}` : null;
        const brandVal = (item.brand ?? "").trim() || (orig?.brand ?? "").trim();
        const usageVal = (item.usage_instructions ?? "").trim() || (orig?.usage_instructions ?? "").trim();
        const appRateVal = (item.application_rate ?? "").trim() || (orig?.application_rate ?? "").trim();
        const npkVal = (item.npk ?? "").trim() || (orig?.npk ?? "").trim();
        const payload: Record<string, unknown> = {
          user_id: user.id,
          name: nameTrim,
          brand: brandVal || null,
          category,
          usage_instructions: usageVal || null,
          application_rate: appRateVal || null,
          npk: npkVal || null,
          notes: vendorNote,
        };
        if (primaryImagePath) payload.primary_image_path = primaryImagePath;
        const { error: insertErr } = await insertWithOfflineQueue("supply_profiles", payload);
        if (insertErr) throw insertErr;
        count++;
      }
      hapticSuccess();
      setSavedCount(count);
      clearSupplyReviewData();
      setTimeout(() => {
        window.location.href = "/vault?tab=shed";
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [user?.id, items, itemPhotos, originalExtracted, router]);

  const handleCancel = useCallback(() => {
    clearSupplyReviewData();
    router.replace("/vault?tab=shed");
  }, [router]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-paper p-6">
        <p className="text-neutral-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/vault?tab=shed"
            className="text-emerald-600 font-medium hover:underline"
          >
            ← Back to Shed
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Review Supply Import
        </h1>
        <p className="text-neutral-600 text-sm mb-6">
          Edit the extracted items below, then save all to the Shed.
        </p>

        <div className="space-y-4 mb-8">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-black/10 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-sm font-medium text-neutral-500">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-red-600 text-sm font-medium hover:underline min-h-[44px] min-w-[44px] flex items-center justify-center -m-2"
                  aria-label="Remove item"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Photo (optional)</label>
                  {itemPhotos[item.id] ? (
                    <div className="space-y-2">
                      <img
                        src={itemPhotos[item.id].previewUrl}
                        alt=""
                        className="w-full rounded-lg object-cover aspect-video max-h-32 bg-neutral-100"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => photoInputRefs.current[item.id]?.click()}
                          className="text-sm font-medium text-emerald-600 hover:underline min-h-[44px]"
                        >
                          Replace (camera)
                        </button>
                        <button
                          type="button"
                          onClick={() => photoGalleryInputRefs.current[item.id]?.click()}
                          className="text-sm font-medium text-emerald-600 hover:underline min-h-[44px]"
                        >
                          Replace (gallery)
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItemPhoto(item.id)}
                          className="text-sm font-medium text-amber-600 hover:underline min-h-[44px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : item.primary_image_path ? (
                    <div className="space-y-2">
                      <img
                        src={supabase.storage.from("journal-photos").getPublicUrl(item.primary_image_path).data.publicUrl}
                        alt=""
                        className="w-full rounded-lg object-cover aspect-video max-h-32 bg-neutral-100"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => photoInputRefs.current[item.id]?.click()}
                          className="text-sm font-medium text-emerald-600 hover:underline min-h-[44px]"
                        >
                          Replace (camera)
                        </button>
                        <button
                          type="button"
                          onClick={() => photoGalleryInputRefs.current[item.id]?.click()}
                          className="text-sm font-medium text-emerald-600 hover:underline min-h-[44px]"
                        >
                          Replace (gallery)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeItemPhoto(item.id);
                            updateItem(item.id, { primary_image_path: undefined });
                          }}
                          className="text-sm font-medium text-amber-600 hover:underline min-h-[44px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRefs.current[item.id]?.click()}
                        className="flex-1 min-h-[44px] py-3 rounded-lg border border-black/10 text-black/80 font-medium hover:bg-black/5 flex items-center justify-center gap-2"
                      >
                        Take photo
                      </button>
                      <button
                        type="button"
                        onClick={() => photoGalleryInputRefs.current[item.id]?.click()}
                        className="flex-1 min-h-[44px] py-3 rounded-lg bg-emerald text-white font-medium hover:bg-emerald/90 flex items-center justify-center gap-2"
                      >
                        From gallery
                      </button>
                    </div>
                  )}
                  <input
                    ref={(el) => { photoInputRefs.current[item.id] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => handleItemPhotoChange(item.id, e)}
                    aria-label="Take product photo"
                  />
                  <input
                    ref={(el) => { photoGalleryInputRefs.current[item.id] = el; }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleItemPhotoChange(item.id, e)}
                    aria-label="Choose product photo from gallery"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="e.g. Fish Emulsion 5-1-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Brand</label>
                  <input
                    type="text"
                    value={item.brand}
                    onChange={(e) => updateItem(item.id, { brand: e.target.value })}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="e.g. Neptune's Harvest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Category</label>
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(item.id, { category: e.target.value as SupplyReviewItem["category"] })}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  >
                    {SUPPLY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">NPK</label>
                    <input
                      type="text"
                      value={item.npk}
                      onChange={(e) => updateItem(item.id, { npk: e.target.value })}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                      placeholder="5-1-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Application Rate</label>
                  <input
                    type="text"
                    value={item.application_rate}
                    onChange={(e) => updateItem(item.id, { application_rate: e.target.value })}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="e.g. 1 tbsp per gallon"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Usage Instructions</label>
                  <textarea
                    value={item.usage_instructions}
                    onChange={(e) => updateItem(item.id, { usage_instructions: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="How to use, when to apply..."
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium mb-4" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 rounded-xl border border-black/10 text-neutral-700 font-medium min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || items.every((i) => !(i.name ?? "").trim())}
            className="flex-1 py-3 rounded-xl bg-emerald text-white font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : savedCount > 0 ? `Saved ${savedCount}!` : `Save All (${items.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
