"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON_SIZE = 24;

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/vault", label: "Vault", icon: "⊞" },
  { href: "/garden", label: "Garden", iconNode: true },
  { href: "/calendar", label: "Calendar", icon: "▣" },
  { href: "/journal", label: "Journal", icon: "◐" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-black/5 shadow-card"
      style={{
        boxShadow: "0 -10px 30px rgba(0,0,0,0.05)",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const { href, label } = item;
          const iconNode = "iconNode" in item && item.iconNode;
          const icon = "icon" in item ? item.icon : null;
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
              <span
                className="flex items-center justify-center mb-0.5 flex-shrink-0"
                style={{ width: ICON_SIZE, height: ICON_SIZE }}
                aria-hidden
              >
                {iconNode && href === "/garden" ? (
                  <LeafIcon />
                ) : (
                  <span className="leading-none flex items-center justify-center" style={{ fontSize: ICON_SIZE }}>
                    {icon}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
