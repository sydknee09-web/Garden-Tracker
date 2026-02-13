"use client";

import { useEffect, useRef } from "react";

/**
 * Hook so the browser back button closes a modal instead of navigating away.
 * - When modal opens: pushState so there is an entry to pop.
 * - On popstate (user pressed back): call onClose.
 * - When modal closes from UI (Cancel, overlay, etc.): call history.back() to remove the state we pushed.
 */
export function useModalBackClose(isOpen: boolean, onClose: () => void): void {
  const didPushRef = useRef(false);
  const prevOpenRef = useRef(isOpen);

  // Push state when transitioning from closed to open
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isOpen && !prevOpenRef.current) {
      window.history.pushState({ modal: true }, "", window.location.href);
      didPushRef.current = true;
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // When closing from UI (isOpen becomes false and we had pushed), pop the state
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOpen && didPushRef.current) {
      didPushRef.current = false;
      window.history.back();
    }
  }, [isOpen]);

  // popstate listener: user pressed back → close modal (do not call history.back() again)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      didPushRef.current = false;
      onClose();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [onClose]);
}
