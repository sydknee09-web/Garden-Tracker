"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";
import { AddItemModal } from "@/components/AddItemModal";

type ShoppingItem = {
  id: string;
  plant_profile_id: string | null;
  supply_profile_id: string | null;
  placeholder_name: string | null;
  placeholder_variety: string | null;
  is_purchased: boolean;
  created_at: string;
  plant_profiles: { name: string; variety_name: string | null } | null;
  supply_profiles: { name: string; brand: string | null; deleted_at: string | null } | null;
};

export default function ShoppingListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  const fetchList = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("shopping_list")
      .select("id, plant_profile_id, supply_profile_id, is_purchased, created_at, placeholder_name, placeholder_variety, plant_profiles(name, variety_name), supply_profiles(name, brand, deleted_at)")
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
          Out-of-stock items, supplies, and wishlist placeholders. Mark purchased to archive.
        </p>

        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white border border-black/10 p-8 text-center">
            <p className="text-neutral-600 mb-2">No items on your shopping list yet.</p>
            <p className="text-neutral-500 text-sm mb-4">
              Add from Shed (supplies) or Vault (out-of-stock plants).
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/vault?tab=shed"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                Add from Shed
              </Link>
              <Link
                href="/vault"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-6 py-2.5 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5 transition-colors"
              >
                Add from Vault
              </Link>
              <button
                type="button"
                onClick={() => setAddItemModalOpen(true)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-6 py-2.5 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5 transition-colors"
              >
                Manual add
              </button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const isPlaceholder = item.plant_profile_id == null && item.supply_profile_id == null;
              const isSupply = item.supply_profile_id != null;
              const label = item.plant_profiles
                ? item.plant_profiles.variety_name?.trim()
                  ? `${item.plant_profiles.name} — ${item.plant_profiles.variety_name}`
                  : item.plant_profiles.name
                : item.supply_profiles
                  ? item.supply_profiles.brand?.trim()
                    ? `${item.supply_profiles.brand} — ${item.supply_profiles.name}`
                    : item.supply_profiles.name
                  : [item.placeholder_name, item.placeholder_variety].filter(Boolean).join(" — ") || "Unknown";
              const supplyLinkDisabled = isSupply && !!item.supply_profiles?.deleted_at;

              if (isPlaceholder) {
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                  >
                    <span className="flex-1 text-neutral-900">{label}</span>
                    <button
                      type="button"
                      onClick={() => handlePurchased(item.id)}
                      disabled={togglingId === item.id}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      aria-label="Mark as purchased"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurchased(item.id)}
                      disabled={togglingId === item.id}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/15 text-neutral-600 hover:bg-black/5 disabled:opacity-60"
                      aria-label="Remove from list"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                );
              }

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                >
                  <input
                    type="checkbox"
                    id={`purchased-${item.id}`}
                    checked={false}
                    onChange={() => handlePurchased(item.id)}
                    disabled={togglingId === item.id}
                    className="min-w-[44px] min-h-[44px] rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                    aria-label={`Mark ${label} as purchased`}
                  />
                  <label htmlFor={`purchased-${item.id}`} className="flex-1 cursor-pointer text-neutral-900">
                    {isSupply && !supplyLinkDisabled ? (
                      <Link href={`/vault/shed/${item.supply_profile_id}`} className="hover:text-emerald-600" onClick={(e) => e.stopPropagation()}>
                        {label}
                      </Link>
                    ) : (
                      <span>{label}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAddItemModalOpen(true)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
            >
              Add item
            </button>
          </div>
        )}

        <AddItemModal
          open={addItemModalOpen}
          onClose={() => setAddItemModalOpen(false)}
          onSuccess={fetchList}
        />
      </div>
    </div>
  );
}
