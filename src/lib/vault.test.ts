import { describe, it, expect } from "vitest";
import { normalizeSeedStockRow, normalizeSeedStockRows } from "./vault";

describe("vault seed data transform", () => {
  it("transforms a typical Supabase seed_stocks response without crashing", () => {
    const mockSupabaseSeeds = [
      {
        id: "stock-1",
        plant_variety_id: "pv-1",
        volume: "full",
        plant_varieties: {
          name: "Tomato",
          variety_name: "Cherokee Purple",
          inventory_count: 2,
          status: "vault",
          harvest_days: 80,
          tags: ["heirloom"],
          source_url: "https://example.com/tomato",
        },
      },
      {
        id: "stock-2",
        plant_variety_id: "pv-2",
        volume: "partial",
        plant_varieties: {
          name: "Bean",
          variety_name: "Blue Lake",
          inventory_count: 1,
          status: null,
          harvest_days: null,
          tags: null,
          source_url: null,
        },
      },
    ];

    const result = normalizeSeedStockRows(mockSupabaseSeeds);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "stock-1",
      plant_variety_id: "pv-1",
      name: "Tomato",
      variety: "Cherokee Purple",
      volume: "full",
      inventory_count: 2,
      status: "vault",
      harvest_days: 80,
      tags: ["heirloom"],
      source_url: "https://example.com/tomato",
    });
    expect(result[1].name).toBe("Bean");
    expect(result[1].variety).toBe("Blue Lake");
    expect(result[1].volume).toBe("partial");
  });

  it("handles plant_variety alias (alternative join key) without crashing", () => {
    const row = {
      id: "s1",
      plant_variety_id: "pv1",
      volume: "low",
      plant_variety: {
        name: "Cucumber",
        variety_name: "Lemon",
      },
    };

    const result = normalizeSeedStockRow(row);

    expect(result.id).toBe("s1");
    expect(result.name).toBe("Cucumber");
    expect(result.variety).toBe("Lemon");
    expect(result.volume).toBe("low");
  });

  it("handles null or undefined row without crashing", () => {
    expect(() => normalizeSeedStockRow(null)).not.toThrow();
    expect(() => normalizeSeedStockRow(undefined)).not.toThrow();

    const nullResult = normalizeSeedStockRow(null);
    expect(nullResult.id).toBe("");
    expect(nullResult.name).toBe("Unknown");
    expect(nullResult.variety).toBe("—");
    expect(nullResult.volume).toBe("full");
  });

  it("handles empty or missing plant_varieties without crashing", () => {
    const row = {
      id: "orphan",
      plant_variety_id: "pv-orphan",
      volume: "empty",
      plant_varieties: null,
      plant_variety: null,
    };

    const result = normalizeSeedStockRow(row);

    expect(result.id).toBe("orphan");
    expect(result.name).toBe("Unknown");
    expect(result.variety).toBe("—");
    expect(result.volume).toBe("empty");
  });

  it("handles malformed volume by defaulting to full", () => {
    const row = {
      id: "x",
      plant_variety_id: "y",
      volume: "invalid",
      plant_varieties: { name: "A", variety_name: "B" },
    };

    const result = normalizeSeedStockRow(row);

    expect(result.volume).toBe("full");
  });

  it("normalizeSeedStockRows handles null/undefined array without crashing", () => {
    expect(normalizeSeedStockRows(null)).toEqual([]);
    expect(normalizeSeedStockRows(undefined)).toEqual([]);
    expect(normalizeSeedStockRows([])).toEqual([]);
  });

  it("normalizeSeedStockRows skips null entries in array", () => {
    const rows = [
      { id: "a", plant_variety_id: "pv-a", volume: "full", plant_varieties: { name: "A", variety_name: "A1" } },
      null,
      undefined,
      { id: "b", plant_variety_id: "pv-b", volume: "full", plant_varieties: { name: "B", variety_name: "B1" } },
    ];

    const result = normalizeSeedStockRows(rows);

    expect(result).toHaveLength(4);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("Unknown");
    expect(result[2].name).toBe("Unknown");
    expect(result[3].name).toBe("B");
  });
});
