"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  createGroup,
  deleteGroup,
  fetchUserGroups,
  renameGroup,
  updateGroupPositions,
} from "@/lib/groups";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { FormError } from "@/components/FormError";
import { ICON_MAP } from "@/lib/styleDictionary";
import type { Group } from "@/types/garden";

/**
 * Sprint 3 Ship B B3 — Manage Groups modal.
 *
 * Entry from GroupTabs ("+ Manage" chrome at end of tab row). Supports:
 *   - Create new group (name input + Add button)
 *   - Rename existing group (inline editable name + Save when dirty)
 *   - Delete group (inline Yes/No confirm; B1 helper soft-deletes group + hard-deletes plant_groups)
 *   - Reorder (↑↓ adjacent swap; writes explicit positions for ALL groups so future ordering is deterministic)
 *
 * Modal shell mirrors AddPlantModal pattern (fixed inset-0 z-[60] backdrop + rounded-3xl panel,
 * useFocusTrap + useEscapeKey + useBodyScrollLock).
 */

type RowState = {
  group: Group;
  draftName: string;
  saving: boolean;
  confirmingDelete: boolean;
};

export function ManageGroupsModal({
  open,
  onClose,
  onMutated,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after any successful create/rename/delete/reorder so parent can re-fetch. */
  onMutated?: () => void;
}) {
  const { user } = useAuth();
  const modalRef = useFocusTrap(open);
  useEscapeKey(open, onClose);
  useBodyScrollLock(open);

  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const groups = await fetchUserGroups(supabase, user.id);
    setRows(
      groups.map((g) => ({
        group: g,
        draftName: g.name,
        saving: false,
        confirmingDelete: false,
      }))
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    reload();
  }, [open, reload]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name || !user?.id) return;
    setCreating(true);
    setError(null);
    try {
      await createGroup(supabase, user.id, name);
      setNewName("");
      hapticSuccess();
      await reload();
      onMutated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add group.");
      hapticError();
    } finally {
      setCreating(false);
    }
  }, [newName, user?.id, reload, onMutated]);

  const handleRename = useCallback(
    async (groupId: string) => {
      const idx = rows.findIndex((r) => r.group.id === groupId);
      if (idx === -1) return;
      const row = rows[idx]!;
      const name = row.draftName.trim();
      if (!name || name === row.group.name) return;
      setRows((prev) =>
        prev.map((r) => (r.group.id === groupId ? { ...r, saving: true } : r))
      );
      setError(null);
      try {
        await renameGroup(supabase, groupId, name);
        hapticSuccess();
        await reload();
        onMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't rename group.");
        hapticError();
        setRows((prev) =>
          prev.map((r) =>
            r.group.id === groupId ? { ...r, saving: false } : r
          )
        );
      }
    },
    [rows, reload, onMutated]
  );

  const handleConfirmDelete = useCallback((groupId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.group.id === groupId ? { ...r, confirmingDelete: true } : r
      )
    );
  }, []);

  const handleCancelDelete = useCallback((groupId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.group.id === groupId ? { ...r, confirmingDelete: false } : r
      )
    );
  }, []);

  const handleDelete = useCallback(
    async (groupId: string) => {
      setRows((prev) =>
        prev.map((r) =>
          r.group.id === groupId ? { ...r, saving: true } : r
        )
      );
      setError(null);
      try {
        await deleteGroup(supabase, groupId);
        hapticSuccess();
        await reload();
        onMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete group.");
        hapticError();
        setRows((prev) =>
          prev.map((r) =>
            r.group.id === groupId
              ? { ...r, saving: false, confirmingDelete: false }
              : r
          )
        );
      }
    },
    [reload, onMutated]
  );

  const handleReorder = useCallback(
    async (index: number, direction: "up" | "down") => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= rows.length) return;
      const next = [...rows];
      [next[index], next[target]] = [next[target]!, next[index]!];
      setRows(next);
      setError(null);
      try {
        await updateGroupPositions(
          supabase,
          next.map((r, i) => ({ id: r.group.id, position: i }))
        );
        hapticSuccess();
        onMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reorder groups.");
        hapticError();
        await reload();
      }
    },
    [rows, reload, onMutated]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/20"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-groups-title"
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-3xl border border-neutral-200/80 shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden"
        tabIndex={-1}
      >
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-11 shrink-0" aria-hidden />
            <h2
              id="manage-groups-title"
              className="text-xl font-bold text-neutral-900 flex-1 text-center"
            >
              Manage Groups
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <ICON_MAP.Close stroke="currentColor" className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-neutral-500 text-center">
            Organize plants into custom groups for filtering in the Garden tab.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
          <div>
            <label
              htmlFor="manage-groups-new"
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              Add Group
            </label>
            <div className="flex gap-2">
              <input
                id="manage-groups-new"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim() && !creating) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="e.g. Patio, Bedroom"
                className="flex-1 px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? "Adding…" : "Add"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">Your Groups</p>
            {loading && rows.length === 0 ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No groups yet. Add one above to start organizing plants.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row, idx) => {
                  const dirty =
                    row.draftName.trim() !== "" &&
                    row.draftName.trim() !== row.group.name;
                  return (
                    <li
                      key={row.group.id}
                      className="rounded-xl border border-neutral-200 bg-white p-2 flex items-center gap-2"
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReorder(idx, "up")}
                          disabled={idx === 0 || row.saving}
                          className="min-w-[28px] min-h-[20px] text-neutral-500 hover:text-neutral-800 disabled:opacity-30 flex items-center justify-center"
                          aria-label={`Move ${row.group.name} up`}
                        >
                          <ICON_MAP.ChevronDown
                            stroke="currentColor"
                            className="w-4 h-4 rotate-180"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(idx, "down")}
                          disabled={idx === rows.length - 1 || row.saving}
                          className="min-w-[28px] min-h-[20px] text-neutral-500 hover:text-neutral-800 disabled:opacity-30 flex items-center justify-center"
                          aria-label={`Move ${row.group.name} down`}
                        >
                          <ICON_MAP.ChevronDown
                            stroke="currentColor"
                            className="w-4 h-4"
                          />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={row.draftName}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.group.id === row.group.id
                                ? { ...r, draftName: e.target.value }
                                : r
                            )
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && dirty && !row.saving) {
                            e.preventDefault();
                            handleRename(row.group.id);
                          }
                        }}
                        disabled={row.saving || row.confirmingDelete}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[36px]"
                        aria-label={`Rename ${row.group.name}`}
                      />
                      {row.confirmingDelete ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-neutral-600">
                            Delete?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.group.id)}
                            disabled={row.saving}
                            className="min-h-[36px] px-2 py-1 rounded-xl bg-red-500 text-white text-xs font-medium disabled:opacity-50"
                          >
                            {row.saving ? "…" : "Yes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelDelete(row.group.id)}
                            disabled={row.saving}
                            className="min-h-[36px] px-2 py-1 rounded-xl border border-neutral-300 text-neutral-700 text-xs font-medium disabled:opacity-50"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          {dirty && (
                            <button
                              type="button"
                              onClick={() => handleRename(row.group.id)}
                              disabled={row.saving}
                              className="min-h-[36px] px-2 py-1 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                              aria-label={`Save rename for ${row.group.name}`}
                            >
                              {row.saving ? "…" : "Save"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(row.group.id)}
                            disabled={row.saving}
                            className="min-w-[36px] min-h-[36px] p-1 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center"
                            aria-label={`Delete ${row.group.name}`}
                          >
                            <ICON_MAP.Trash
                              stroke="currentColor"
                              className="w-4 h-4"
                            />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error && <FormError>{error}</FormError>}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
