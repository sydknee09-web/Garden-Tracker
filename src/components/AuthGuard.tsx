"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { useSync } from "@/contexts/SyncContext";
import { useAuth } from "@/contexts/AuthContext";

const AUTH_PATHS = ["/login", "/signup", "/reset-password", "/update-password"];

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/vault")) return "Vault";
  if (pathname.startsWith("/garden")) return "Garden";
  if (pathname.startsWith("/journal")) return "Journal";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/settings")) return "Settings";
  return "";
}

function CloudSyncIcon({ syncing }: { syncing: boolean }) {
  return (
    <span
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full min-w-[44px] min-h-[44px]"
      title={syncing ? "Syncing to cloud…" : "All data saved"}
      aria-label={syncing ? "Syncing to cloud" : "All data saved"}
      style={{ color: syncing ? "#eab308" : "#10b981" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={syncing ? "animate-pulse" : ""}>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
      {syncing && (
        <span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-current opacity-70 animate-spin"
          aria-hidden
        />
      )}
    </span>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));
  const isVault = pathname === "/vault" || pathname?.startsWith("/vault/");
  const { syncing } = useSync();

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthPage) {
      router.replace("/login");
    }
  }, [loading, user, isAuthPage, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-black/60">
        Loading…
      </main>
    );
  }
  if (!user && !isAuthPage) {
    return null;
  }

  return (
    <>
      {!isAuthPage && (
        <header
          className="sticky top-0 z-40 flex items-center justify-between h-11 pl-2 pr-2 bg-paper/90 backdrop-blur border-b border-black/5 gap-2"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <CloudSyncIcon syncing={syncing} />
          <h1 className="flex-1 text-center text-base font-semibold text-black truncate min-w-0">
            {getPageTitle(pathname) || "\u00A0"}
          </h1>
          <Link
            href="/settings"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-black/60 hover:text-black"
            aria-label="Settings"
          >
            <SettingsIcon />
          </Link>
        </header>
      )}
      <main
        className={`min-h-screen ${isVault ? "pt-0" : "pt-2"} ${!isAuthPage ? "pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))]" : ""}`}
      >
        {children}
      </main>
      {!isAuthPage && <BottomNav />}
    </>
  );
}
