"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { updateWithOfflineQueue, deleteWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";

type ShoppingItem = {
  id: string;
  user_id: string;
  plant_profile_id: string | null;
  supply_profile_id: string | null;
  placeholder_name: string | null;
  placeholder_variety: string | null;
  plant_profiles: { name: string; variety_name: string | null } | null;
  supply_profiles: { name: string; brand: string | null; deleted_at: string | null } | null;
};

interface EditItemModalProps {
  item: ShoppingItem | null;
  canEdit: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function getLabel(item: ShoppingItem): string {
  return item.plant_profiles
    ? item.plant_profiles.variety_name?.trim()
      ? `${item.plant_profiles.name} — ${item.plant_profiles.variety_name}`
      : item.plant_profiles.name
    : item.supply_profiles
      ? item.supply_profiles.brand?.trim()
        ? `${item.supply_profiles.brand} — ${item.supply_profiles.name}`
        : item.supply_profiles.name
      : [item.placeholder_name, item.placeholder_variety].filter(Boolean).join(" — ") || "Unknown";
}

export function EditItemModal({ item, canEdit, onClose, onSuccess }: EditItemModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [variety, setVariety] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPlaceholder = item?.plant_profile_id == null && item?.supply_profile_id == null;

  useEffect(() => {
    if (item) {
      setName(item.placeholder_name ?? "");
      setVariety(item.placeholder_variety ?? "");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [item]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!item || !user?.id || !isPlaceholder) return;
      const trimmedName = name.trim();
      if (!trimmedName) return;
      setError(null);
      setSaving(true);
      const { error: updateError } = await updateWithOfflineQueue(
        "shopping_list",
        { placeholder_name: trimmedName, placeholder_variety: variety.trim() || null },
        { id: item.id, user_id: item.user_id }
      );
      setSaving(false);
      if (updateError) {
        hapticError();
        setError(updateError.message);
        return;
      }
      hapticSuccess();
      onSuccess();
      onClose();
    },
    [item, name, variety, user?.id, isPlaceholder, onSuccess, onClose]
  );

  const handleRemove = useCallback(
    async () => {
      if (!item || !user?.id) return;
      setError(null);
      setRemoving(true);
      const { error: deleteError } = await deleteWithOfflineQueue("shopping_list", {
        id: item.id,
        user_id: item.user_id,
      });
      setRemoving(false);
      if (deleteError) {
        hapticError();
        setError(deleteError.message);
        return;
      }
      hapticSuccess();
      onSuccess();
      onClose();
    },
    [item, user?.id, onSuccess, onClose]
  );

  if (!item) return null;

  const label = getLabel(item);
  const supplyLinkDisabled = item.supply_profile_id != null && !!item.supply_profiles?.deleted_at;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-item-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-black/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-item-title" className="text-lg font-semibold text-neutral-900 mb-3">
          Edit item
        </h2>

        {isPlaceholder ? (
          <form onSubmit={handleSave} className="space-y-4">
            {!canEdit && (
              <p className="text-sm text-neutral-500">You don&apos;t have permission to edit this item.</p>
            )}
            <div>
              <label htmlFor="edit-item-name" className="block text-sm font-medium text-neutral-700 mb-1">
                Item name
              </label>
              <input
                ref={inputRef}
                id="edit-item-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Roma tomato"
                className="w-full min-h-[44px] px-4 rounded-xl border border-black/15 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoComplete="off"
                disabled={saving || !canEdit}
              />
            </div>
            <div>
              <label htmlFor="edit-item-variety" className="block text-sm font-medium text-neutral-700 mb-1">
                Variety (optional)
              </label>
              <input
                id="edit-item-variety"
                type="text"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="e.g. San Marzano"
                className="w-full min-h-[44px] px-4 rounded-xl border border-black/15 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoComplete="off"
                disabled={saving || !canEdit}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {canEdit && (
                <>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-w-[44px] min-h-[44px] px-4 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !name.trim()}
                      className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={saving || removing}
                    className="w-full min-h-[44px] py-2 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    {removing ? "Removing…" : "Remove from list"}
                  </button>
                </>
              )}
              {!canEdit && (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] py-2 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5"
                >
                  Close
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-700">{label}</p>
            <div className="flex flex-col gap-2">
              {item.plant_profile_id && (
                <Link
                  href={`/vault/${item.plant_profile_id}`}
                  onClick={onClose}
                  className="min-h-[44px] flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100"
                >
                  View in Vault
                </Link>
              )}
              {item.supply_profile_id && !supplyLinkDisabled && (
                <Link
                  href={`/vault/shed/${item.supply_profile_id}`}
                  onClick={onClose}
                  className="min-h-[44px] flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100"
                >
                  View in Shed
                </Link>
              )}
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="w-full min-h-[44px] py-2 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Remove from list"}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] py-2 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5"
              >
                {canEdit ? "Cancel" : "Close"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
