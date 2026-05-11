"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavItems, isNavItemActive, NAV_ICON_SIZE } from "./navItems";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-black/5 shadow-card xl:hidden"
      style={{
        boxShadow: "0 -10px 30px rgba(0,0,0,0.05)",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {primaryNavItems.map(({ href, label, Icon }) => {
          const isActive = isNavItemActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-2 rounded-xl transition-colors ${
                isActive ? "text-emerald" : "text-black/50 hover:text-black/80"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <span
                className="flex items-center justify-center mb-0.5 flex-shrink-0"
                style={{ width: NAV_ICON_SIZE, height: NAV_ICON_SIZE }}
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
