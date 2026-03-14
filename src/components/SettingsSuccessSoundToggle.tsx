"use client";

import { useState, useEffect } from "react";
import { isSuccessSoundEnabled, setSuccessSoundEnabled } from "@/lib/successSound";

export function SettingsSuccessSoundToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEnabled(isSuccessSoundEnabled());
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setEnabled(value);
    setSuccessSoundEnabled(value);
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 py-3 border-b border-black/5">
      <div className="min-w-0 flex-1">
        <span className="font-medium text-neutral-900 block">Play sound on success</span>
        <span className="text-xs text-neutral-500 block">Short tone when you complete a task, add to vault, or save.</span>
      </div>
      <label className="relative inline-flex items-center shrink-0 cursor-pointer min-w-[44px] min-h-[44px]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleChange}
          className="peer sr-only"
          aria-describedby="success-sound-desc"
        />
        <span
          id="success-sound-desc"
          className="relative block w-11 h-6 bg-neutral-200 rounded-full peer-checked:bg-emerald-500 transition-colors after:content-[''] after:block after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow after:transition-transform peer-checked:after:translate-x-5"
          aria-hidden
        />
      </label>
    </div>
  );
}
