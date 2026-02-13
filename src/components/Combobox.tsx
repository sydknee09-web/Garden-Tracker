"use client";

import { useState, useRef } from "react";

/** Typeable combobox: type freely, optional dropdown suggestions. Selecting is optional; custom text allowed. */
export function Combobox({
  value,
  onChange,
  suggestions,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
  "aria-label": string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const q = (value ?? "").trim().toLowerCase();
  const filtered =
    q.length === 0
      ? suggestions.slice(0, 15)
      : suggestions.filter((s) => (s ?? "").toLowerCase().includes(q)).slice(0, 15);
  const showList = open && filtered.length > 0;
  const safeHighlight = Math.min(highlight, Math.max(0, filtered.length - 1));

  const select = (s: string) => {
    onChange(s);
    setOpen(false);
    setHighlight(0);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 0)}
        onKeyDown={(e) => {
          // Always allow Space to be typed in the input (don't let listbox semantics or parents capture it)
          if (e.key === " ") {
            e.stopPropagation();
            return;
          }
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = safeHighlight < filtered.length - 1 ? safeHighlight + 1 : 0;
            setHighlight(next);
            requestAnimationFrame(() => listRef.current?.children[next]?.scrollIntoView({ block: "nearest" }));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = safeHighlight > 0 ? safeHighlight - 1 : filtered.length - 1;
            setHighlight(next);
            requestAnimationFrame(() => listRef.current?.children[next]?.scrollIntoView({ block: "nearest" }));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[safeHighlight] != null) select(filtered[safeHighlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={className}
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-list` : undefined}
      />
      {showList && (
        <ul
          ref={listRef}
          id={id ? `${id}-list` : undefined}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-48 overflow-auto rounded-lg border border-black/15 bg-white py-1 shadow-lg"
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === safeHighlight}
              className={`cursor-pointer px-3 py-2 text-sm ${i === safeHighlight ? "bg-emerald-50 text-emerald-900" : "text-black/90 hover:bg-black/5"}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
