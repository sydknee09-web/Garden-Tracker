"use client";

import { useEffect } from "react";

// global-error replaces the root layout, so globals.css / Tailwind are not
// loaded here — inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#F9FAFB",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#171717", margin: "0 0 8px" }}>
          Something Went Wrong
        </h1>
        <p
          style={{
            color: "#525252",
            fontSize: 14,
            margin: "0 0 16px",
            textAlign: "center",
            maxWidth: 448,
          }}
        >
          Something went wrong on our end.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: 44,
              minWidth: 120,
              padding: "8px 16px",
              borderRadius: 12,
              backgroundColor: "#059669",
              color: "#ffffff",
              fontWeight: 500,
              fontSize: 16,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              minHeight: 44,
              minWidth: 120,
              padding: "8px 16px",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              color: "#404040",
              fontWeight: 500,
              fontSize: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            Back to Garden
          </a>
        </div>
        {error.digest && (
          <p style={{ fontSize: 12, color: "#A3A3A3", margin: "16px 0 0" }}>
            Error reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
