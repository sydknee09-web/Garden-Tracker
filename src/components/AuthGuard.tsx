"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { SettingsIcon, FeedbackIcon } from "./navItems";
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
  PageSkeletonLibrary,
  PageSkeletonVaultDetail,
  PageSkeletonCalendar,
  PageSkeletonGarden,
  PageSkeletonJournal,
  PageSkeletonSchedule,
} from "./PageSkeleton";
import { LoadingScreen } from "./LoadingScreen";

const AUTH_PATHS = ["/login", "/signup", "/reset-password", "/update-password", "/auth/callback"];

function getSkeletonForPath(pathname: string | null) {
  if (!pathname || pathname === "/") return <PageSkeletonHome />;
  // Detail surfaces (plant profile / packet / shed item / growing instance) get the
  // back-chip + hero detail skeleton, not a list-grid skeleton.
  if (
    pathname.startsWith("/library/") ||
    pathname.startsWith("/vault/packets/") ||
    pathname.startsWith("/vault/shed/") ||
    pathname.startsWith("/garden/grow/")
  ) {
    return <PageSkeletonVaultDetail />;
  }
  if (pathname === "/library") return <PageSkeletonLibrary />;
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
  if (pathname === "/library" || pathname.startsWith("/library/")) return "Library";
  if (pathname === "/shopping-list") return "Shopping List";
  if (pathname === "/garden" || pathname.startsWith("/garden/")) return "Garden";
  if (pathname === "/vault/import" || pathname.startsWith("/vault/import/")) return "Import";
  if (pathname === "/vault/review-import") return "Review Import";
  if (pathname.startsWith("/vault/plant")) return "Plant";
  if (pathname.startsWith("/vault/shed/")) return "Shed";
  if (pathname.startsWith("/vault/history")) return "History";
  if (pathname.startsWith("/vault/packets")) return "Packet";
  if (pathname.startsWith("/vault/tags")) return "Tags";
  if (pathname.startsWith("/vault")) return "Vault";
  if (pathname === "/shed/review-import") return "Review Supply Import";
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

const SIDEBAR_COLLAPSED_KEY = "gt:sidebar:collapsed";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));
  // Top rhythm: main owns the 8px gap below the header on every surface (2026-06-12
  // chrome cohesion sweep — replaced the isVault pt-0 special case; page wrappers
  // contribute pt-0 so the rhythm has one source).
  const { syncing } = useSync();
  const isOnline = useOnlineStatus();
  const { isInHousehold, viewMode, setViewMode } = useHousehold();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [minDisplayPending, setMinDisplayPending] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") setSidebarCollapsed(true);
    } catch {
      // localStorage unavailable; ignore
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage unavailable; ignore
      }
      return next;
    });
  }, []);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
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

  // Pages use their own page-level back links (e.g. "← Back"); no header back button
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
        <div className="animate-app-ready-fade-in xl:flex">
          {!isAuthPage && (
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapsed={toggleSidebarCollapsed}
              onOpenFeedback={openFeedback}
            />
          )}
          <div className="xl:flex-1 xl:min-w-0">
            {!isAuthPage && (
              <>
                <header
                  ref={headerRef}
                  className="sticky top-0 z-40 flex items-center justify-between h-11 pl-2 pr-2 bg-paper/90 backdrop-blur border-b border-black/5 gap-2"
                  style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
                >
                  <div className="flex items-center shrink-0 [&>*+*]:-ml-2">
                    <CloudSyncIcon syncing={syncing} offline={!isOnline} />
                    <button
                      type="button"
                      onClick={() => setFeedbackOpen(true)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black rounded-full xl:hidden"
                      aria-label="Send feedback"
                      title="Send Feedback"
                    >
                      <FeedbackIcon />
                    </button>
                  </div>
                  <h1 className="flex-1 text-center text-base font-semibold text-black truncate min-w-0">
                    {getPageTitle(pathname) || " "}
                  </h1>
                  <div className="flex items-center shrink-0 [&>*+*]:-ml-2">
                    {isInHousehold && (
                      <button
                        type="button"
                        onClick={() => setViewMode(viewMode === "personal" ? "family" : "personal")}
                        className="flex items-center justify-center gap-1 rounded-full border border-black/15 bg-white/70 px-3 h-7 text-xs font-medium text-black/70 hover:text-black hover:border-black/30 transition-colors whitespace-nowrap"
                        aria-label={`Switch to ${viewMode === "personal" ? "family" : "personal"} view`}
                      >
                        {viewMode === "family" ? "Family" : "Personal"}
                      </button>
                    )}
                    <Link
                      href="/shopping-list?from=home"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black xl:hidden"
                      aria-label="Shopping list"
                    >
                      <ICON_MAP.ShoppingList stroke="currentColor" className="w-5 h-5" />
                    </Link>
                    <Link
                      href="/settings"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black xl:hidden"
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
              className={`w-full min-w-0 min-h-screen pt-2 ${!isAuthPage ? "pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))] xl:pb-2" : ""}`}
            >
              {getSkeletonForPath(pathname)}
            </main>
          </div>
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
    <div className="animate-app-ready-fade-in xl:flex">
      {!isAuthPage && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
          onOpenFeedback={openFeedback}
        />
      )}
      <div className="xl:flex-1 xl:min-w-0">
        {!isAuthPage && (
          <>
            <header
              ref={headerRef}
              className="sticky top-0 z-40 flex items-center justify-between h-11 pl-2 pr-2 bg-paper/90 backdrop-blur border-b border-black/5 gap-2"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            >
              <div className="flex items-center shrink-0 [&>*+*]:-ml-2">
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
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black rounded-full xl:hidden"
                  aria-label="Send feedback"
                  title="Send Feedback"
                >
                  <FeedbackIcon />
                </button>
              </div>
              <h1 className="flex-1 text-center text-base font-semibold text-black truncate min-w-0">
                {getPageTitle(pathname) || " "}
              </h1>
              <div className="flex items-center shrink-0 [&>*+*]:-ml-2">
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
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black xl:hidden"
                  aria-label="Shopping list"
                >
                  <ICON_MAP.ShoppingList stroke="currentColor" className="w-5 h-5" />
                </Link>
                <Link
                  href="/settings"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-black/60 hover:text-black xl:hidden"
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
          className={`w-full min-w-0 min-h-screen pt-2 ${!isAuthPage ? "pb-[max(7rem,calc(5rem+env(safe-area-inset-bottom,0px)))] xl:pb-2" : ""}`}
        >
          {children}
        </main>
      </div>
      {!isAuthPage && <BottomNav />}
    </div>
  );
}
