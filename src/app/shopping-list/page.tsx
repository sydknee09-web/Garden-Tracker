"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type ShoppingItem = {
  id: string;
  plant_profile_id: string;
  is_purchased: boolean;
  created_at: string;
  plant_profiles: { name: string; variety_name: string | null } | null;
};

export default function ShoppingListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("shopping_list")
      .select("id, plant_profile_id, is_purchased, created_at, plant_profiles(name, variety_name)")
      .eq("user_id", user.id)
      .eq("is_purchased", false)
      .order("created_at", { ascending: false });
    if (error) {
      setItems([]);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as unknown as ShoppingItem[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handlePurchased = useCallback(
    async (id: string) => {
      setTogglingId(id);
      await supabase.from("shopping_list").update({ is_purchased: true }).eq("id", id).eq("user_id", user!.id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTogglingId(null);
    },
    [user?.id]
  );

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
        >
          ← Back to Vault
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Shopping List</h1>
        <p className="text-neutral-600 text-sm mb-6">
          Check &quot;Purchased&quot; to archive an item (it will be hidden from the list).
        </p>

        {loading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-neutral-500">No items on your list. Add seeds from the Vault with the 🛒 button.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const label = item.plant_profiles
                ? item.plant_profiles.variety_name?.trim()
                  ? `${item.plant_profiles.name} — ${item.plant_profiles.variety_name}`
                  : item.plant_profiles.name
                : "Unknown";
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white border border-black/10"
                >
                  <input
                    type="checkbox"
                    id={`purchased-${item.id}`}
                    checked={false}
                    onChange={() => handlePurchased(item.id)}
                    disabled={togglingId === item.id}
                    className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                    aria-label={`Mark ${label} as purchased`}
                  />
                  <label htmlFor={`purchased-${item.id}`} className="flex-1 cursor-pointer text-neutral-900">
                    {label}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
