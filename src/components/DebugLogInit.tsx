"use client";

import { useEffect } from "react";
import { installConsoleCapture, uninstallConsoleCapture } from "@/lib/debugLogBuffer";

export function DebugLogInit() {
  useEffect(() => {
    installConsoleCapture();
    return () => {
      uninstallConsoleCapture();
    };
  }, []);
  return null;
}
