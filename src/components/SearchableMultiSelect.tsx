"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type SearchableMultiSelectOption = { id: string; label: string };

export interface SearchableMultiSelectProps {
  options: SearchableMultiSelectOption[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  placeholder?: string;
  label: string;
  /** For initial selection when opened from context. */
  preSelectedIds?: string[];
  id?: string;
  /** Optional: when used inside a modal, pass higher z-index so dropdown sits above modal. */
  dropdownZIndex?: number;
  /** Optional: when search has no results, show this action (e.g. "+ Add New Supply"). */
  emptyStateAction?: { label: string; onClick: () => void };
}

export function SearchableMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "Type to search…",
  label,
  preSelectedIds,
  id: propId,
  dropdownZIndex = 110,
  emptyStateAction,
}: SearchableMultiSelectProps) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = options.filter(
    (o) =>
      !filter.trim() ||
      (o.label?.toLowerCase().includes(filter.toLowerCase().trim()) ?? false)
  );

  const genId = propId ?? `sms-${label.replace(/\s/g, "-").toLowerCase()}`;

  useEffect(() => {
    if (preSelectedIds?.length && selectedIds.size === 0) {
      const next = new Set(selectedIds);
      for (const pid of preSelectedIds) {
        if (options.some((o) => o.id === pid)) next.add(pid);
      }
      if (next.size > 0) onChange(next);
    }
  }, [preSelectedIds, options, selectedIds.size, onChange]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filter]);

  const handleBlur = useCallback(() => {
    setTimeout(() => setOpen(false), 150);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
        setOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
        return;
      }
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(highlightIndex + 1, filtered.length - 1);
        setHighlightIndex(next);
        listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[highlightIndex]) {
        e.preventDefault();
        const opt = filtered[highlightIndex]!;
        const next = new Set(selectedIds);
        if (next.has(opt.id)) next.delete(opt.id);
        else next.add(opt.id);
        onChange(next);
        return;
      }
    },
    [open, filtered, highlightIndex, selectedIds, onChange]
  );

  const toggle = useCallback(
    (opt: SearchableMultiSelectOption) => {
      const next = new Set(selectedIds);
      if (next.has(opt.id)) next.delete(opt.id);
      else next.add(opt.id);
      onChange(next);
    },
    [selectedIds, onChange]
  );

  const remove = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      next.delete(id);
      onChange(next);
    },
    [selectedIds, onChange]
  );

  const selected = options.filter((o) => selectedIds.has(o.id));

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={genId} className="block text-sm font-medium text-black/80 mb-1">
        {label}
      </label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm text-white bg-[#064e3b]"
            >
              {o.label}
              <button
                type="button"
                onClick={() => remove(o.id)}
                className="min-w-[24px] min-h-[24px] flex items-center justify-center rounded-full hover:bg-white/20 text-white font-bold text-sm leading-none"
                aria-label={`Remove ${o.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        id={genId}
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm min-h-[44px] bg-white"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${genId}-listbox`}
        role="combobox"
      />
      {open && (
        <ul
          ref={listRef}
          id={`${genId}-listbox`}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 mt-1 max-h-[200px] overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg z-[110]"
          style={{ zIndex: dropdownZIndex }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3" role="option">
              <p className="text-sm text-neutral-500 mb-2">No results found</p>
              {emptyStateAction && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    emptyStateAction.onClick();
                  }}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  {emptyStateAction.label}
                </button>
              )}
            </li>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = selectedIds.has(opt.id);
              const isHighlighted = i === highlightIndex;
              return (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer min-h-[44px] ${
                    isHighlighted ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                  onClick={() => toggle(opt)}
                >
                  <span
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-[#064e3b] border-[#064e3b] text-white" : "border-black/20"
                    }`}
                  >
                    {isSelected && "✓"}
                  </span>
                  <span className="text-sm text-black truncate">{opt.label}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
