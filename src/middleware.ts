import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Back-compat 308 redirects for the Library URL rebrand (Syd lock 2026-06-13):
 *   - /plants            → /library            (Library landing — old Ship-A route)
 *   - /plants/*          → /library/*
 *   - /vault/<profileId> → /library/<profileId> (plant profile — old detail route)
 *
 * The Vault tab keeps Packets/Shed and its sub-routes, so /vault/<seg> is only
 * redirected when <seg> is NOT one of the known Vault sub-routes. Bare /vault (the
 * Vault landing, with or without a query string) is never redirected.
 *
 * Defined locally (not imported from navItems) so this stays edge-runtime safe —
 * navItems exports React SVG components that can't be pulled into middleware.
 * 308 (permanent, method-preserving) keeps bookmarks + deep links working forever.
 */
const VAULT_NON_PROFILE_SEGMENTS = new Set([
  "import",
  "review-import",
  "plant",
  "shed",
  "history",
  "packets",
  "tags",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /plants and /plants/* → /library(/*) — preserve query string.
  if (pathname === "/plants" || pathname.startsWith("/plants/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/library" + pathname.slice("/plants".length);
    return NextResponse.redirect(url, 308);
  }

  // /vault/<seg> → /library/<seg>, but only for plant-profile segments
  // (skip Vault sub-routes: packets, shed, import, history, tags, etc.).
  if (pathname.startsWith("/vault/")) {
    const rest = pathname.slice("/vault/".length);
    const seg = rest.split("/")[0];
    if (seg && !VAULT_NON_PROFILE_SEGMENTS.has(seg)) {
      const url = req.nextUrl.clone();
      url.pathname = "/library/" + rest;
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Only run on the paths we might redirect. Bare /vault is intentionally excluded.
  matcher: ["/plants", "/plants/:path*", "/vault/:path*"],
};
