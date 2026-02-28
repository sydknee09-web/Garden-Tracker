"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { insertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddItemModal({ open, onClose, onSuccess }: AddItemModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || !user?.id) return;
      setError(null);
      setSaving(true);
      const { error: insertError } = await insertWithOfflineQueue("shopping_list", {
        user_id: user.id,
        plant_profile_id: null,
        supply_profile_id: null,
        placeholder_name: trimmed,
        placeholder_variety: null,
        is_purchased: false,
      });
      setSaving(false);
      if (insertError) {
        hapticError();
        setError(insertError.message);
        return;
      }
      hapticSuccess();
      onSuccess();
      setName("");
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [name, user?.id, onSuccess]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-item-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-black/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-item-title" className="text-lg font-semibold text-neutral-900 mb-3">
          Add item
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Add plants or supplies by name. Add multiple items, then tap Done when finished.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="add-item-name" className="sr-only">
            Item name
          </label>
          <input
            ref={inputRef}
            id="add-item-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Roma tomato, Miracle Gro"
            className="w-full min-h-[44px] px-4 rounded-xl border border-black/15 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            autoComplete="off"
            disabled={saving}
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] px-4 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5 disabled:opacity-50"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
