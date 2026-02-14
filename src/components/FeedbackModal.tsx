"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES = [
  { value: "", label: "Select type…" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
] as const;

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function FeedbackModal({
  open,
  onClose,
  pageUrl,
}: {
  open: boolean;
  onClose: () => void;
  pageUrl: string;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const msg = message.trim();
    if (!msg || !user?.id) return;
    setError(null);
    setSending(true);
    try {
      const { error: err } = await supabase.from("user_feedback").insert({
        user_id: user.id,
        message: msg,
        category: category || null,
        page_url: pageUrl || null,
        user_email: user.email || null,
      });
      if (err) throw err;
      setSent(true);
      setMessage("");
      setCategory("");
      setTimeout(() => {
        setSent(false);
        onClose();
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e && typeof (e as { message?: string }).message === "string" ? (e as { message: string }).message : "Failed to send");
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [message, category, pageUrl, user?.id, user?.email, onClose]);

  const handleClose = useCallback(() => {
    if (!sending) {
      setMessage("");
      setCategory("");
      setError(null);
      setSent(false);
      onClose();
    }
  }, [sending, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40"
        aria-hidden
        onClick={handleClose}
      />
      <div
        className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        <div className="flex-shrink-0 flex items-center gap-2 p-4 border-b border-black/5">
          <span className="text-emerald-600" aria-hidden>
            <WrenchIcon />
          </span>
          <h2 id="feedback-title" className="text-lg font-semibold text-black">
            Send feedback
          </h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-black/60">
            Found a bug or have an idea? We’d love to hear from you. Your feedback helps improve the app.
          </p>
          <div>
            <label htmlFor="feedback-category" className="block text-sm font-medium text-black/80 mb-1">
              Type
            </label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black bg-white min-h-[44px]"
              aria-label="Feedback type"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value || "none"} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="feedback-message" className="block text-sm font-medium text-black/80 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what you’re seeing or what you’d like to see…"
              rows={4}
              className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black placeholder:text-black/40 resize-y min-h-[100px]"
              aria-label="Feedback message"
              disabled={sending}
            />
          </div>
          {pageUrl && (
            <p className="text-xs text-black/50">
              Submitting from: {pageUrl}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {sent && (
            <p className="text-sm text-emerald-600 font-medium" role="status">
              Thanks! Your feedback has been sent.
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-3 p-4 border-t border-black/5">
          <button
            type="button"
            onClick={handleClose}
            disabled={sending}
            className="flex-1 min-h-[44px] rounded-xl border border-black/10 text-black/80 font-medium hover:bg-black/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="flex-1 min-h-[44px] rounded-xl bg-emerald text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
