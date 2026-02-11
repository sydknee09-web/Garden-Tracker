"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { useSync } from "@/contexts/SyncContext";

const AUTH_PATHS = ["/login", "/signup", "/reset-password", "/update-password"];

function CloudSyncIcon({ syncing }: { syncing: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full"
      title={syncing ? "Syncing to cloud…" : "All data saved"}
      aria-label={syncing ? "Syncing to cloud" : "All data saved"}
      style={{ color: syncing ? "#eab308" : "#10b981" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    </span>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));
  const isVault = pathname === "/vault" || pathname?.startsWith("/vault/");
  const { syncing } = useSync();

  return (
    <>
      {!isAuthPage && (
        <header className="sticky top-0 z-40 flex justify-end items-center h-12 px-4 bg-white/80 backdrop-blur border-b border-black/5">
          <CloudSyncIcon syncing={syncing} />
        </header>
      )}
      <main
        className={`min-h-screen ${isVault ? "pt-0" : "pt-6"} ${!isAuthPage ? "pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))]" : ""}`}
      >
        {children}
      </main>
      {!isAuthPage && <BottomNav />}
    </>
  );
}
