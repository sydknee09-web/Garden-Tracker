"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  createGroup,
  deleteGroup,
  fetchGroupAssignments,
  fetchUserGroups,
  renameGroup,
  setInstanceGroup,
  updateGroupPositions,
} from "@/lib/groups";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { FormError } from "@/components/FormError";
import { ICON_MAP } from "@/lib/styleDictionary";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import type { Group } from "@/types/garden";

/**
 * Sprint 3 Ship B B3 — Manage Groups modal.
 * Groups follow-up 2026-06-09 — hardened against the "Adding" hang + handles
 * delete-group-with-plants reassignment.
 *
 * Entry from GroupTabs ("+ Manage" chrome at end of tab row). Supports:
 *   - Create new group (optimistic row + Add button; reserved width so the
 *     "Adding…" label never overflows the modal edge)
 *   - Rename existing group (inline editable name + Save when dirty)
 *   - Delete group (inline Yes/No confirm; if the group has plants, a reassign
 *     panel asks where they should go before deleting)
 *   - Reorder (↑↓ adjacent swap; writes explicit positions for ALL groups)
 *
 * Hang fix (2026-06-09): a SINGLE modal-level `busy` flag disables every other
 * save while one is in flight (kills the reorder-during-create race that stalled
 * the menu). Every save is wrapped in a 10s timeout so bad signal can't leave the
 * menu permanently stuck — on timeout we reconcile actual DB state via reload()
 * and surface a clear error. createJournalEntry side effects are non-throwing.
 *
 * Modal shell mirrors AddPlantModal pattern + createPortal to document.body
 * (the GroupTabs trigger sits under a backdrop-blur ancestor that would otherwise
 * clip position:fixed). Pattern anchor at SearchableMultiSelect.tsx:232.
 */

const SAVE_TIMEOUT_MS = 10000;

/** Reject after `ms` if the underlying promise hasn't settled. App-code timeout (setTimeout OK here). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

type RowState = {
  group: Group;
  draftName: string;
  /** Optimistic temp row not yet confirmed by the server (Add in flight). */
  pending?: boolean;
  saving: boolean;
  confirmingDelete: boolean;
};

type Assignment = {
  grow_instance_id: string;
  user_id: string;
  plant_profile_id: string | null;
};

