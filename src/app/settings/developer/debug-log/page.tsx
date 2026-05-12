"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  clearEntries,
  formatEntriesForCopy,
  getEntries,
  type DebugLogEntry,
} from "@/lib/debugLogBuffer";

export default function DebugLogPage() {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const refresh = useCallback(() => {
    setEntries(getEntries());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCopy = useCallback(async () => {
    const text = formatEntriesForCopy(entries);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1500);
      } else {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 1500);
      }
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1500);
    }
  }, [entries]);

  const handleClear = useCallback(() => {
    clearEntries();
    refresh();
  }, [refresh]);

  const formatted = formatEntriesForCopy(entries);

  return (
    <div className="w-full min-w-0 px-6 pt-2 pb-24 box-border">
      <div className="mb-4">
        <Link href="/settings/developer" className="text-sm text-emerald-700 hover:underline">
          &larr; Back to Developer
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Debug Log</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Last {entries.length === 1 ? "1 entry" : `${entries.length} entries`} of console output captured this session.
        Use <strong>Copy all</strong> to paste into a debug conversation.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={handleCopy}
          disabled={entries.length === 0}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Copy all debug log entries to clipboard"
        >
          {copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={refresh}
          className="min-h-[44px] px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          aria-label="Refresh debug log from storage"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={entries.length === 0}
          className="min-h-[44px] px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Clear all debug log entries"
        >
          Clear
        </button>
      </div>

      <textarea
        readOnly
        value={formatted}
        className="w-full min-h-[60vh] rounded-xl border border-neutral-200 bg-white p-3 text-xs font-mono text-neutral-800 whitespace-pre-wrap"
        aria-label="Debug log entries"
        placeholder="No entries captured yet. Trigger the bug, then come back to this page."
      />
    </div>
  );
}
