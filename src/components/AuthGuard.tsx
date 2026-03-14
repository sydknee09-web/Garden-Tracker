"use client";

import { useEffect, useState, useRef } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { FeedbackModal } from "./FeedbackModal";
import { useSync } from "@/contexts/SyncContext";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  shouldClearFiltersOnMount,
  getNavSection,
  setLastNavSection,
  clearVaultFilters,
  clearGardenFilters,
  clearJournalFilters,
} from "@/lib/navSectionClear";
import {
  PageSkeletonHome,
  PageSkeletonVault,
  PageSkeletonCalendar,
  PageSkeletonGarden,
  PageSkeletonJournal,
  PageSkeletonSchedule,
} from "./PageSkeleton";
import { LoadingScreen } from "./LoadingScreen";

const AUTH_PATHS = ["/login", "/signup", "/reset-password", "/update-password", "/auth/callback"];

function getSkeletonForPath(pathname: string | null) {
  if (!pathname || pathname === "/") return <PageSkeletonHome />;
  if (pathname === "/vault" || pathname.startsWith("/vault/")) return <PageSkeletonVault />;
  if (pathname === "/calendar") return <PageSkeletonCalendar />;
  if (pathname === "/garden" || pathname.startsWith("/garden/")) return <PageSkeletonGarden />;
  if (pathname.startsWith("/journal")) return <PageSkeletonJournal />;
  if (pathname.startsWith("/schedule")) return <PageSkeletonSchedule />;
  return <PageSkeletonHome />;
}

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname === "/") return "Home";
  if (pathname === "/shopping-list") return "Shopping List";
  if (pathname === "/garden" || pathname.startsWith("/garden/")) return "Garden";
  if (pathname === "/vault/import" || pathname.startsWith("/vault/import/")) return "Import";
  if (pathname === "/vault/review-import") return "Review import";
  if (pathname.startsWith("/vault/plant")) return "Plant";
  if (pathname.startsWith("/vault/shed/")) return "Shed";
  if (pathname.startsWith("/vault/history")) return "History";
  if (pathname.startsWith("/vault/packets")) return "Packets";
  if (pathname.startsWith("/vault/tags")) return "Tags";
  if (pathname.startsWith("/vault")) return "Vault";
  if (pathname === "/shed/review-import") return "Review supply import";
  if (pathname.startsWith("/shed")) return "Shed";
  if (pathname.startsWith("/journal")) return "Journal";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/schedule")) return "Planting Schedule";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/chat")) return "Chat";
  if (pathname.startsWith("/help")) return "Help";
  return "";
}

