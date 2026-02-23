"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = getSupplyReviewData();
    if (data?.items?.length) {
      setItems(data.items);
      return;
    }
    const id = setTimeout(() => {
      const retry = getSupplyReviewData();
      if (retry?.items?.length) {
        setItems(retry.items);
      } else {
        router.replace("/vault?tab=shed");
      }
    }, 150);
    return () => clearTimeout(id);
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
  }, [router]);

  const handleSaveAll = useCallback(async () => {
    if (!user?.id || items.length === 0) return;
    setSaving(true);
    setError(null);
    let count = 0;
    try {
      for (const item of items) {
        const nameTrim = (item.name ?? "").trim();
        if (!nameTrim) continue;
        const category = SUPPLY_CATEGORIES.includes(item.category as (typeof SUPPLY_CATEGORIES)[number])
          ? item.category
          : "other";
        const { error: insertErr } = await insertWithOfflineQueue("supply_profiles", {
          user_id: user.id,
          name: nameTrim,
          brand: (item.brand ?? "").trim() || null,
          category,
          usage_instructions: (item.usage_instructions ?? "").trim() || null,
          application_rate: (item.application_rate ?? "").trim() || null,
          npk: (item.npk ?? "").trim() || null,
          notes: null,
        });
        if (insertErr) throw insertErr;
        count++;
      }
      hapticSuccess();
      setSavedCount(count);
      clearSupplyReviewData();
      setTimeout(() => {
        router.replace("/vault?tab=shed");
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [user?.id, items, router]);

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
