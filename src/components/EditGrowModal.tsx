"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { softDeleteTasksForGrowInstance } from "@/lib/cascadeOnGrowEnd";
import { revertProfileStatusIfNoActiveGrows } from "@/lib/revertProfileStatus";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { useToast } from "@/hooks/useToast";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { FormError } from "@/components/FormError";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import type { GrowInstance } from "@/types/garden";

/**
 * Edit Plant menu — the single canonical editor for a growing instance (planting).
 * Opened from the pencil affordance on the instance page chrome strip AND from the
 * Library profile Plantings tab (NORTH_STAR "No duplicate paths": one concept → one
 * canonical surface; replaces the prior inline vault/[id] editGrow modal + the
 * instance page's standalone Archive pill, Syd lock 2026-06-11 Findings #12/#13).
 *
 * Contents: instance fields → Edit Photo placeholder (Cover Photo ship wires the
 * picker) → Archive Planting (amber, reason dialog — the merged archive/end flow)
 * → Delete Planting (red, type-the-plant-name confirm; soft-deletes the planting
 * AND cascades its journal entries + tasks per the bulk-delete sibling pattern).
 */
export interface EditGrowModalProps {
  grow: GrowInstance;
  /** Plant name from the linked profile — shown in dialogs + typed to confirm delete. */
  profileName: string;
  profileVarietyName?: string | null;
  isPermanent: boolean;
  isEdible: boolean;
  currentUserId: string;
  onClose: () => void;
  /** Field save committed — host refetches. */
  onSaved: () => void;
  /** Planting archived — host refetches or navigates away. */
  onArchived: () => void;
  /** Planting deleted — host refetches or navigates away. */
  onDeleted: () => void;
}

const ARCHIVE_REASONS = [
  { value: "season_ended", label: "Season Ended" },
  { value: "harvested_all", label: "Harvested All" },
  { value: "plant_died", label: "Plant Died" },
] as const;

