"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        reg.addEventListener("updatefound", () => {
          if (!reg.installing || !navigator.serviceWorker.controller) return;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.location.reload();
          }, { once: true });
        });
      }).catch(() => {
        // SW registration failed — silently ignore (dev mode, etc.)
      });
    }
  }, []);

  return null;
}
