"use client";

import { createContext, useContext, useState, useCallback } from "react";

/**
 * NavHighlightContext (Sprint 14 #75) — lets a page override the bottom-nav highlight.
 *
 * The bottom nav highlights by pathname prefix (navItems.isNavItemActive), which can't see a
 * planting's status: archived + active plantings share the `/garden/grow/[id]` route, so an
 * archived planting (which isn't in Garden) still lit the Garden tab. The instance page sets
 * `suppressGarden` when the loaded instance is archived; BottomNav reads it to drop the Garden
 * highlight. Suppression is reset while loading + on unmount so it never bleeds to other pages.
 *
 * Scope is intentionally tiny (one boolean) — the nav has no other status-dependent highlight need.
 */
interface NavHighlightValue {
  suppressGarden: boolean;
  setSuppressGarden: (v: boolean) => void;
}

const NavHighlightContext = createContext<NavHighlightValue>({
  suppressGarden: false,
  setSuppressGarden: () => {},
});

export function NavHighlightProvider({ children }: { children: React.ReactNode }) {
  const [suppressGarden, setSuppressGardenState] = useState(false);
  const setSuppressGarden = useCallback((v: boolean) => setSuppressGardenState(v), []);
  return (
    <NavHighlightContext.Provider value={{ suppressGarden, setSuppressGarden }}>
      {children}
    </NavHighlightContext.Provider>
  );
}

export function useNavHighlight(): NavHighlightValue {
  return useContext(NavHighlightContext);
}