export function EditGrowModal({
  grow,
  profileName,
  profileVarietyName,
  isPermanent,
  isEdible,
  currentUserId,
  onClose,
  onSaved,
  onArchived,
  onDeleted,
}: EditGrowModalProps) {
  const { toast, showErrorToast } = useToast();
  const ownerId = grow.user_id ?? currentUserId;
  const displayName = profileVarietyName?.trim() ? `${profileName} (${profileVarietyName})` : profileName;

  // Field drafts (seeded once from the grow row — the modal unmounts on close)
  const [sownDate, setSownDate] = useState(grow.sown_date ? grow.sown_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState((grow.vendor ?? "").trim());
  const [price, setPrice] = useState((grow.purchase_price ?? "").trim());
  const [purchaseQuantity, setPurchaseQuantity] = useState<string>(grow.purchase_quantity != null ? String(grow.purchase_quantity) : "");
  const [location, setLocation] = useState(grow.location ?? "");
  const [plantCount, setPlantCount] = useState(Math.max(1, grow.plant_count ?? 1));
  const [sowMethod, setSowMethod] = useState<string>(grow.sow_method ?? "");
  const [expectedHarvest, setExpectedHarvest] = useState(grow.expected_harvest_date ? grow.expected_harvest_date.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Archive Planting — reason dialog (the existing end-flow, merged with the old simple archive)
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState<string>("season_ended");
  const [archiveNote, setArchiveNote] = useState("");
  const [archiveSaving, setArchiveSaving] = useState(false);

  // Delete Planting — high-friction type-name confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Edit Photo placeholder — replaced by the Cover Photo ship's picker sheet
  const [photoTodoOpen, setPhotoTodoOpen] = useState(false);

  const busy = saving || archiveSaving || deleteSaving;
  useModalBackClose(true, () => { if (!busy) onClose(); });

  const deleteNameMatches = deleteNameInput.trim().toLowerCase() === profileName.trim().toLowerCase();

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const patch: Record<string, unknown> = {
      location: location.trim() || null,
      vendor: vendor.trim() || null,
      purchase_price: price.trim() || null,
      sown_date: sownDate || grow.sown_date,
      plant_count: Math.max(1, plantCount),
    };
    // Conditional fields mirror what the form shows — never clobber fields the user couldn't see.
    if (isPermanent) {
      const qty = parseInt(purchaseQuantity, 10);
      patch.purchase_quantity = Number.isFinite(qty) && qty > 0 ? qty : null;
    }
    if (!isPermanent) {
      patch.sow_method = sowMethod || null;
    }
    if (isEdible) {
      patch.expected_harvest_date = expectedHarvest || null;
    }
    const { error } = await updateWithOfflineQueue("grow_instances", patch, { id: grow.id, user_id: ownerId });
    setSaving(false);
    if (error) { setSaveError(error.message); hapticError(); return; }
    hapticSuccess();
    onSaved();
  }

  async function handleArchive() {
    setArchiveSaving(true);
    const now = new Date().toISOString();
    const isDead = archiveReason === "plant_died";
    // Terminal status is always 'archived' (2-state enum, collapsed 2026-05-28); the
    // reason is preserved via end_reason + the death/note journal entry below.
    const { error } = await updateWithOfflineQueue(
      "grow_instances",
      { status: "archived", ended_at: now, end_reason: archiveReason },
      { id: grow.id, user_id: ownerId }
    );
    if (error) {
      setArchiveSaving(false);
      showErrorToast("Couldn't archive — please try again");
      return;
    }
    await softDeleteTasksForGrowInstance(grow.id, ownerId);
    if (archiveNote.trim() || isDead) {
      const weather = await fetchWeatherSnapshot();
      await insertWithOfflineQueue("journal_entries", {
        user_id: currentUserId,
        plant_profile_id: grow.plant_profile_id ?? null,
        grow_instance_id: grow.id,
        note: archiveNote.trim() || (isDead ? "Plant died" : "Planting ended"),
        entry_type: isDead ? "death" : "note",
        weather_snapshot: weather ?? undefined,
      });
    }
    if (grow.plant_profile_id) await revertProfileStatusIfNoActiveGrows(supabase, grow.plant_profile_id);
    setArchiveSaving(false);
    setArchiveOpen(false);
    onArchived();
  }

  async function handleDelete() {
    if (!deleteNameMatches) return;
    setDeleteSaving(true);
    const now = new Date().toISOString();
    // Cascade order matches the GardenView bulk-delete sibling: journal entries →
    // tasks → the grow row → profile-status revert. Journal entries linked to a
    // deleted planting no longer make sense alone (Syd cascade lock 2026-06-11).
    await updateWithOfflineQueue("journal_entries", { deleted_at: now }, { grow_instance_id: grow.id, user_id: ownerId });
    await softDeleteTasksForGrowInstance(grow.id, ownerId);
    const { error } = await updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: grow.id, user_id: ownerId });
    if (error) {
      setDeleteSaving(false);
      showErrorToast("Couldn't delete — please try again");
      return;
    }
    if (grow.plant_profile_id) await revertProfileStatusIfNoActiveGrows(supabase, grow.plant_profile_id);
    setDeleteSaving(false);
    setDeleteOpen(false);
    onDeleted();
  }

  return (
    <>
      {toast}
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="edit-grow-title">
        <div className="relative bg-white w-full max-w-md md:rounded-2xl shadow-xl border border-neutral-200 min-h-[100dvh] md:min-h-0 max-h-[100dvh] md:max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl md:rounded-2xl">
          <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-neutral-200">
            <h2 id="edit-grow-title" className="text-lg font-bold text-neutral-900">Edit Plant</h2>
            {/* Stacked-italic variety (VISION §8) — no parens; two skimmable lines. */}
            <p className="text-sm text-neutral-500 mt-0.5">{profileName}</p>
            {profileVarietyName?.trim() ? (
              <p className="text-sm italic text-neutral-600">{profileVarietyName}</p>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {/* Edit Photo at TOP — canonical position across edit modals (Syd lock
                  2026-06-12; matches Edit Plant Profile modal). Placeholder until the
                  Cover Photo ship wires the picker. */}
              <div>
                <button
                  type="button"
                  onClick={() => setPhotoTodoOpen(true)}
                  className="w-full min-h-[44px] py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50"
                >
                  Edit Photo
                </button>
              </div>
              <div>
                <label htmlFor="edit-grow-date" className="block text-sm font-medium text-neutral-700 mb-1">Date planted</label>
                <input
                  id="edit-grow-date"
                  type="date"
                  value={sownDate}
                  onChange={(e) => setSownDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                />
              </div>
              {!isPermanent && (
                <div>
                  <label htmlFor="edit-grow-sow-method" className="block text-sm font-medium text-neutral-700 mb-1">Sow method</label>
                  <select
                    id="edit-grow-sow-method"
                    value={sowMethod}
                    onChange={(e) => setSowMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-neutral-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  >
                    <option value="">Not set</option>
                    <option value="direct_sow">Direct sow</option>
                    <option value="seed_start">Seed start</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="edit-grow-vendor" className="block text-sm font-medium text-neutral-700 mb-1">Vendor / nursery</label>
                <input
                  id="edit-grow-vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Home Depot, Briggs Tree Nursery"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Vendor / nursery"
                />
              </div>
              <div>
                <label htmlFor="edit-grow-price" className="block text-sm font-medium text-neutral-700 mb-1">Price</label>
                <input
                  id="edit-grow-price"
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. $12.99"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label="Price"
                />
              </div>
              {isPermanent && (
                <div>
                  <label htmlFor="edit-grow-purchase-qty" className="block text-sm font-medium text-neutral-700 mb-1">Quantity purchased</label>
                  <input
                    id="edit-grow-purchase-qty"
                    type="number"
                    min={1}
                    value={purchaseQuantity}
                    onChange={(e) => setPurchaseQuantity(e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
              )}
              <div>
                <label htmlFor="edit-grow-location" className="block text-sm font-medium text-neutral-700 mb-1">Location</label>
                <input
                  id="edit-grow-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. North fence, Backyard"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="edit-grow-count" className="block text-sm font-medium text-neutral-700 mb-1">Number of plants</label>
                <input
                  id="edit-grow-count"
                  type="number"
                  min={1}
                  value={plantCount}
                  onChange={(e) => setPlantCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                />
              </div>
              {isEdible && (
                <div>
                  <label htmlFor="edit-grow-expected-harvest" className="block text-sm font-medium text-neutral-700 mb-1">Expected harvest</label>
                  <input
                    id="edit-grow-expected-harvest"
                    type="date"
                    value={expectedHarvest}
                    onChange={(e) => setExpectedHarvest(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  />
                </div>
              )}
            </div>
            <div className="pt-4 mt-4 border-t border-neutral-200 space-y-2">
              <p className="text-xs font-medium text-neutral-500 mb-1">Or</p>
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="w-full min-h-[44px] py-2.5 rounded-xl border border-amber-200/80 text-amber-700 font-medium hover:bg-amber-50"
              >
                Archive Planting
              </button>
              <button
                type="button"
                onClick={() => { setDeleteNameInput(""); setDeleteOpen(true); }}
                className="w-full min-h-[44px] py-2.5 rounded-xl border border-red-200 text-red-700 font-medium hover:bg-red-50"
              >
                Delete Planting
              </button>
            </div>
          </div>
          <div className="flex-shrink-0 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-neutral-200">
            {saveError && <div className="mb-3"><FormError>{saveError}</FormError></div>}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} disabled={saving} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <SubmitLoadingOverlay show={saving} message="Saving…" />
        </div>
      </div>

      {/* Archive Planting — reason dialog (soft-remove, restorable from archived plantings) */}
      {archiveOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => { if (!archiveSaving) setArchiveOpen(false); }} />
          <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm" role="dialog" aria-modal="true" aria-labelledby="archive-planting-title">
            <h2 id="archive-planting-title" className="text-lg font-semibold text-neutral-900 mb-1">Archive Planting</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Archives {displayName} and keeps it in your history. Review later under archived plantings.
            </p>
            <div className="space-y-3 mb-4">
              {ARCHIVE_REASONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="archive-reason" value={opt.value} checked={archiveReason === opt.value} onChange={() => setArchiveReason(opt.value)} className="text-emerald-600 focus:ring-emerald-500" />
                  <span className={`text-sm font-medium ${opt.value === "plant_died" ? "text-red-600" : "text-neutral-700"}`}>{opt.label}</span>
                </label>
              ))}
            </div>
            <textarea placeholder="Optional note..." value={archiveNote} onChange={(e) => setArchiveNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm mb-4 focus:ring-emerald-500" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                disabled={archiveSaving}
                className="flex-1 min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveSaving}
                className={`flex-1 min-h-[44px] rounded-xl font-medium text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 ${archiveReason === "plant_died" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
              >
                {archiveSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                {archiveReason === "plant_died" ? "Mark as Dead" : "Archive"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Planting — irreversible; type the plant name to confirm */}
      {deleteOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => { if (!deleteSaving) setDeleteOpen(false); }} />
          <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-planting-title">
            <h2 id="delete-planting-title" className="text-lg font-semibold text-neutral-900 mb-1">Delete Planting?</h2>
            <p className="text-sm text-neutral-500 mb-4">
              This permanently removes {displayName} and its journal entries. This cannot be undone.
            </p>
            <label htmlFor="delete-planting-confirm" className="block text-sm font-medium text-neutral-700 mb-1">
              Type <span className="font-semibold">{profileName.trim()}</span> to confirm
            </label>
            <input
              id="delete-planting-confirm"
              type="text"
              value={deleteNameInput}
              onChange={(e) => setDeleteNameInput(e.target.value)}
              placeholder={profileName.trim()}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[44px] mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteSaving}
                className="flex-1 min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!deleteNameMatches || deleteSaving}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Photo — placeholder until the Cover Photo ship wires the picker sheet */}
      {photoTodoOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => setPhotoTodoOpen(false)} />
          <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm" role="dialog" aria-modal="true" aria-labelledby="edit-photo-title">
            <h2 id="edit-photo-title" className="text-lg font-semibold text-neutral-900 mb-1">Edit Photo</h2>
            <p className="text-sm text-neutral-500 mb-4">Cover photo editing is coming in an upcoming update.</p>
            <button
              type="button"
              onClick={() => setPhotoTodoOpen(false)}
              className="w-full min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10"
            >
              Close
            </button>
          </div>
        </>
      )}
    </>
  );
}
