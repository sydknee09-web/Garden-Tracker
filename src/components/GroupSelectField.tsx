"use client";

import type { Group } from "@/types/garden";

/**
 * GroupSelectField — the single canonical "Group" picker for planting-creation
 * forms (Door 1 of the three assignment doors; ONE group per plant, locked
 * 2026-06-09). Extracted after the 2026-06-09 dogfood gap where the field
 * shipped on AddPlantModal but was missing on the sibling planting forms
 * (PlantingForm + VaultPageContent Confirm Planting) — one component, no drift.
 *
 * Presentational only: parent owns all state (fetch, selection, query, create).
 * Selected state renders the emerald chip with × removal; unselected renders
 * the search input + match chips + dashed inline-create button.
 *
 * `compact` switches to the denser register used inside the vault planting
 * surfaces (text-xs label + rounded-lg input) vs the AddPlantModal default
 * (text-sm label + rounded-3xl input).
 */
export function GroupSelectField({
  idPrefix,
  availableGroups,
  selectedGroupId,
  onSelectGroup,
  query,
  onQueryChange,
  creatingGroup,
  onCreateInline,
  compact = false,
}: {
  /** Unique per mount; becomes the input id `${idPrefix}-group`. */
  idPrefix: string;
  availableGroups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  query: string;
  onQueryChange: (next: string) => void;
  creatingGroup: boolean;
  onCreateInline: () => void;
  compact?: boolean;
}) {
  const labelClass = compact
    ? "block text-xs font-medium text-black/60 mb-1"
    : "block text-sm font-medium text-neutral-700 mb-1";
  const inputClass = compact
    ? "w-full min-h-[44px] rounded-lg border border-black/10 px-4 py-3 text-sm text-black"
    : "w-full px-3 py-2 rounded-3xl border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500";
  const helperClass = compact
    ? "mt-1 text-xs text-black/50"
    : "mt-1 text-xs text-neutral-500";
  const selected = selectedGroupId
    ? availableGroups.find((g) => g.id === selectedGroupId) ?? null
    : null;

  return (
    <div>
      <label htmlFor={`${idPrefix}-group`} className={labelClass}>
        Group
      </label>
      {selected ? (
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium">
            {selected.name}
            <button
              type="button"
              onClick={() => onSelectGroup(null)}
              className="text-emerald-700 hover:text-emerald-900 leading-none"
              aria-label={`Remove ${selected.name}`}
            >
              ×
            </button>
          </span>
        </div>
      ) : (
        <>
          <input
            id={`${idPrefix}-group`}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search or add a group"
            className={inputClass}
            aria-label="Search groups"
          />
          {(() => {
            const q = query.trim().toLowerCase();
            const matches = q
              ? availableGroups.filter((g) => g.name.toLowerCase().includes(q))
              : availableGroups;
            const exactMatch = availableGroups.some(
              (g) => g.name.toLowerCase() === q
            );
            const showCreate = q.length > 0 && !exactMatch;
            if (matches.length === 0 && !showCreate) return null;
            return (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {matches.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onSelectGroup(g.id);
                      onQueryChange("");
                    }}
                    className="inline-flex items-center px-2 py-1 rounded-full border border-neutral-300 text-neutral-700 text-xs hover:bg-neutral-50"
                  >
                    + {g.name}
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    onClick={onCreateInline}
                    disabled={creatingGroup}
                    className="inline-flex items-center px-2 py-1 rounded-full border border-dashed border-emerald-400 text-emerald-700 text-xs hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {creatingGroup ? "Creating…" : `+ Create "${query.trim()}"`}
                  </button>
                )}
              </div>
            );
          })()}
        </>
      )}
      <p className={helperClass}>
        Optional — organize this plant into one Garden group.
      </p>
    </div>
  );
}
