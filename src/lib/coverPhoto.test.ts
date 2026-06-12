import { describe, it, expect } from "vitest";
import {
  COVER_AUTO_SKIP_ENTRY_TYPES,
  coverEntryHasPhoto,
  pickAutoCoverEntry,
  resolveCoverEntry,
  type CoverEntryLike,
} from "./coverPhoto";

function entry(overrides: Partial<CoverEntryLike> & { id: string }): CoverEntryLike {
  return {
    created_at: "2026-06-01T00:00:00Z",
    entry_type: "note",
    image_file_path: "user/photo.jpg",
    photo_url: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("coverEntryHasPhoto", () => {
  it("true for image_file_path, true for photo_url-only (legacy/external), false for neither", () => {
    expect(coverEntryHasPhoto(entry({ id: "a" }))).toBe(true);
    expect(coverEntryHasPhoto(entry({ id: "b", image_file_path: null, photo_url: "https://x/p.jpg" }))).toBe(true);
    expect(coverEntryHasPhoto(entry({ id: "c", image_file_path: null, photo_url: null }))).toBe(false);
    expect(coverEntryHasPhoto(entry({ id: "d", image_file_path: "  ", photo_url: " " }))).toBe(false);
  });
});

describe("pickAutoCoverEntry", () => {
  it("picks the most recent photo entry regardless of input order", () => {
    const older = entry({ id: "old", created_at: "2026-05-01T00:00:00Z" });
    const newer = entry({ id: "new", created_at: "2026-06-10T00:00:00Z" });
    expect(pickAutoCoverEntry([older, newer])?.id).toBe("new");
    expect(pickAutoCoverEntry([newer, older])?.id).toBe("new");
  });

  it("skips vault_add (receipt/acquisition artifacts) even when most recent", () => {
    expect(COVER_AUTO_SKIP_ENTRY_TYPES).toContain("vault_add");
    const receipt = entry({ id: "receipt", entry_type: "vault_add", created_at: "2026-06-11T00:00:00Z" });
    const growth = entry({ id: "growth", entry_type: "growth", created_at: "2026-06-01T00:00:00Z" });
    expect(pickAutoCoverEntry([receipt, growth])?.id).toBe("growth");
  });

  it("includes legacy entries with entry_type null", () => {
    const legacy = entry({ id: "legacy", entry_type: null, created_at: "2026-06-11T00:00:00Z" });
    expect(pickAutoCoverEntry([legacy])?.id).toBe("legacy");
  });

  it("skips photo-less and soft-deleted entries; returns null when nothing qualifies", () => {
    const noPhoto = entry({ id: "n", image_file_path: null, photo_url: null });
    const deleted = entry({ id: "d", deleted_at: "2026-06-11T00:00:00Z" });
    const receipt = entry({ id: "r", entry_type: "vault_add" });
    expect(pickAutoCoverEntry([noPhoto, deleted, receipt])).toBeNull();
    expect(pickAutoCoverEntry([])).toBeNull();
  });
});

describe("resolveCoverEntry", () => {
  const photoA = entry({ id: "A", created_at: "2026-06-01T00:00:00Z" });
  const photoB = entry({ id: "B", created_at: "2026-06-10T00:00:00Z" });
  const receipt = entry({ id: "R", entry_type: "vault_add", created_at: "2026-06-11T00:00:00Z" });

  it("auto (explicit, null, and undefined mode) → most-recent non-receipt photo", () => {
    expect(resolveCoverEntry({ cover_photo_mode: "auto" }, [photoA, photoB, receipt])?.id).toBe("B");
    expect(resolveCoverEntry({ cover_photo_mode: null }, [photoA, photoB])?.id).toBe("B");
    expect(resolveCoverEntry({}, [photoA, photoB])?.id).toBe("B");
  });

  it("auto with no qualifying photos → null (consumer shows profile chain)", () => {
    expect(resolveCoverEntry({}, [receipt])).toBeNull();
  });

  it("pinned_journal → the referenced entry, even when older or a receipt (user agency)", () => {
    expect(
      resolveCoverEntry(
        { cover_photo_mode: "pinned_journal", cover_photo_journal_entry_id: "A" },
        [photoA, photoB]
      )?.id
    ).toBe("A");
    expect(
      resolveCoverEntry(
        { cover_photo_mode: "pinned_journal", cover_photo_journal_entry_id: "R" },
        [photoA, photoB, receipt]
      )?.id
    ).toBe("R");
  });

  it("pinned_journal with a dead pin (soft-deleted / photo-less / missing) → silent auto fallback", () => {
    const deadPin = entry({ id: "P", deleted_at: "2026-06-11T00:00:00Z" });
    expect(
      resolveCoverEntry(
        { cover_photo_mode: "pinned_journal", cover_photo_journal_entry_id: "P" },
        [deadPin, photoB]
      )?.id
    ).toBe("B");
    expect(
      resolveCoverEntry(
        { cover_photo_mode: "pinned_journal", cover_photo_journal_entry_id: "missing" },
        [photoA]
      )?.id
    ).toBe("A");
  });

  it("pinned_profile_hero → always null, even when journal photos exist", () => {
    expect(
      resolveCoverEntry({ cover_photo_mode: "pinned_profile_hero" }, [photoA, photoB])
    ).toBeNull();
  });
});
