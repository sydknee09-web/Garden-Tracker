"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { APP_URL } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-card border border-black/5"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
      >
        <h1 className="text-2xl font-semibold text-black mb-1">Welcome back</h1>
        <p className="text-black/60 text-sm mb-6">Sign in to your garden</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-black/80 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-sm font-medium text-black/80">
                Password
              </label>
              <Link
                href="/reset-password"
                className="text-sm text-emerald font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
            />
          </div>
          {error && <p className="text-sm text-citrus font-medium">{error}</p>}
          {message && <p className="text-sm text-emerald font-medium">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-black/60">
          No account?{" "}
          <Link href="/signup" className="font-medium text-emerald hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
