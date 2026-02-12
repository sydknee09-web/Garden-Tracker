"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRecoveryToken, setHasRecoveryToken] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(hash.replace("#", ""));
    const type = params.get("type");
    setHasRecoveryToken(type === "recovery" || type === "invite");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (hasRecoveryToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-black/60">Loading…</p>
      </div>
    );
  }

  if (!hasRecoveryToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-card border border-black/5"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
        >
          <h1 className="text-xl font-semibold text-black mb-2">Invalid or expired link</h1>
          <p className="text-black/60 text-sm mb-6">
            This page is for setting a new password after clicking the link in your recovery email.
            Request a new link from the reset password page.
          </p>
          <Link
            href="/reset-password"
            className="block w-full py-2.5 rounded-xl bg-emerald text-white font-medium text-center shadow-soft"
          >
            Request new link
          </Link>
          <p className="mt-4 text-center text-sm text-black/60">
            <Link href="/login" className="font-medium text-emerald hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-card border border-black/5"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
      >
        <h1 className="text-2xl font-semibold text-black mb-1">Set new password</h1>
        <p className="text-black/60 text-sm mb-6">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-black/80 mb-1">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
            />
            <p className="mt-1 text-xs text-black/50">At least 6 characters</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-black/80 mb-1">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
            />
          </div>
          {error && <p className="text-sm text-citrus font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-black/60">
          <Link href="/login" className="font-medium text-emerald hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
