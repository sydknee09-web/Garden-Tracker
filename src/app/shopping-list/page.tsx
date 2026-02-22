"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";
import { QuickAddSeed } from "@/components/QuickAddSeed";

type ShoppingItem = {
  id: string;
  plant_profile_id: string | null;
  placeholder_name: string | null;
  placeholder_variety: string | null;
  is_purchased: boolean;
  created_at: string;
  plant_profiles: { name: string; variety_name: string | null } | null;
};

export default function ShoppingListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  /** When set, open QuickAdd to add this placeholder to the vault; on success mark purchased. */
  const [buyPlaceholderItem, setBuyPlaceholderItem] = useState<ShoppingItem | null>(null);

  const fetchList = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("shopping_list")
      .select("id, plant_profile_id, is_purchased, created_at, placeholder_name, placeholder_variety, plant_profiles(name, variety_name)")
      .eq("user_id", user.id)
      .eq("is_purchased", false)
      .order("created_at", { ascending: false });
    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as unknown as ShoppingItem[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handlePurchased = useCallback(
    async (id: string) => {
      const removed = items.find((i) => i.id === id);
      if (!removed) return;
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTogglingId(id);
      const { error } = await updateWithOfflineQueue("shopping_list", { is_purchased: true }, { id, user_id: user!.id });
      setTogglingId(null);
      if (error) {
        hapticError();
        setItems((prev) => [...prev, removed].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
      } else {
        hapticSuccess();
      }
    },
    [user?.id, items]
  );

  const handlePlaceholderBoughtSuccess = useCallback(() => {
    if (buyPlaceholderItem) handlePurchased(buyPlaceholderItem.id);
    setBuyPlaceholderItem(null);
  }, [buyPlaceholderItem, handlePurchased]);

  usePullToRefresh({ onRefresh: fetchList, disabled: loading });

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
        >
          ← Back to Vault
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Shopping List</h1>
        <p className="text-neutral-600 text-sm mb-6">
          Out-of-stock items and wishlist placeholders. Mark &quot;Purchased&quot; to archive; for wishlist items, &quot;I bought this&quot; adds them to the Vault.
        </p>

        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white border border-black/10 p-8 text-center">
            <p className="text-neutral-600 mb-2">No items on your shopping list yet.</p>
            <p className="text-neutral-500 text-sm mb-4">
              Add from Vault (🛒 when out of stock) or from Quick Add → &quot;Add to Shopping List&quot; for varieties you don&apos;t own yet.
            </p>
            <Link
              href="/vault"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Go to Vault
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const isPlaceholder = item.plant_profile_id == null;
              const label = item.plant_profiles
                ? item.plant_profiles.variety_name?.trim()
                  ? `${item.plant_profiles.name} — ${item.plant_profiles.variety_name}`
                  : item.plant_profiles.name
                : [item.placeholder_name, item.placeholder_variety].filter(Boolean).join(" — ") || "Unknown";
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                >
                  {isPlaceholder ? (
                    <>
                      <span className="flex-1 text-neutral-900">{label}</span>
                      <button
                        type="button"
                        onClick={() => setBuyPlaceholderItem(item)}
                        disabled={togglingId === item.id}
                        className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-emerald text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                      >
                        I bought this
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePurchased(item.id)}
                        disabled={togglingId === item.id}
                        className="min-w-[44px] min-h-[44px] p-2 rounded-xl border border-black/15 text-neutral-600 text-xs font-medium hover:bg-black/5 disabled:opacity-60"
                        aria-label="Mark as purchased without adding to Vault"
                      >
                        Got it
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        id={`purchased-${item.id}`}
                        checked={false}
                        onChange={() => handlePurchased(item.id)}
                        disabled={togglingId === item.id}
                        className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label={`Mark ${label} as purchased`}
                      />
                      <label htmlFor={`purchased-${item.id}`} className="flex-1 cursor-pointer text-neutral-900">
                        {label}
                      </label>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <QuickAddSeed
        open={!!buyPlaceholderItem}
        onClose={() => setBuyPlaceholderItem(null)}
        onSuccess={handlePlaceholderBoughtSuccess}
        initialPrefill={
          buyPlaceholderItem
            ? {
                name: buyPlaceholderItem.placeholder_name ?? "",
                variety: buyPlaceholderItem.placeholder_variety ?? "",
              }
            : null
        }
      />
    </div>
  );
}
