"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { installConsoleCapture, uninstallConsoleCapture } from "@/lib/debugLogBuffer";
import { logEvent } from "@/lib/debugLog";

export function DebugLogInit() {
  const pathname = usePathname();

  useEffect(() => {
    installConsoleCapture();
    logEvent("app", "boot", {
      ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "",
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
    });
    return () => {
      uninstallConsoleCapture();
    };
  }, []);

  useEffect(() => {
    if (pathname) logEvent("nav", "enter", { path: pathname });
  }, [pathname]);

  return null;
}