function CloudSyncIcon({ syncing, offline }: { syncing: boolean; offline: boolean }) {
  const color = offline ? "#9ca3af" : syncing ? "#eab308" : "#10b981";
  return (
    <span
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full min-w-[44px] min-h-[44px]"
      title={offline ? "Offline" : syncing ? "Syncing to cloud…" : "All data saved"}
      aria-label={offline ? "Offline" : syncing ? "Syncing to cloud" : "All data saved"}
      style={{ color }}
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

function FeedbackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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
  const isOnline = useOnlineStatus();
  const { isInHousehold, viewMode, setViewMode } = useHousehold();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [minDisplayPending, setMinDisplayPending] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const hasCompletedInitialLoadRef = useRef(false);

  // Keep initial placeholder until auth is ready; no artificial minimum duration
  useEffect(() => {
    if (loading) {
      setMinDisplayPending(false);
    } else {
      setMinDisplayPending(true);
      const t = setTimeout(() => {
        setMinDisplayPending(false);
        hasCompletedInitialLoadRef.current = true;
      }, 0);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Pages use their own page-level back links (e.g. "← Back to Vault"); no header back button
  const showHeaderBackButton = false;

  // Clear filters when navigating between sections (runs before children render so useSessionStorage reads cleared values)
  if (pathname && typeof window !== "undefined") {
    if (shouldClearFiltersOnMount(pathname)) {
      const section = getNavSection(pathname);
      if (section === "vault") clearVaultFilters();
      else if (section === "garden") clearGardenFilters();
      else if (section === "journal") clearJournalFilters();
    }
    setLastNavSection(getNavSection(pathname));
  }

  useEffect(() => {
    [headerRef.current, mainRef.current].forEach((el) => {
      if (el) (el as HTMLElement & { inert?: boolean }).inert = feedbackOpen;
    });
  }, [feedbackOpen]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthPage) {
      router.replace("/login");
    }
  }, [loading, user, isAuthPage, router]);

  const showLoadingScreen = loading || minDisplayPending;
  if (showLoadingScreen) {
    // Initial load: show placeholder that matches system splash (no teal, no icon)
    if (hasCompletedInitialLoadRef.current) {
      return (
        <div className="animate-app-ready-fade-in">
          {!isAuthPage && (
            <>
              <header
                ref={headerRef}
                className="sticky top-0 z-40 flex items-center justify-between h-11 pl-2 pr-2 bg-paper/90 backdrop-blur border-b border-black/5 gap-2"
                style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
              >
                <div className="flex items-center gap-1 shrink-0">
                  <CloudSyncIcon syncing={syncing} offline={!isOnline} />
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(true)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black rounded-full"
                    aria-label="Send feedback"
                    title="Send feedback"
                  >
                    <FeedbackIcon />
                  </button>
                </div>
                <h1 className="flex-1 text-center text-base font-semibold text-black truncate min-w-0">
                  {getPageTitle(pathname) || "\u00A0"}
                </h1>
                <div className="flex items-center shrink-0 gap-1">
                  {isInHousehold && (
                    <button
                      type="button"
                      onClick={() => setViewMode(viewMode === "personal" ? "family" : "personal")}
                      className="flex items-center justify-center gap-1 w-[76px] rounded-full border border-black/15 bg-white/70 px-3 h-7 text-xs font-medium text-black/70 hover:text-black hover:border-black/30 transition-colors"
                      aria-label={`Switch to ${viewMode === "personal" ? "family" : "personal"} view`}
                    >
                      {viewMode === "family" ? "Family" : "Personal"}
                    </button>
                  )}
                  <Link
                    href="/shopping-list?from=home"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black"
                    aria-label="Shopping list"
                  >
                    <ICON_MAP.ShoppingList stroke="currentColor" className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/help"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black"
                    aria-label="Help"
                    title="Where do I…?"
                  >
                    <span className="text-lg font-medium">?</span>
                  </Link>
                  <Link
                    href="/settings"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black"
                    aria-label="Settings"
                  >
                    <SettingsIcon />
                  </Link>
                </div>
              </header>
              <FeedbackModal
                open={feedbackOpen}
                onClose={() => setFeedbackOpen(false)}
                pageUrl={pathname ?? ""}
              />
            </>
          )}
          <main
            ref={mainRef}
            className={`w-full min-w-0 min-h-screen ${isVault ? "pt-0" : "pt-2"} ${!isAuthPage ? "pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))]" : ""}`}
          >
            {getSkeletonForPath(pathname)}
          </main>
          {!isAuthPage && <BottomNav />}
        </div>
      );
    }
    return <LoadingScreen />;
  }
  hasCompletedInitialLoadRef.current = true;
  if (!user && !isAuthPage) {
    return null;
  }

  return (
    <div className="animate-app-ready-fade-in">
      {!isAuthPage && (
        <>
          <header
            ref={headerRef}
            className="sticky top-0 z-40 flex items-center justify-between h-11 pl-2 pr-2 bg-paper/90 backdrop-blur border-b border-black/5 gap-2"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="flex items-center gap-1 shrink-0">
              {showHeaderBackButton ? (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black rounded-full"
                  aria-label="Back"
                >
                  <ICON_MAP.ChevronLeft stroke="currentColor" className="w-5 h-5" />
                </button>
              ) : null}
              <CloudSyncIcon syncing={syncing} offline={!isOnline} />
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black rounded-full"
                aria-label="Send feedback"
                title="Send feedback"
              >
                <FeedbackIcon />
              </button>
            </div>
            <h1 className="flex-1 text-center text-base font-semibold text-black truncate min-w-0">
              {getPageTitle(pathname) || "\u00A0"}
            </h1>
            <div className="flex items-center shrink-0 gap-1">
              {isInHousehold && (
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "personal" ? "family" : "personal")}
                  className="flex items-center justify-center gap-1 w-[76px] rounded-full border border-black/15 bg-white/70 px-3 h-7 text-xs font-medium text-black/70 hover:text-black hover:border-black/30 transition-colors"
                  aria-label={`Switch to ${viewMode === "personal" ? "family" : "personal"} view`}
                >
                  {viewMode === "family" ? "Family" : "Personal"}
                </button>
              )}
              <Link
                href="/shopping-list?from=home"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black"
                aria-label="Shopping list"
              >
                <ICON_MAP.ShoppingList stroke="currentColor" className="w-5 h-5" />
              </Link>
              <Link
                href="/help"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black"
                aria-label="Help"
                title="Where do I…?"
              >
                <span className="text-lg font-medium">?</span>
              </Link>
              <Link
                href="/settings"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black"
                aria-label="Settings"
              >
                <SettingsIcon />
              </Link>
            </div>
          </header>
          <FeedbackModal
            open={feedbackOpen}
            onClose={() => setFeedbackOpen(false)}
            pageUrl={pathname ?? ""}
          />
        </>
      )}
      <main
        ref={mainRef}
        className={`w-full min-w-0 min-h-screen ${isVault ? "pt-0" : "pt-2"} ${!isAuthPage ? "pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))]" : ""}`}
      >
        {children}
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  );
}
