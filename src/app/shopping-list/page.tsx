"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { AddItemModal } from "@/components/AddItemModal";
import { EditItemModal } from "@/components/EditItemModal";
import { OwnerBadge } from "@/components/OwnerBadge";

type ShoppingItem = {
  id: string;
  user_id: string;
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
  const router = useRouter();
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFamilyView = householdViewMode === "family";

  const fetchList = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    let query = supabase
      .from("shopping_list")
      .select("id, user_id, plant_profile_id, supply_profile_id, is_purchased, created_at, placeholder_name, placeholder_variety, plant_profiles(name, variety_name), supply_profiles(name, brand, deleted_at)")
      .eq("is_purchased", false)
      .order("created_at", { ascending: false });
    if (!isFamilyView) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as unknown as ShoppingItem[]);
    setLoading(false);
  }, [user?.id, householdViewMode]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handlePurchased = useCallback(
    async (item: ShoppingItem) => {
      const removed = items.find((i) => i.id === item.id);
      if (!removed) return;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setTogglingId(item.id);
      const { error } = await updateWithOfflineQueue("shopping_list", { is_purchased: true }, { id: item.id, user_id: item.user_id });
      setTogglingId(null);
      if (error) {
        hapticError();
        setItems((prev) => [...prev, removed].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
      } else {
        hapticSuccess();
      }
    },
    [items]
  );

  usePullToRefresh({ onRefresh: fetchList, disabled: loading });

  return (
    <div className="min-h-screen bg-paper px-6 pt-2 pb-6">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6 min-h-[44px] min-w-[44px]"
          aria-label="Go back"
        >
          ← Back
        </button>
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
              const isOwn = item.user_id === user?.id;
              const canEdit = canEditPage(item.user_id, "shopping_list");
              const showOwnerBadge = isFamilyView && !isOwn && item.user_id;

              const handlePointerDown = () => {
                if (!canEdit) return;
                longPressTimerRef.current = setTimeout(() => {
                  setEditItem(item);
                  longPressTimerRef.current = null;
                }, 500);
              };
              const handlePointerUp = () => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              };

              if (isPlaceholder) {
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  >
                    <span className="flex-1 text-neutral-900">{label}</span>
                    {showOwnerBadge && (
                      <OwnerBadge shorthand={getShorthandForUser(item.user_id)} canEdit={canEdit} />
                    )}
                    <button
                      type="button"
                      onClick={() => handlePurchased(item)}
                      disabled={togglingId === item.id || !canEdit}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      aria-label="Mark as purchased"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurchased(item)}
                      disabled={togglingId === item.id || !canEdit}
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
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <input
                    type="checkbox"
                    id={`purchased-${item.id}`}
                    checked={false}
                    onChange={() => handlePurchased(item)}
                    disabled={togglingId === item.id || !canEdit}
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
                  {showOwnerBadge && (
                    <OwnerBadge shorthand={getShorthandForUser(item.user_id)} canEdit={canEdit} />
                  )}
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

        <EditItemModal
          item={editItem}
          canEdit={editItem ? canEditPage(editItem.user_id, "shopping_list") : false}
          onClose={() => setEditItem(null)}
          onSuccess={fetchList}
        />

        <button
          type="button"
          onClick={() => setAddItemModalOpen(true)}
          className="fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all bg-emerald text-white"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
          aria-label="Add to list"
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
