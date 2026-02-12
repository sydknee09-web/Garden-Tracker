"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function CogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/vault", label: "Vault", icon: "⊞" },
  { href: "/calendar", label: "Calendar", icon: "▣" },
  { href: "/journal", label: "Journal", icon: "◐" },
  { href: "/settings", label: "Settings", icon: "cog" as const },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-black/5 shadow-card"
      style={{
        boxShadow: "0 -10px 30px rgba(0,0,0,0.05)",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-2 rounded-xl transition-colors ${
                isActive ? "text-emerald" : "text-black/50 hover:text-black/80"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              {icon === "cog" ? (
                <span className="mb-0.5" aria-hidden><CogIcon /></span>
              ) : (
                <span className="text-xl leading-none mb-0.5" aria-hidden>
                  {icon}
                </span>
              )}
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
