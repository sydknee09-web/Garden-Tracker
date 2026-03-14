"use client";

import Link from "next/link";
import { ICON_MAP } from "@/lib/styleDictionary";
import { useRouter, useSearchParams } from "next/navigation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue, deleteWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { useState, useEffect, useCallback, useRef } from "react";
import { AddItemModal } from "@/components/AddItemModal";
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
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const LONG_PRESS_MS = 500;

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

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

  const handleRemove = useCallback(
    async (item: ShoppingItem) => {
      if (!canEditPage(item.user_id, "shopping_list")) return;
      const removed = items.find((i) => i.id === item.id);
      if (!removed) return;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      const { error } = await deleteWithOfflineQueue("shopping_list", { id: item.id, user_id: item.user_id });
      if (error) {
        hapticError();
        setItems((prev) => [...prev, removed].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
      } else {
        hapticSuccess();
      }
    },
    [items, canEditPage]
  );

  const handleInlineSave = useCallback(
    async (item: ShoppingItem) => {
      const trimmed = editingValue.trim();
      if (!trimmed || !user?.id) {
        setEditingId(null);
        return;
      }
      const parts = trimmed.split(" — ").map((s) => s.trim());
      const placeholder_name = parts[0] || trimmed;
      const placeholder_variety = parts.length > 1 ? parts.slice(1).join(" — ") : null;
      setEditingId(null);
      const { error } = await updateWithOfflineQueue(
        "shopping_list",
        { placeholder_name, placeholder_variety },
        { id: item.id, user_id: item.user_id }
      );
      if (error) {
        hapticError();
        setEditingValue("");
      } else {
        hapticSuccess();
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, placeholder_name, placeholder_variety } : i
          )
        );
      }
    },
    [editingValue, user?.id]
  );

  useEffect(() => {
    if (editingId) {
      const item = items.find((i) => i.id === editingId);
      const val = item
        ? [item.placeholder_name, item.placeholder_variety].filter(Boolean).join(" — ")
        : "";
      setEditingValue(val);
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId, items]);

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
          aria-label={fromParam === "home" ? "Back to Home" : "Back to previous page"}
        >
          ← {fromParam === "home" ? "Home" : "Back"}
        </button>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Shopping List</h2>
        <p className="text-neutral-600 text-sm mb-6">
          Out-of-stock items, supplies, and wishlist placeholders. Mark purchased to archive.
        </p>

        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyStateCard
            title="No items on your shopping list yet."
            body="Add items by name. You can add to Vault or Shed after you purchase."
            actionLabel="Add item"
            onAction={() => setAddItemModalOpen(true)}
          />
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

              const startLongPress = (e: React.TouchEvent | React.MouseEvent) => {
                if (!canEdit || !isPlaceholder) return;
                if ((e.target as HTMLElement).closest("button, a, input")) return;
                longPressFiredRef.current = false;
                clearLongPressTimer();
                longPressTimerRef.current = setTimeout(() => {
                  longPressTimerRef.current = null;
                  longPressFiredRef.current = true;
                  setEditingId(item.id);
                }, LONG_PRESS_MS);
              };
              const cancelLongPress = () => {
                clearLongPressTimer();
              };
              const handleRowClick = (e: React.MouseEvent) => {
                if (longPressFiredRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  longPressFiredRef.current = false;
                }
              };

              if (isPlaceholder) {
                const isEditing = editingId === item.id;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                    onTouchStart={startLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onMouseDown={startLongPress}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onClick={handleRowClick}
                  >
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => handleInlineSave(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInlineSave(item);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 min-h-[44px] px-2 rounded-lg border border-emerald-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-neutral-900" title="Hold to edit">{label}</span>
                    )}
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
                      onClick={() => handleRemove(item)}
                      disabled={togglingId === item.id || !canEdit}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/15 text-neutral-600 hover:bg-black/5 disabled:opacity-60"
                      aria-label="Remove from list"
                    >
                      <ICON_MAP.Close stroke="currentColor" className="w-5 h-5" />
                    </button>
                  </li>
                );
              }

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                >
                  <span className="flex-1 min-w-0 text-neutral-900">
                    {item.plant_profile_id ? (
                      <Link href={`/vault/${item.plant_profile_id}`} className="hover:text-emerald-600" onClick={(e) => e.stopPropagation()}>
                        {label}
                      </Link>
                    ) : isSupply && !supplyLinkDisabled ? (
                      <Link href={`/vault/shed/${item.supply_profile_id}`} className="hover:text-emerald-600" onClick={(e) => e.stopPropagation()}>
                        {label}
                      </Link>
                    ) : (
                      <span>{label}</span>
                    )}
                  </span>
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
                    onClick={() => handleRemove(item)}
                    disabled={togglingId === item.id || !canEdit}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/15 text-neutral-600 hover:bg-black/5 disabled:opacity-60"
                    aria-label="Remove from list"
                  >
                    <ICON_MAP.Close stroke="currentColor" className="w-5 h-5" />
                  </button>
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
