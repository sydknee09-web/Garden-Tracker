"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type ScrapeStatus = "Success" | "Partial" | "Failed" | "AI_SEARCH";

type AuditRow = {
  id: string;
  name: string | null;
  variety_name: string | null;
  vendor: string | null;
  source_url: string | null;
  scrape_status: ScrapeStatus | string | null;
  scrape_error_log: string | null;
};

export default function ScraperAuditPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("plant_varieties")
        .select("id, name, variety_name, vendor, source_url, scrape_status, scrape_error_log")
        .eq("user_id", user.id)
        .not("scrape_status", "is", null)
        .order("name", { ascending: true })
        .order("variety_name", { ascending: true, nullsFirst: false });

      if (cancelled) return;
      if (e) {
        setError(e.message);
        setRows([]);
      } else {
        setRows((data ?? []) as AuditRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return (
      <div className="min-h-screen p-6 text-center">
        <p className="text-neutral-600">Sign in to view the scraper audit.</p>
        <Link href="/login" className="mt-4 inline-block text-blue-600 underline">
          Go to login
        </Link>
      </div>
    );
  }

  const statusStyle = (status: string | null) => {
    if (status === "Success") return "bg-green-100 text-green-800";
    if (status === "Failed") return "bg-red-100 text-red-800";
    if (status === "AI_SEARCH") return "bg-blue-100 text-blue-800";
    return "bg-amber-100 text-amber-800";
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-semibold">Scraper Audit</h1>
        <p className="mb-4 text-neutral-600">
          Seeds that have used &quot;Load Seed Details&quot;. Success = Big 4 found; Partial = used defaults; AI_SEARCH = fallback search filled gaps; Failed = error or timeout.
        </p>
        {error && (
          <p className="mb-4 text-red-600" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-500">No scraped seeds yet. Use &quot;Load Seed Details&quot; on a vault entry with a source URL.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Variety</th>
                  <th className="p-3 font-medium">Vendor</th>
                  <th className="p-3 font-medium">Source URL</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Error log</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="p-3">{r.name ?? "—"}</td>
                    <td className="p-3">{r.variety_name ?? "—"}</td>
                    <td className="p-3">{r.vendor ?? "—"}</td>
                    <td className="p-3 max-w-xs truncate" title={r.source_url ?? undefined}>
                      {r.source_url ? (
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                          {r.source_url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded px-2 py-0.5 font-medium ${statusStyle(r.scrape_status)}`}>
                        {r.scrape_status ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-md p-3 text-neutral-600">
                      {r.scrape_error_log ? (
                        <span className="block truncate" title={r.scrape_error_log}>
                          {r.scrape_error_log}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6">
          <Link href="/vault" className="text-blue-600 underline">
            Back to Vault
          </Link>
        </div>
      </div>
    </div>
  );
}
