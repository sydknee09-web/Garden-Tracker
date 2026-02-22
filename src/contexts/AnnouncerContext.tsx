"use client";

import { createContext, useCallback, useContext, useState } from "react";

type AnnouncerContextValue = {
  announce: (message: string) => void;
};

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");

  const announce = useCallback((msg: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(msg));
    setTimeout(() => setMessage(""), 1000);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="announcer"
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerContextValue {
  const ctx = useContext(AnnouncerContext);
  return ctx ?? { announce: () => {} };
}
