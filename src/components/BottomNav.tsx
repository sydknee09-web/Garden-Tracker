"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON_SIZE = 24;
const iconProps = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function VaultIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function JournalIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <path d="M6 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2l-2 2-2-2H8a2 2 0 0 0-2 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  );
}

const navItems: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/vault", label: "Vault", Icon: VaultIcon },
  { href: "/garden?tab=active", label: "Garden", Icon: LeafIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/journal", label: "Journal", Icon: JournalIcon },
];

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
          const { href, label, Icon } = item;
          const pathForMatch = href.includes("?") ? href.split("?")[0] : href;
          const isActive = pathname === pathForMatch || (pathForMatch !== "/" && pathname.startsWith(pathForMatch + "/"));
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
                <Icon />
              </span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
