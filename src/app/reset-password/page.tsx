"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { APP_URL } from "@/contexts/AuthContext";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${APP_URL}/update-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-antigravity border border-black/5"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
        >
          <h1 className="text-2xl font-semibold text-black mb-1">Check your email</h1>
          <p className="text-black/60 text-sm mb-6">
            We sent a recovery link to <strong>{email}</strong>. Click the link to set a new password.
          </p>
          <Link
            href="/login"
            className="block w-full py-2.5 rounded-xl bg-emerald text-white font-medium text-center shadow-soft"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-antigravity border border-black/5"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
      >
        <h1 className="text-2xl font-semibold text-black mb-1">Forgot password?</h1>
        <p className="text-black/60 text-sm mb-6">
          Enter your email and we’ll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-black/80 mb-1">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
            />
          </div>
          {error && <p className="text-sm text-citrus font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send recovery link"}
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
