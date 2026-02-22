"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { hapticSuccess } from "@/lib/haptics";
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const isEdit = !!initialData?.id;

  useEffect(() => {
    if (open) {
      setError(null);
      setAdded(false);
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
        if (isEdit && initialData?.id) {
          const { error: updateErr } = await updateWithOfflineQueue(
            "supply_profiles",
            {
              name: nameTrim,
              brand: brand.trim() || null,
              category,
              usage_instructions: usageInstructions.trim() || null,
              application_rate: applicationRate.trim() || null,
              npk: npk.trim() || null,
              notes: notes.trim() || null,
              source_url: sourceUrl.trim() || null,
              updated_at: new Date().toISOString(),
            },
            { id: initialData.id, user_id: user.id }
          );
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await insertWithOfflineQueue("supply_profiles", {
            user_id: user.id,
            name: nameTrim,
            brand: brand.trim() || null,
            category,
            usage_instructions: usageInstructions.trim() || null,
            application_rate: applicationRate.trim() || null,
            npk: npk.trim() || null,
            notes: notes.trim() || null,
            source_url: sourceUrl.trim() || null,
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
      isEdit,
      initialData?.id,
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
