"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type ImportLogEntry = {
  id: string;
  created_at: string;
  url: string;
  vendor_name: string | null;
  status_code: number | null;
  identity_key_generated: string | null;
  error_message: string | null;
  hero_image_url: string | null;
};

export default function ImportLogsPage() {
  const { user } = useAuth();
  const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingLogs, setClearingLogs] = useState(false);

  const loadImportLogs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      if (!token) {
        setImportLogs([]);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/settings/import-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setImportLogs([]);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as { logs?: ImportLogEntry[] };
      setImportLogs((json.logs ?? []) as ImportLogEntry[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadImportLogs();
  }, [loadImportLogs]);

  const clearImportLogs = useCallback(async () => {
    if (!user?.id || clearingLogs) return;
    setClearingLogs(true);
    await supabase.from("seed_import_logs").delete().eq("user_id", user.id);
    setImportLogs([]);
    setClearingLogs(false);
  }, [user?.id, clearingLogs]);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
      >
        ← Back to Settings
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Import Logs</h1>
      <p className="text-sm text-neutral-600 mb-4">
        History of link imports and hero photo searches for troubleshooting vendor blocks, 404s, and selector issues. Status is the HTTP code (e.g. 200, 403). Error / Query shows the Pass trace and search query (multi-line). Entries with a stored hero image show a <span className="inline-flex items-center rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium px-1.5 py-0.5">Vault</span> badge (used for Phase 0 cache).
      </p>

      <div className="mb-4 p-4 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700">
        <p className="font-medium text-neutral-800 mb-2">Status code legend</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>403</strong> — Vendor blocking</li>
          <li><strong>404</strong> — URL typo or dead link</li>
          <li><strong>200</strong> — Page OK (if data is missing, check selectors)</li>
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-neutral-600">
          {loading ? "Loading…" : `${importLogs.length} entr${importLogs.length === 1 ? "y" : "ies"} (last 500)`}
        </p>
        <button
          type="button"
          onClick={clearImportLogs}
          disabled={clearingLogs || importLogs.length === 0}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearingLogs ? "Clearing…" : "Clear Logs"}
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500 text-sm">Loading…</p>
      ) : importLogs.length === 0 ? (
        <p className="text-neutral-500 text-sm">No import logs yet. Run a link import from the Vault to see entries here.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm border-collapse" aria-label="Import log history">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Time</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600 max-w-[200px]">URL</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Vendor</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600 w-20">Status</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600 min-w-[100px]">Identity key</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Error / Query</th>
              </tr>
            </thead>
            <tbody>
              {importLogs.map((row) => {
                const status = row.status_code;
                const isSuccess = status === 200;
                const isError = status === 403 || status === 404 || status === 0;
                const showVaultBadge = isSuccess && row.hero_image_url?.trim().startsWith("http");
                return (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 px-3 text-neutral-600 whitespace-nowrap align-top">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 max-w-[200px] truncate align-top" title={row.url}>
                      {row.url}
                    </td>
                    <td className="py-2 px-3 text-neutral-700 align-top">{row.vendor_name ?? "—"}</td>
                    <td className="py-2 px-3 align-top">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono ${
                            isSuccess ? "text-emerald-600" : isError ? "text-red-600" : "text-neutral-700"
                          }`}
                        >
                          {status ?? "—"}
                        </span>
                        {showVaultBadge && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium px-1.5 py-0.5"
                            title="Phase 0 success — hero image stored in vault"
                          >
                            🏛️ Vault
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-neutral-600 truncate max-w-[120px] align-top" title={row.identity_key_generated ?? ""}>
                      {row.identity_key_generated ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-neutral-700 max-w-[280px] align-top">
                      <span className="break-words block text-left" style={{ whiteSpace: "pre-wrap" }} title={row.error_message || "No Trace Recorded - Check API logs"}>
                        {row.error_message || "No Trace Recorded - Check API logs"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
