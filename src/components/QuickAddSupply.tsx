"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { formatAddFlowError } from "@/lib/addFlowError";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { hapticSuccess } from "@/lib/haptics";
import { compressImage } from "@/lib/compressImage";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import { ImageCropModal } from "@/components/ImageCropModal";
import type { SupplyProfile } from "@/types/garden";

const SUPPLY_CATEGORIES = ["fertilizer", "pesticide", "soil_amendment", "other"] as const;

type QuickAddSupplyScreen = "choose" | "link" | "form";

interface QuickAddSupplyProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** When set, modal is in Edit mode. */
  initialData?: SupplyProfile | null;
  /** Open Purchase Order import (screenshot of cart/order with supplies); parent should close this and open PurchaseOrderImport with mode="supply". */
  onOpenPurchaseOrder?: () => void;
  /** Open batch photo import (multiple photos, extract each, review all); parent should close this and open BatchAddSupply. */
  onOpenBatchPhotoImport?: () => void;
  /** When provided, show back arrow on choose screen to return to FAB menu (parent closes this and re-opens Universal Add Menu) */
  onBackToMenu?: () => void;
}

export function QuickAddSupply({ open, onClose, onSuccess, initialData, onOpenPurchaseOrder, onOpenBatchPhotoImport, onBackToMenu }: QuickAddSupplyProps) {
  const { user, session } = useAuth();
  const [screen, setScreen] = useState<QuickAddSupplyScreen>("choose");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<string>("fertilizer");
  const [usageInstructions, setUsageInstructions] = useState("");
  const [applicationRate, setApplicationRate] = useState("");
  const [npk, setNpk] = useState("");
  const [size, setSize] = useState("");
  const [sizeUom, setSizeUom] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [importedImagePath, setImportedImagePath] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initialData?.id;
  const storedImagePath = importedImagePath ?? initialData?.primary_image_path?.trim();
  const existingImageUrl =
    storedImagePath && !photoFile && !photoRemoved
      ? supabase.storage.from("journal-photos").getPublicUrl(storedImagePath).data.publicUrl
      : null;

  useEffect(() => {
    if (open) {
      setError(null);
      setAdded(false);
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setPhotoRemoved(false);
      setImportedImagePath(null);
      setImportUrl("");
      setImportError(null);
      if (initialData) {
        setName(initialData.name ?? "");
        setBrand(initialData.brand ?? "");
        setCategory(initialData.category ?? "fertilizer");
        setUsageInstructions(initialData.usage_instructions ?? "");
        setApplicationRate(initialData.application_rate ?? "");
        setNpk(initialData.npk ?? "");
        setNotes(initialData.notes ?? "");
        setSourceUrl(initialData.source_url ?? "");
        setSize(initialData.size ?? "");
        setSizeUom(initialData.size_uom ?? "");
        setScreen("form");
      } else {
        setName("");
        setBrand("");
        setCategory("fertilizer");
        setUsageInstructions("");
        setApplicationRate("");
        setNpk("");
        setNotes("");
        setSourceUrl("");
        setSize("");
        setSizeUom("");
        setScreen("choose");
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
    setImportedImagePath(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
  }, [photoPreviewUrl]);

  const imagePreviewSrc = photoPreviewUrl ?? (existingImageUrl && !photoRemoved ? existingImageUrl : null);

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      if (!user?.id) return;
      const path = `${user.id}/supply-${crypto.randomUUID().slice(0, 8)}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("journal-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
      if (uploadErr) {
        setError(formatAddFlowError(uploadErr));
        return;
      }
      setPhotoFile(null);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
      setImportedImagePath(path);
      setPhotoRemoved(false);
      setCropModalOpen(false);
    },
    [user?.id, photoPreviewUrl]
  );

  const handleImportFromLink = useCallback(async () => {
    const url = importUrl.trim();
    if (!url.startsWith("http")) {
      setImportError("Enter a valid product URL");
      return;
    }
    if (!session?.access_token) {
      setImportError("Please sign in to import");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/supply/extract-from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(formatAddFlowError((data.error as string) ?? undefined));
        return;
      }
      setName((data.name as string) ?? "");
      setBrand((data.brand as string) ?? "");
      setCategory(
        ["fertilizer", "pesticide", "soil_amendment", "other"].includes((data.category as string)?.toLowerCase())
          ? (data.category as string).toLowerCase()
          : "other"
      );
      setUsageInstructions((data.usage_instructions as string) ?? "");
      setApplicationRate((data.application_rate as string) ?? "");
      setNpk((data.npk as string) ?? "");
      setSourceUrl((data.source_url as string) ?? "");
      setSize((data.size as string) ?? "");
      setSizeUom((data.size_uom as string) ?? "");
      if (data.primary_image_path) setImportedImagePath(data.primary_image_path as string);
      setPhotoRemoved(false);
      setImportUrl("");
      setScreen("form");
    } catch (err) {
      setImportError(formatAddFlowError(err));
    } finally {
      setImporting(false);
    }
  }, [importUrl, session?.access_token]);

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
        let primaryImagePath: string | null = photoRemoved
          ? null
          : importedImagePath ??
            (isEdit && initialData?.primary_image_path?.trim()
              ? initialData.primary_image_path
              : null);

        if (photoFile) {
          const { blob } = await compressImage(photoFile);
          const path = `${user.id}/supply-${crypto.randomUUID().slice(0, 8)}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
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
          size: size.trim() || null,
          size_uom: sizeUom.trim() || null,
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
        setError(formatAddFlowError(err));
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
      size,
      sizeUom,
      notes,
      sourceUrl,
      photoFile,
      photoRemoved,
      importedImagePath,
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
        <div className="flex items-center gap-2 mb-4">
          {!isEdit && screen === "choose" && onBackToMenu ? (
            <button
              type="button"
              onClick={onBackToMenu}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Back to add menu"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : !isEdit && screen === "link" ? (
            <button
              type="button"
              onClick={() => setScreen("choose")}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Back to choose method"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : !isEdit && screen === "form" ? (
            <button
              type="button"
              onClick={() => setScreen("choose")}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Back to add options"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 shrink-0" aria-hidden />
          )}
          <h2 id="quick-add-supply-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">
            {isEdit ? "Edit Supply" : screen === "choose" ? "Add Supply" : screen === "link" ? "Import from Link" : "Add Supply"}
          </h2>
        </div>

        {!isEdit && screen === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500 text-center mb-4">Choose how you want to add a supply.</p>
            <button
              type="button"
              onClick={() => setScreen("form")}
              className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📝</span>
              Manual Entry
            </button>
            {onOpenBatchPhotoImport && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenBatchPhotoImport(); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>📷</span>
                Photo Import
              </button>
            )}
            <button
              type="button"
              onClick={() => setScreen("link")}
              className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🌐</span>
              Link Import
            </button>
            {onOpenPurchaseOrder && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenPurchaseOrder(); }}
                className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
              >
                <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>🧾</span>
                Purchase Order
              </button>
            )}
            <div className="pt-4">
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!isEdit && screen === "link" && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Paste a product page URL. We&apos;ll extract the name, brand, and usage instructions.</p>
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 min-h-[44px]"
              aria-label="Product URL"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setScreen("choose")} className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium min-h-[44px]">
                Back
              </button>
              <button
                type="button"
                onClick={handleImportFromLink}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium min-h-[44px] disabled:opacity-50"
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
            {importError && <p className="text-sm text-red-600" role="alert">{importError}</p>}
          </div>
        )}

        {(isEdit || screen === "form") && (
        <div className="relative">
          <SubmitLoadingOverlay show={submitting} message={isEdit ? "Saving…" : "Adding…"} />
          <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Take product photo"
            onChange={handlePhotoChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Choose product photo from gallery"
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
            <label htmlFor="supply-brand" className="block text-sm font-medium text-black/80 mb-1">
              Brand (optional)
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
              Category *
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
            <span className="block text-sm font-medium text-black/80 mb-1">Photo (optional)</span>
            {photoPreviewUrl || (existingImageUrl && !photoRemoved) ? (
              <div className="space-y-2">
                <img
                  src={photoPreviewUrl ?? existingImageUrl ?? ""}
                  alt="Product"
                  className="w-full rounded-xl object-cover aspect-video max-h-40 bg-neutral-100"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => imagePreviewSrc && setCropModalOpen(true)}
                    disabled={!imagePreviewSrc}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 min-h-[44px] px-2"
                  >
                    Crop scraped image
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-sm font-medium text-amber-600 hover:text-amber-700 min-h-[44px] px-2"
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 min-h-[44px] py-3 rounded-xl border border-black/10 text-black/80 font-medium hover:bg-black/5 flex items-center justify-center gap-2"
                >
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 min-h-[44px] py-3 rounded-xl bg-emerald text-white font-medium hover:bg-emerald/90 flex items-center justify-center gap-2"
                >
                  From gallery
                </button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="supply-npk" className="block text-sm font-medium text-black/80 mb-1">
              NPK (e.g. 5-1-1) (optional)
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
              Application Rate (optional)
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="supply-size" className="block text-sm font-medium text-black/80 mb-1">
                Size (optional)
              </label>
              <input
                id="supply-size"
                type="text"
                inputMode="decimal"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 50, 2.5"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                aria-label="Package size"
              />
            </div>
            <div>
              <label htmlFor="supply-size-uom" className="block text-sm font-medium text-black/80 mb-1">
                Unit (UOM)
              </label>
              <input
                id="supply-size-uom"
                type="text"
                value={sizeUom}
                onChange={(e) => setSizeUom(e.target.value)}
                placeholder="e.g. lbs, gal, oz"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
                aria-label="Unit of measure"
              />
            </div>
          </div>
          <div>
            <label htmlFor="supply-instructions" className="block text-sm font-medium text-black/80 mb-1">
              Usage Instructions (optional)
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
              Notes (optional)
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
              onClick={!isEdit ? () => setScreen("choose") : onClose}
              className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium min-h-[44px]"
            >
              {!isEdit ? "Back" : "Cancel"}
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
        )}
      </div>
      {imagePreviewSrc && (
        <ImageCropModal
          open={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          imageSrc={imagePreviewSrc}
          shape="square"
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
}

