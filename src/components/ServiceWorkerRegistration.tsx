"use client";

import { useEffect } from "react";
import { logEvent } from "@/lib/debugLog";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      logEvent("sw", "register_attempt");
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        logEvent("sw", "registered", { scope: reg.scope });
        reg.addEventListener("updatefound", () => {
          logEvent("sw", "update_found");
          if (!reg.installing || !navigator.serviceWorker.controller) return;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            logEvent("sw", "controller_changed");
            window.location.reload();
          }, { once: true });
        });
      }).catch((err) => {
        logEvent("sw", "register_error", { message: err instanceof Error ? err.message : String(err) });
      });
    }
  }, []);

  return null;
}
