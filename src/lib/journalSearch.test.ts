import { describe, it, expect } from "vitest";
import { filterJournalEntries, type SearchableJournalEntry } from "./journalSearch";

const entries: SearchableJournalEntry[] = [
  {
    id: "1",
    note: "Sowed. Planted in front yard",
    entry_type: "planting",
    plant_display_names: ["Lemon (Pink lemonade)"],
    created_at: "2026-04-21T10:00:00Z",
  },
  {
    id: "2",
    note: "Took cuttings for water starts",
    entry_type: "quick",
    plant_display_names: ["Muehlenbeckia (Standard)"],
    created_at: "2026-04-21T11:00:00Z",
  },
  {
    id: "3",
    note: "Potted up. Went size bigger.",
    entry_type: "care",
    plant_display_names: ["Muehlenbeckia (Standard)"],
    created_at: "2026-04-21T12:00:00Z",
  },
  {
    id: "4",
    note: "Added Apricot (Gold Kist) to vault",
    entry_type: "vault_add",
    plant_display_names: ["Apricot (Gold Kist)"],
    created_at: "2026-04-21T13:00:00Z",
  },
  {
    id: "5",
    note: null,
    entry_type: "cold_stratify",
    plant_display_names: ["Apple (Honeycrisp)"],
    created_at: "2026-04-22T09:00:00Z",
  },
];

describe("filterJournalEntries", () => {
  it("returns all entries when query is empty", () => {
    expect(filterJournalEntries(entries, "")).toHaveLength(5);
    expect(filterJournalEntries(entries, "   ")).toHaveLength(5);
  });

  it("matches by description (case-insensitive)", () => {
    const result = filterJournalEntries(entries, "SOWED");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches by plant name", () => {
    const result = filterJournalEntries(entries, "apricot");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("matches by variety inside display name", () => {
    const result = filterJournalEntries(entries, "pink lemonade");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches by entry_type with underscores stripped (cold stratify)", () => {
    const result = filterJournalEntries(entries, "cold stratify");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  it("matches by formatted date (locale-robust)", () => {
    const targetDate = new Date("2026-04-21T10:00:00Z");
    const formatted = targetDate.toLocaleDateString();
    const result = filterJournalEntries(entries, formatted);
    // 4 entries fall on this date in their respective timezones
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it("supports multi-token AND across fields", () => {
    // "apricot vault" matches only entry 4 (Apricot in plant name + "vault" in note+type)
    const result = filterJournalEntries(entries, "apricot vault");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("4");
  });

  it("returns empty array when no match", () => {
    expect(filterJournalEntries(entries, "nonexistent")).toEqual([]);
  });
});
