"use client";

import { useState, useCallback } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ open, onClose }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClose = useCallback(() => {
    setError(null);
    setSuccess(false);
    setEmail("");
    onClose();
  }, [onClose]);

  useEscapeKey(open, handleClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to send invitation.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setEmail("");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        aria-hidden
        onClick={handleClose}
      />
      <div
        className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white shadow-card border border-black/5 p-6 max-w-sm mx-auto"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        role="dialog"
        aria-labelledby="invite-modal-title"
        aria-modal="true"
      >
        <h2 id="invite-modal-title" className="text-lg font-semibold text-black mb-1">
          Invite Garden Member
        </h2>
        <p className="text-black/60 text-sm mb-4">
          They’ll get an email to set a password and join the app.
        </p>

        {success ? (
          <>
            <p className="text-emerald font-medium text-sm mb-4">Invitation sent.</p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft"
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-black/80 mb-1">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sister@example.com"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
              />
            </div>
            {error && <p className="text-sm text-citrus font-medium">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
