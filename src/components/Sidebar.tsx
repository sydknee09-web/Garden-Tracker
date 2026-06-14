"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ICON_MAP } from "@/lib/styleDictionary";
import {
  primaryNavItems,
  isNavItemActive,
  SettingsIcon,
  FeedbackIcon,
} from "./navItems";

export const COLLAPSED_WIDTH = 64;
export const EXPANDED_WIDTH = 240;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenFeedback: () => void;
}

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed, onOpenFeedback }: SidebarProps) {
  const pathname = usePathname();
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  const itemBase =
    "relative flex items-center h-11 rounded-lg transition-colors text-sm font-medium";
  const itemLayout = collapsed ? "justify-center px-2" : "gap-3 px-3";
  const itemIdle =
    "text-black/60 hover:bg-black/[0.03] hover:text-black/80";
  const itemActive = "bg-emerald-50 text-emerald-700";

  return (
    <aside
      className="hidden xl:flex flex-col sticky top-0 h-screen bg-paper border-r border-black/5 transition-[width] duration-200 z-30 flex-shrink-0"
      style={{ width }}
      aria-label="Main navigation"
    >
      <div className="flex items-center h-12 px-3 border-b border-black/5">
        {!collapsed && (
          <span className="flex-1 text-sm font-semibold text-emerald-700 truncate select-none">
            Garden Tracker
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`min-w-[36px] min-h-[36px] flex items-center justify-center text-black/50 hover:text-black/80 rounded-lg transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto" aria-label="Primary">
        {primaryNavItems.map(({ href, label, Icon }) => {
          const isActive = isNavItemActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`${itemBase} ${itemLayout} ${isActive ? itemActive : itemIdle}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald"
                  aria-hidden
                />
              )}
              <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                <Icon />
              </span>
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-black/5 px-2 py-3 flex flex-col gap-1">
        <Link
          href="/shopping-list?from=home"
          prefetch={false}
          className={`${itemBase} ${itemLayout} ${itemIdle}`}
          aria-label="Shopping List"
          title={collapsed ? "Shopping List" : undefined}
        >
          <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">
            <ICON_MAP.ShoppingList stroke="currentColor" className="w-5 h-5" />
          </span>
          {!collapsed && <span className="truncate">Shopping List</span>}
        </Link>
        <Link
          href="/settings"
          prefetch={false}
          className={`${itemBase} ${itemLayout} ${itemIdle}`}
          aria-label="Settings"
          title={collapsed ? "Settings" : undefined}
        >
          <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">
            <SettingsIcon />
          </span>
          {!collapsed && <span className="truncate">Settings</span>}
        </Link>
        <button
          type="button"
          onClick={onOpenFeedback}
          className={`${itemBase} ${itemLayout} ${itemIdle} w-full text-left`}
          aria-label="Send Feedback"
          title={collapsed ? "Send Feedback" : undefined}
        >
          <span className="flex items-center justify-center w-6 h-6 flex-shrink-0">
            <FeedbackIcon />
          </span>
          {!collapsed && <span className="truncate">Feedback</span>}
        </button>
      </div>
    </aside>
  );
}