type PendingDelete = {
  group: Group;
  assignments: Assignment[];
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
  /** True while ANY save (create/rename/delete/reorder/reassign) is in flight. Gates all other saves. */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [reassignDest, setReassignDest] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const tempCounter = useRef(0);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const groups = await fetchUserGroups(supabase, user.id);
    if (!aliveRef.current) return;
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
    setError(null);
    setPendingDelete(null);
    reload();
  }, [open, reload]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name || !user?.id || busy) return;
    setBusy(true);
    setCreating(true);
    setError(null);
    // Optimistic: show the new row instantly; reload() reconciles with the server row.
    const tempId = `__temp_${++tempCounter.current}`;
    const now = new Date().toISOString();
    const tempRow: RowState = {
      group: { id: tempId, user_id: user.id, name, position: null, created_at: now, updated_at: now, deleted_at: null },
      draftName: name,
      pending: true,
      saving: true,
      confirmingDelete: false,
    };
    setRows((prev) => [...prev, tempRow]);
    setNewName("");
    try {
      await withTimeout(createGroup(supabase, user.id, name), SAVE_TIMEOUT_MS);
      hapticSuccess();
      onMutated?.();
    } catch (e) {
      hapticError();
      setError(
        e instanceof Error && e.message === "timeout"
          ? "Couldn't add — try again."
          : e instanceof Error
            ? e.message
            : "Couldn't add — try again."
      );
    } finally {
      // Always reconcile to DB truth (covers timeout-but-actually-saved + failures).
      await reload();
      if (aliveRef.current) {
        setCreating(false);
        setBusy(false);
      }
    }
  }, [newName, user?.id, busy, reload, onMutated]);

  const handleRename = useCallback(
    async (groupId: string) => {
      if (busy) return;
      const idx = rows.findIndex((r) => r.group.id === groupId);
      if (idx === -1) return;
      const row = rows[idx]!;
      const name = row.draftName.trim();
      if (!name || name === row.group.name) return;
      setBusy(true);
      setRows((prev) => prev.map((r) => (r.group.id === groupId ? { ...r, saving: true } : r)));
      setError(null);
      try {
        await withTimeout(renameGroup(supabase, groupId, name), SAVE_TIMEOUT_MS);
        hapticSuccess();
        onMutated?.();
      } catch (e) {
        hapticError();
        setError(
          e instanceof Error && e.message === "timeout"
            ? "Couldn't rename — try again."
            : e instanceof Error
              ? e.message
              : "Couldn't rename group."
        );
      } finally {
        await reload();
        if (aliveRef.current) setBusy(false);
      }
    },
    [rows, busy, reload, onMutated]
  );

  const handleConfirmDelete = useCallback((groupId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.group.id === groupId ? { ...r, confirmingDelete: true } : r))
    );
  }, []);

  const handleCancelDelete = useCallback((groupId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.group.id === groupId ? { ...r, confirmingDelete: false } : r))
    );
  }, []);

  /** Yes on the inline confirm. Checks assignments first; routes to reassign panel if the group has plants. */
  const handleDelete = useCallback(
    async (groupId: string) => {
      if (busy) return;
      const row = rows.find((r) => r.group.id === groupId);
      if (!row) return;
      setBusy(true);
      setRows((prev) => prev.map((r) => (r.group.id === groupId ? { ...r, saving: true } : r)));
      setError(null);
      try {
        const assignments = await withTimeout(
          fetchGroupAssignments(supabase, groupId),
          SAVE_TIMEOUT_MS
        );
        if (!aliveRef.current) return;
        if (assignments.length === 0) {
          await withTimeout(deleteGroup(supabase, groupId), SAVE_TIMEOUT_MS);
          hapticSuccess();
          await reload();
          onMutated?.();
        } else {
          // Has plants → open reassign panel; leave the list intact, release busy.
          setPendingDelete({ group: row.group, assignments });
          setReassignDest(null);
          setRows((prev) =>
            prev.map((r) => (r.group.id === groupId ? { ...r, saving: false, confirmingDelete: false } : r))
          );
        }
      } catch (e) {
        hapticError();
        setError(
          e instanceof Error && e.message === "timeout"
            ? "Couldn't delete — try again."
            : e instanceof Error
              ? e.message
              : "Couldn't delete group."
        );
        await reload();
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [rows, busy, reload, onMutated]
  );

  /** Confirm delete after the user picks where the group's plants should go. */
  const handleConfirmReassignDelete = useCallback(async () => {
    if (busy || !pendingDelete) return;
    const { group, assignments } = pendingDelete;
    const destRow = reassignDest ? rows.find((r) => r.group.id === reassignDest) : null;
    const nextGroup = destRow ? { id: destRow.group.id, name: destRow.group.name } : null;
    setBusy(true);
    setError(null);
    try {
      for (const a of assignments) {
        // priorGroups = [group being deleted] → journals "Moved {group} → {dest}" or "Removed from {group}".
        await withTimeout(
          setInstanceGroup(supabase, {
            growInstanceId: a.grow_instance_id,
            userId: a.user_id,
            plantProfileId: a.plant_profile_id,
            nextGroup,
            priorGroups: [group],
          }),
          SAVE_TIMEOUT_MS
        );
      }
      await withTimeout(deleteGroup(supabase, group.id), SAVE_TIMEOUT_MS);
      hapticSuccess();
      if (aliveRef.current) setPendingDelete(null);
      await reload();
      onMutated?.();
    } catch (e) {
      hapticError();
      setError(
        e instanceof Error && e.message === "timeout"
          ? "Couldn't finish — try again."
          : e instanceof Error
            ? e.message
            : "Couldn't reassign and delete."
      );
      await reload();
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [busy, pendingDelete, reassignDest, rows, reload, onMutated]);

  const handleReorder = useCallback(
    async (index: number, direction: "up" | "down") => {
      if (busy) return;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= rows.length) return;
      const next = [...rows];
      [next[index], next[target]] = [next[target]!, next[index]!];
      setBusy(true);
      setRows(next);
      setError(null);
      try {
        await withTimeout(
          updateGroupPositions(
            supabase,
            next.map((r, i) => ({ id: r.group.id, position: i }))
          ),
          SAVE_TIMEOUT_MS
        );
        hapticSuccess();
        onMutated?.();
      } catch (e) {
        hapticError();
        setError(
          e instanceof Error && e.message === "timeout"
            ? "Couldn't reorder — try again."
            : e instanceof Error
              ? e.message
              : "Couldn't reorder groups."
        );
        await reload();
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [rows, busy, reload, onMutated]
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const otherGroups = pendingDelete
    ? rows.filter((r) => r.group.id !== pendingDelete.group.id && !r.group.id.startsWith("__temp_"))
    : [];

  return createPortal(
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
            <ModalCloseButton onClick={onClose} />
          </div>
          <p className="text-sm text-neutral-500 text-center">
            Organize plants into custom groups for filtering in the Garden tab.
          </p>
        </div>

        {pendingDelete ? (
          /* ---- Reassign-before-delete panel ---- */
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-1">
              <p className="text-sm font-medium text-neutral-900">
                {pendingDelete.group.name} has {pendingDelete.assignments.length}{" "}
                {pendingDelete.assignments.length === 1 ? "plant" : "plants"}.
              </p>
              <p className="text-sm text-neutral-600">Where should they go?</p>
            </div>

            <ul className="space-y-2" role="radiogroup" aria-label="Reassign plants to">
              {otherGroups.map((r) => (
                <li key={r.group.id}>
                  <button
                    type="button"
                    onClick={() => setReassignDest(r.group.id)}
                    disabled={busy}
                    role="radio"
                    aria-checked={reassignDest === r.group.id}
                    className={`w-full text-left min-h-[44px] px-3 py-2 rounded-xl border text-sm font-medium disabled:opacity-50 ${
                      reassignDest === r.group.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {r.group.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setReassignDest(null)}
                  disabled={busy}
                  role="radio"
                  aria-checked={reassignDest === null}
                  className={`w-full text-left min-h-[44px] px-3 py-2 rounded-xl border text-sm font-medium disabled:opacity-50 ${
                    reassignDest === null
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  No group / Unassigned
                </button>
              </li>
            </ul>

            {error && <FormError>{error}</FormError>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(null);
                  setError(null);
                }}
                disabled={busy}
                className="flex-1 min-h-[48px] rounded-3xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignDelete}
                disabled={busy}
                className="flex-1 min-h-[48px] rounded-3xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {busy ? "Working…" : "Delete Group"}
              </button>
            </div>
          </div>
        ) : (
          /* ---- Default list panel ---- */
          <>
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
                      if (e.key === "Enter" && newName.trim() && !busy) {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                    placeholder="e.g. Patio, Bedroom"
                    className="flex-1 min-w-0 px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || busy}
                    className="min-h-[44px] min-w-[5.5rem] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center shrink-0"
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
                  <div className="py-6 text-center space-y-1">
                    <p className="text-sm text-neutral-500">— No groups yet —</p>
                    <p className="text-xs text-neutral-400">
                      Add one above to start organizing plants.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((row, idx) => {
                      const dirty =
                        !row.pending &&
                        row.draftName.trim() !== "" &&
                        row.draftName.trim() !== row.group.name;
                      const rowLocked = busy || row.pending === true;
                      return (
                        <li
                          key={row.group.id}
                          className={`rounded-xl border border-neutral-200 bg-white p-2 flex items-center gap-2 ${
                            row.pending ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleReorder(idx, "up")}
                              disabled={idx === 0 || rowLocked}
                              className="min-w-[28px] min-h-[20px] text-neutral-500 hover:text-neutral-800 disabled:opacity-30 flex items-center justify-center"
                              aria-label={`Move ${row.group.name} up`}
                            >
                              <ICON_MAP.ChevronUp stroke="currentColor" className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorder(idx, "down")}
                              disabled={idx === rows.length - 1 || rowLocked}
                              className="min-w-[28px] min-h-[20px] text-neutral-500 hover:text-neutral-800 disabled:opacity-30 flex items-center justify-center"
                              aria-label={`Move ${row.group.name} down`}
                            >
                              <ICON_MAP.ChevronDown stroke="currentColor" className="w-4 h-4" />
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
                              if (e.key === "Enter" && dirty && !busy) {
                                e.preventDefault();
                                handleRename(row.group.id);
                              }
                            }}
                            disabled={rowLocked || row.confirmingDelete}
                            className="flex-1 min-w-0 px-2 py-1.5 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[36px]"
                            aria-label={`Rename ${row.group.name}`}
                          />
                          {row.confirmingDelete ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-neutral-600">Delete?</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(row.group.id)}
                                disabled={busy}
                                className="min-h-[36px] px-2 py-1 rounded-xl bg-red-500 text-white text-xs font-medium disabled:opacity-50"
                              >
                                {busy ? "…" : "Yes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelDelete(row.group.id)}
                                disabled={busy}
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
                                  disabled={rowLocked}
                                  className="min-h-[36px] px-2 py-1 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                                  aria-label={`Save rename for ${row.group.name}`}
                                >
                                  {busy ? "…" : "Save"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(row.group.id)}
                                disabled={rowLocked}
                                className="min-w-[36px] min-h-[36px] p-1 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center"
                                aria-label={`Delete ${row.group.name}`}
                              >
                                <ICON_MAP.Trash stroke="currentColor" className="w-4 h-4" />
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

            <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[48px] rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
