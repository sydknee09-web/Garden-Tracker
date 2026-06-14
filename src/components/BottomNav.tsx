"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavItems, isNavItemActive, NAV_ICON_SIZE } from "./navItems";
import { useNavHighlight } from "@/contexts/NavHighlightContext";

export function BottomNav() {
  const pathname = usePathname();
  const { suppressGarden } = useNavHighlight();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-black/5 shadow-card xl:hidden"
      style={{
        boxShadow: "0 -10px 30px rgba(0,0,0,0.05)",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center h-16 max-w-lg mx-auto px-2">
        {primaryNavItems.map(({ href, label, Icon }) => {
          // Archived plantings live at /garden/grow/[id] but aren't in Garden — suppress that tab's
          // highlight when the instance page flags it (Sprint 14 #75).
          const isActive =
            suppressGarden && href === "/garden" ? false : isNavItemActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex flex-1 flex-col items-center justify-center min-h-[44px] py-2 rounded-xl transition-colors ${
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
