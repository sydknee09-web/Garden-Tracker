"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { SeedPacket } from "@/types/garden";

interface UseVaultPacketHandlersArgs {
  userId: string | undefined;
  profileId: string;
  profileOwnerId: string;
  packets: SeedPacket[];
  setPackets: React.Dispatch<React.SetStateAction<SeedPacket[]>>;
}

export function useVaultPacketHandlers({
  userId,
  profileId,
  profileOwnerId,
  packets,
  setPackets,
}: UseVaultPacketHandlersArgs) {
  const [openPacketDetails, setOpenPacketDetails] = useState<Set<string>>(new Set());
  const [journalByPacketId, setJournalByPacketId] = useState<Record<string, { id: string; note: string | null; created_at: string; grow_instance_id?: string | null }[]>>({});
  const [loadingJournalForPacket, setLoadingJournalForPacket] = useState<Set<string>>(new Set());

  const fetchJournalForPacket = useCallback(async (packetId: string) => {
    if (!userId) return;
    setLoadingJournalForPacket((prev) => new Set(prev).add(packetId));
    const { data } = await supabase
      .from("journal_entries")
      .select("id, note, created_at, grow_instance_id")
      .eq("seed_packet_id", packetId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setJournalByPacketId((prev) => ({
      ...prev,
      [packetId]: (data ?? []) as { id: string; note: string | null; created_at: string; grow_instance_id?: string | null }[],
    }));
    setLoadingJournalForPacket((prev) => { const next = new Set(prev); next.delete(packetId); return next; });
  }, [userId]);

  const togglePacketDetails = useCallback((packetId: string) => {
    setOpenPacketDetails((prev) => {
      const next = new Set(prev);
      if (next.has(packetId)) next.delete(packetId); else next.add(packetId);
      return next;
    });
  }, []);

  useEffect(() => {
    openPacketDetails.forEach((packetId) => {
      if (journalByPacketId[packetId] === undefined && !loadingJournalForPacket.has(packetId)) {
        fetchJournalForPacket(packetId);
      }
    });
  }, [openPacketDetails, journalByPacketId, loadingJournalForPacket, fetchJournalForPacket]);

  const updatePacketQty = useCallback(async (packetId: string, qty: number) => {
    if (!userId) return;
    const owner = profileOwnerId || userId;
    const clamped = Math.max(0, Math.min(100, qty));
    const updates: Record<string, unknown> = { qty_status: clamped };
    if (clamped <= 0) updates.is_archived = true;
    else updates.is_archived = false;
    await supabase.from("seed_packets").update(updates).eq("id", packetId).eq("user_id", owner);
    setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, qty_status: clamped, is_archived: clamped <= 0 } : p)));
    if (profileId) {
      const { data: activeGrows } = await supabase
        .from("grow_instances")
        .select("id")
        .eq("plant_profile_id", profileId)
        .eq("user_id", owner)
        .is("deleted_at", null)
        .in("status", ["pending", "growing"]);
      const inGarden = (activeGrows?.length ?? 0) > 0;
      if (inGarden) {
        await supabase.from("plant_profiles").update({ status: "active" }).eq("id", profileId).eq("user_id", owner);
      } else if (clamped > 0) {
        await supabase.from("plant_profiles").update({ status: "in_stock" }).eq("id", profileId).eq("user_id", owner);
      } else {
        const { data: remaining } = await supabase
          .from("seed_packets")
          .select("id")
          .eq("plant_profile_id", profileId)
          .eq("user_id", owner)
          .or("is_archived.is.null,is_archived.eq.false")
          .gt("qty_status", 0);
        if (!remaining?.length) {
          await supabase.from("plant_profiles").update({ status: "out_of_stock" }).eq("id", profileId).eq("user_id", owner);
          await supabase.from("shopping_list").upsert(
            { user_id: owner, plant_profile_id: profileId, is_purchased: false },
            { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false }
          );
        }
      }
    }
  }, [userId, profileId, profileOwnerId, setPackets]);

  const updatePacketPurchaseDate = useCallback(async (packetId: string, date: string) => {
    if (!userId) return;
    const owner = profileOwnerId || userId;
    const value = date.trim() || null;
    await supabase.from("seed_packets").update({ purchase_date: value }).eq("id", packetId).eq("user_id", owner);
    setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, purchase_date: value ?? undefined } : p)));
  }, [userId, profileOwnerId, setPackets]);

  const updatePacketNotes = useCallback(
    async (packetId: string, notes: string, options?: { persist?: boolean }) => {
      if (options?.persist === false) {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, user_notes: notes } : p)));
        return;
      }
      const value = notes.trim() || null;
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, user_notes: value } : p)));
      if (userId) {
        const owner = profileOwnerId || userId;
        await supabase.from("seed_packets").update({ user_notes: value }).eq("id", packetId).eq("user_id", owner);
      }
    },
    [userId, profileOwnerId, setPackets],
  );

  const updatePacketStorageLocation = useCallback(
    async (packetId: string, location: string, options?: { persist?: boolean }) => {
      if (options?.persist === false) {
        setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, storage_location: location } : p)));
        return;
      }
      const value = location.trim() || null;
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, storage_location: value } : p)));
      if (userId) {
        const owner = profileOwnerId || userId;
        await supabase.from("seed_packets").update({ storage_location: value }).eq("id", packetId).eq("user_id", owner);
      }
    },
    [userId, profileOwnerId, setPackets],
  );

  const updatePacketRating = useCallback(
    async (packetId: string, rating: number | null) => {
      if (!userId) return;
      const owner = profileOwnerId || userId;
      setPackets((prev) => prev.map((p) => (p.id === packetId ? { ...p, packet_rating: rating } : p)));
      await supabase.from("seed_packets").update({ packet_rating: rating }).eq("id", packetId).eq("user_id", owner);
    },
    [userId, profileOwnerId, setPackets],
  );

  const deletePacket = useCallback(async (packetId: string) => {
    if (!userId) return;
    const owner = profileOwnerId || userId;
    const { error: e } = await supabase
      .from("seed_packets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", packetId)
      .eq("user_id", owner);
    if (!e) setPackets((prev) => prev.filter((p) => p.id !== packetId));
  }, [userId, profileOwnerId, setPackets]);

  // Suppress unused-variable lint: packets is a dependency for callers, not used directly in this hook
  void packets;

  return {
    openPacketDetails,
    journalByPacketId,
    loadingJournalForPacket,
    fetchJournalForPacket,
    togglePacketDetails,
    updatePacketQty,
    updatePacketPurchaseDate,
    updatePacketNotes,
    updatePacketStorageLocation,
    updatePacketRating,
    deletePacket,
  };
}
