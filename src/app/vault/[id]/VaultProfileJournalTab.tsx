"use client";

import { forwardRef } from "react";
import { supabase } from "@/lib/supabase";
import type { JournalEntry } from "@/types/garden";
import { ICON_MAP } from "@/lib/styleDictionary";
import { formatDisplayDate } from "./vaultProfileUtils";

export interface VaultProfileJournalTabProps {
  journalEntries: JournalEntry[];
  entryIdToPhotoPaths: Record<string, string[]>;
  onAddJournal?: () => void;
  canEdit?: boolean;
}

export const VaultProfileJournalTab = forwardRef<HTMLDivElement, VaultProfileJournalTabProps>(
  function VaultProfileJournalTab({ journalEntries, entryIdToPhotoPaths, onAddJournal, canEdit }, ref) {
    return (
      <div ref={ref} className="scroll-mt-4">
        {canEdit && onAddJournal && (
          <div className="flex items-center justify-end mb-3">
            <button
              type="button"
              onClick={onAddJournal}
              className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 text-sm"
              aria-label="Add journal entry"
            >
              <ICON_MAP.Journal className="w-4 h-4" />
              Add journal
            </button>
          </div>
        )}
        {journalEntries.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
            <p className="text-neutral-500 text-sm">No journal entries yet.</p>
            <p className="text-neutral-400 text-xs mt-1 mb-4">Entries appear here as you plant, care for, and harvest this variety.</p>
            {canEdit && onAddJournal && (
              <button
                type="button"
                onClick={onAddJournal}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 text-sm"
                aria-label="Add journal entry"
              >
                <ICON_MAP.Journal className="w-4 h-4" />
                Add journal
              </button>
            )}
          </div>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-emerald-900/30" aria-hidden="true" />
            <div className="space-y-0">
              {journalEntries.map((j) => {
                const paths = entryIdToPhotoPaths[j.id] ?? (j.image_file_path ? [j.image_file_path] : []);
                const photoUrls = paths.map((p) => supabase.storage.from("journal-photos").getPublicUrl(p).data.publicUrl);
                return (
                  <div key={j.id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className="absolute left-3 top-2 w-3 h-3 rounded-full bg-emerald-900 border-2 border-white shadow-sm -translate-x-1/2" aria-hidden="true" />
                    <div className="flex-1 min-w-0 bg-white rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500">{formatDisplayDate(j.created_at)}</span>
                          {j.entry_type && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                j.entry_type === "harvest"
                                  ? "bg-amber-50 text-amber-700"
                                  : j.entry_type === "care"
                                    ? "bg-blue-50 text-blue-700"
                                    : j.entry_type === "pest"
                                      ? "bg-red-50 text-red-700"
                                      : j.entry_type === "death"
                                        ? "bg-red-100 text-red-800"
                                        : j.entry_type === "cold_stratify"
                                          ? "bg-sky-50 text-sky-800"
                                          : "bg-emerald-900/10 text-emerald-900"
                              }`}
                            >
                              {j.entry_type === "vault_add"
                                ? "Added to Vault"
                                : j.entry_type === "prune"
                                  ? "Pruned"
                                  : j.entry_type === "cold_stratify"
                                    ? "Cold stratified"
                                    : j.entry_type}
                            </span>
                          )}
                        </div>
                        {j.weather_snapshot && typeof j.weather_snapshot === "object" && "temp" in j.weather_snapshot && (
                          <span className="text-xs text-neutral-400">{j.weather_snapshot.icon} {Math.round(j.weather_snapshot.temp as number)}°F</span>
                        )}
                      </div>
                      {j.note?.trim() && <p className="text-sm text-neutral-700 whitespace-pre-wrap mb-2">{j.note}</p>}
                      {j.entry_type === "harvest" && (j.harvest_weight != null || j.harvest_quantity != null) && (
                        <p className="text-sm text-emerald-700 font-medium mb-2">
                          Harvested: {j.harvest_weight != null ? `${j.harvest_weight} ${j.harvest_unit || "units"}` : ""}{j.harvest_quantity != null ? `${j.harvest_weight != null ? ", " : ""}${j.harvest_quantity} count` : ""}
                        </p>
                      )}
                      {photoUrls.length > 0 && (
                        <div
                          className={`mt-2 flex gap-2 overflow-x-auto snap-x snap-mandatory ${photoUrls.length === 1 ? "" : "pb-2"}`}
                          style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                        >
                          {photoUrls.map((url, i) => (
                            <div key={i} className={`flex-shrink-0 rounded-lg overflow-hidden bg-neutral-100 snap-center ${photoUrls.length === 1 ? "w-full max-w-xs" : "min-w-[16rem] w-64"}`}>
                              <img src={url} alt="" className="w-full h-auto object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);
