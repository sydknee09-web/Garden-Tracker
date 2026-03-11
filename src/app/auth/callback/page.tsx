"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Handles Supabase PKCE auth callbacks (email confirmation, invite, etc.).
 * Supabase sends a one-time ?code= to this URL; we exchange it for a session
 * and redirect to ?next (default "/").
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (!code) {
      // No code — nothing to exchange; just navigate to destination
      router.replace(next);
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
      if (err) {
        setError(err.message);
      } else {
        router.replace(next);
      }
    });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-card border border-black/5"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
        >
          <h1 className="text-xl font-semibold text-black mb-2">Link expired</h1>
          <p className="text-black/60 text-sm mb-6">
            {error}. Please request a new link.
          </p>
          <a
            href="/login"
            className="block w-full py-2.5 rounded-xl bg-emerald text-white font-medium text-center shadow-soft"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-black/60 text-sm">Completing sign in…</p>
    </div>
  );
}
