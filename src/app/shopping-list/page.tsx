"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useEscapeKey } from "@/hooks/useEscapeKey";
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
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  useEscapeKey(fabMenuOpen, () => setFabMenuOpen(false));

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
            <p className="text-neutral-500 text-sm">
              Add items by name. You can add to Vault or Shed after you purchase.
            </p>
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

        <AddItemModal
          open={addItemModalOpen}
          onClose={() => setAddItemModalOpen(false)}
          onSuccess={fetchList}
        />

        {fabMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setFabMenuOpen(false)} />
            <div
              className="fixed left-4 right-4 bottom-20 z-50 rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
              style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shopping-fab-title"
            >
              <h2 id="shopping-fab-title" className="text-xl font-bold text-center text-neutral-900 mb-1">Add to list</h2>
              <p className="text-sm text-neutral-500 text-center mb-4">Add an item by name.</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setFabMenuOpen(false);
                    setAddItemModalOpen(true);
                  }}
                  className="w-full py-4 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald/40 text-left font-semibold text-neutral-900 transition-colors flex items-center gap-3 min-h-[44px]"
                >
                  <span className="flex h-10 w-10 rounded-xl bg-neutral-100 items-center justify-center shrink-0 text-xl" aria-hidden>✏️</span>
                  Add item
                </button>
                <div className="pt-4">
                  <button type="button" onClick={() => setFabMenuOpen(false)} className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => setFabMenuOpen((o) => !o)}
          className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
            fabMenuOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
          }`}
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
          aria-label={fabMenuOpen ? "Close menu" : "Add to list"}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${fabMenuOpen ? "rotate-45" : "rotate-0"}`}
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
