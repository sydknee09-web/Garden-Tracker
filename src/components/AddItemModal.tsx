"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatAddFlowError } from "@/lib/addFlowError";
import { insertManyWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Optional: show error as a toast (e.g. from parent useToast().showErrorToast) for visibility. */
  onErrorToast?: (message: string) => void;
}

export function AddItemModal({ open, onClose, onSuccess, onErrorToast }: AddItemModalProps) {
  const { user } = useAuth();
  const [cells, setCells] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastInputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (open) {
      setCells([""]);
      setError(null);
      setTimeout(() => lastInputRef.current?.focus(), 50);
    }
  }, [open]);

  const updateCell = useCallback((index: number, value: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const addAnotherCell = useCallback(() => {
    setCells((prev) => [...prev, ""]);
    setTimeout(() => lastInputRef.current?.focus(), 50);
  }, []);

  const handleDone = useCallback(
    async () => {
      const items = cells.map((c) => c.trim()).filter(Boolean);
      if (items.length === 0 || !user?.id) {
        onClose();
        return;
      }
      setError(null);
      setSaving(true);
      const rows = items.map((placeholder_name) => ({
        user_id: user.id,
        plant_profile_id: null,
        supply_profile_id: null,
        placeholder_name,
        placeholder_variety: null,
        is_purchased: false,
      }));
      const { error: insertError } = await insertManyWithOfflineQueue("shopping_list", rows);
      setSaving(false);
      if (insertError) {
        hapticError();
        const msg = formatAddFlowError(insertError);
        setError(msg);
        onErrorToast?.(msg);
        return;
      }
      hapticSuccess();
      onSuccess();
      onClose();
    },
    [cells, user?.id, onSuccess, onClose, onErrorToast]
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
        ref={trapRef}
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-black/10 p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-item-title" className="text-lg font-semibold text-neutral-900 mb-3">
          Add item
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Add plants or supplies by name.
        </p>
        <div className="space-y-3">
          {cells.map((value, index) => (
            <input
              key={index}
              ref={index === cells.length - 1 ? lastInputRef : null}
              type="text"
              value={value}
              onChange={(e) => updateCell(index, e.target.value)}
              placeholder="e.g. Roma tomato, Miracle Gro"
              className="w-full min-h-[44px] px-4 rounded-xl border border-black/15 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoComplete="off"
              disabled={saving}
              aria-label={`Item ${index + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={addAnotherCell}
            disabled={saving}
            className="w-full min-h-[44px] py-2 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span aria-hidden>+</span>
            Add another item
          </button>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleDone}
            disabled={saving}
            className="w-full min-h-[44px] py-2 rounded-xl border border-black/15 text-neutral-700 font-medium hover:bg-black/5 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
