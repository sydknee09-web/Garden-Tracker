"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { PlantProfile, SeedPacket } from "@/types/garden";
import { compressImage } from "@/lib/compressImage";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { parseFindHeroPhotoGalleryResponse } from "@/lib/parseFindHeroPhotoResponse";
import { syncExtractCache } from "./vaultProfileUtils";

type SessionLike = { access_token: string } | null;
type JournalPhoto = { id: string; image_file_path: string; created_at: string };

interface UseVaultHeroHandlersArgs {
  userId: string | undefined;
  profileId: string;
  profile: PlantProfile | null;
  packets: SeedPacket[];
  session: SessionLike;
  loadProfile: () => Promise<void>;
  profileOwnerId: string;
  onRouterRefresh?: () => void;
  setError?: (msg: string) => void;
}

export function useVaultHeroHandlers({
  userId,
  profileId,
  profile,
  packets,
  session,
  loadProfile,
  profileOwnerId,
  onRouterRefresh,
  setError,
}: UseVaultHeroHandlersArgs) {
  const [showSetPhotoModal, setShowSetPhotoModal] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroCropOpen, setHeroCropOpen] = useState(false);
  const [heroCropPreviewUrl, setHeroCropPreviewUrl] = useState("");
  const [findingStockPhoto, setFindingStockPhoto] = useState(false);
  const [findHeroError, setFindHeroError] = useState<string | null>(null);
  const [searchWebLoading, setSearchWebLoading] = useState(false);
  const [searchWebGalleryUrls, setSearchWebGalleryUrls] = useState<string[]>([]);
  const [searchWebError, setSearchWebError] = useState<string | null>(null);
  const [galleryImageFailed, setGalleryImageFailed] = useState<Set<string>>(new Set());
  const [stockPhotoCurrentFailed, setStockPhotoCurrentFailed] = useState(false);
  const [savingWebHero, setSavingWebHero] = useState(false);
  const [saveHeroError, setSaveHeroError] = useState<string | null>(null);
  const searchWebAbortRef = useRef<AbortController | null>(null);
  const photoGalleryLoadedRef = useRef(false);

  useEffect(() => {
    if (!showSetPhotoModal) {
      photoGalleryLoadedRef.current = false;
      return;
    }
    setSearchWebGalleryUrls([]);
    setSearchWebError(null);
    setGalleryImageFailed(new Set());
    setStockPhotoCurrentFailed(false);
    setSaveHeroError(null);
  }, [showSetPhotoModal]);

  const setHeroFromPath = useCallback(async (storagePath: string) => {
    if (!userId || !profileId) return;
    const { error } = await supabase
      .from("plant_profiles")
      .update({ hero_image_path: storagePath, hero_image_url: null })
      .eq("id", profileId)
      .eq("user_id", userId);
    if (!error) {
      if (profile) {
        const key = identityKeyFromVariety(profile.name ?? "", profile.variety_name ?? "");
        if (key) syncExtractCache(userId, key, { heroStoragePath: storagePath, originalHeroUrl: null });
      }
      await loadProfile();
    }
  }, [userId, profileId, profile, loadProfile]);

  const setHeroFromUrl = useCallback(async (url: string) => {
    if (!userId || !profileId || !url?.trim()) return;
    const { error } = await supabase
      .from("plant_profiles")
      .update({ hero_image_url: url.trim(), hero_image_path: null })
      .eq("id", profileId)
      .eq("user_id", userId);
    if (!error) {
      if (profile) {
        const key = identityKeyFromVariety(profile.name ?? "", profile.variety_name ?? "");
        if (key) syncExtractCache(userId, key, { originalHeroUrl: url.trim(), heroStoragePath: null });
      }
      await loadProfile();
    }
  }, [userId, profileId, profile, loadProfile]);

  const removeHeroImage = useCallback(async () => {
    if (!userId || !profileId) return;
    const { error } = await supabase
      .from("plant_profiles")
      .update({ hero_image_url: null, hero_image_path: null })
      .eq("id", profileId)
      .eq("user_id", userId);
    if (!error) {
      if (profile) {
        const key = identityKeyFromVariety(profile.name ?? "", profile.variety_name ?? "");
        if (key) syncExtractCache(userId, key, { originalHeroUrl: null, heroStoragePath: null });
      }
      await loadProfile();
    }
  }, [userId, profileId, profile, loadProfile]);

  const findAndSetStockPhoto = useCallback(async () => {
    if (!profile || findingStockPhoto) return;
    setFindingStockPhoto(true);
    setFindHeroError(null);
    const name = (profile.name ?? "").trim() || "Imported seed";
    const variety = (profile.variety_name ?? "").trim();
    const vendor = packets.length > 0 ? (packets[0].vendor_name ?? "").trim() : "";
    const identityKey = identityKeyFromVariety(name, variety);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    try {
      const res = await fetch("/api/seed/find-hero-photo", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, variety, vendor, identity_key: identityKey ?? undefined, profile_id: profileId }),
      });
      const data = (await res.json()) as { hero_image_url?: string; hero_image_path?: string; error?: string };
      const storagePath = data.hero_image_path?.trim();
      const url = data.hero_image_url?.trim();
      if (storagePath) {
        await setHeroFromPath(storagePath);
      } else if (url) {
        await setHeroFromUrl(url);
      }
      if (storagePath || url) onRouterRefresh?.();
      if (data.error) setFindHeroError(data.error);
      await loadProfile();
    } finally {
      setFindingStockPhoto(false);
    }
  }, [profile, packets, findingStockPhoto, session?.access_token, profileId, setHeroFromUrl, setHeroFromPath, loadProfile, onRouterRefresh]);

  const loadPhotoGallery = useCallback(async () => {
    if (!profile || searchWebLoading) return;
    setSearchWebLoading(true);
    setSearchWebGalleryUrls([]);
    setSearchWebError(null);
    const name = (profile.name ?? "").trim() || "Imported seed";
    const variety = (profile.variety_name ?? "").trim();
    const vendor = packets.length > 0 ? (packets[0].vendor_name ?? "").trim() : "";
    const identityKey = identityKeyFromVariety(name, variety);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const controller = new AbortController();
    searchWebAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch("/api/seed/find-hero-photo", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          variety,
          vendor,
          identity_key: identityKey ?? undefined,
          gallery: true,
          scientific_name: (profile as { scientific_name?: string | null })?.scientific_name?.trim() || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      const result = parseFindHeroPhotoGalleryResponse(text, res.ok);
      if (result.success) {
        setSearchWebGalleryUrls(result.urls);
      } else {
        setSearchWebError(result.error);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        setSearchWebError("Search timed out. Please try again.");
      } else {
        setSearchWebError(e instanceof Error ? e.message : "Search failed.");
      }
    } finally {
      clearTimeout(timeoutId);
      searchWebAbortRef.current = null;
      setSearchWebLoading(false);
    }
  }, [profile, packets, searchWebLoading, session?.access_token]);

  const cancelSearchWeb = useCallback(() => {
    searchWebAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!showSetPhotoModal || !profile || photoGalleryLoadedRef.current || searchWebLoading) return;
    photoGalleryLoadedRef.current = true;
    loadPhotoGallery();
  }, [showSetPhotoModal, profile, searchWebLoading, loadPhotoGallery]);

  const setHeroFromPacket = useCallback(async (packetStoragePath: string) => {
    if (!userId || !profileId) return;
    setHeroUploading(true);
    try {
      const { data: blob, error: downloadErr } = await supabase.storage.from("seed-packets").download(packetStoragePath);
      if (downloadErr || !blob) {
        setError?.(downloadErr?.message ?? "Could not load packet photo");
        return;
      }
      const destPath = `${profileOwnerId || userId}/hero-${profileId}-from-packet-${crypto.randomUUID().slice(0, 8)}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("journal-photos")
        .upload(destPath, blob, { contentType: blob.type || "image/jpeg", upsert: false, cacheControl: "31536000" });
      if (uploadErr) {
        setError?.(uploadErr.message);
        return;
      }
      await setHeroFromPath(destPath);
      setShowSetPhotoModal(false);
    } finally {
      setHeroUploading(false);
    }
  }, [userId, profileId, profileOwnerId, setHeroFromPath, setError]);

  const setHeroFromUpload = useCallback(async (file: File) => {
    if (!userId || !profileId) return;
    setHeroUploading(true);
    const { blob } = await compressImage(file);
    const path = `${profileOwnerId || userId}/hero-${profileId}-${crypto.randomUUID().slice(0, 8)}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("journal-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
    setHeroUploading(false);
    if (uploadErr) { setError?.(uploadErr.message); return; }
    await setHeroFromPath(path);
    setShowSetPhotoModal(false);
  }, [userId, profileId, profileOwnerId, setHeroFromPath, setError]);

  const setHeroFromJournal = useCallback((entry: JournalPhoto) => {
    setHeroFromPath(entry.image_file_path);
    setShowSetPhotoModal(false);
  }, [setHeroFromPath]);

  const saveHeroFromUrl = useCallback(async (url: string) => {
    if (galleryImageFailed.has(url) || savingWebHero || !userId || !profileId || !session?.access_token) return;
    setSaveHeroError(null);
    setSavingWebHero(true);
    try {
      const res = await fetch("/api/seed/save-hero-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ url, profile_id: profileId }),
      });
      const data = (await res.json()) as { path?: string; error?: string };
      if (res.ok && data.path) {
        await setHeroFromPath(data.path);
        setShowSetPhotoModal(false);
        const name = (profile?.name ?? "").trim() || "Imported seed";
        const variety = (profile?.variety_name ?? "").trim() ?? "";
        const vendor = packets.length > 0 ? (packets[0].vendor_name ?? "").trim() : "";
        const identityKey = identityKeyFromVariety(name, variety);
        if (identityKey && session?.access_token) {
          fetch("/api/seed/save-hero-to-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ identity_key: identityKey, hero_image_url: url, name, variety, vendor }),
          }).catch((err) => console.error("[save-hero-to-cache]", err));
        }
      } else {
        setSaveHeroError(data.error ?? "Couldn't save image. Try another tile or Refresh photos.");
      }
    } finally {
      setSavingWebHero(false);
    }
  }, [galleryImageFailed, savingWebHero, userId, profileId, session?.access_token, setHeroFromPath, profile, packets]);

  return {
    showSetPhotoModal, setShowSetPhotoModal,
    heroUploading,
    heroCropOpen, setHeroCropOpen,
    heroCropPreviewUrl, setHeroCropPreviewUrl,
    findingStockPhoto,
    findHeroError,
    searchWebLoading,
    searchWebGalleryUrls,
    searchWebError,
    galleryImageFailed, setGalleryImageFailed,
    stockPhotoCurrentFailed, setStockPhotoCurrentFailed,
    savingWebHero,
    saveHeroError,
    setHeroFromPath,
    setHeroFromUrl,
    removeHeroImage,
    findAndSetStockPhoto,
    loadPhotoGallery,
    cancelSearchWeb,
    setHeroFromPacket,
    setHeroFromUpload,
    setHeroFromJournal,
    saveHeroFromUrl,
  };
}
