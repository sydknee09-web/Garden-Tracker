import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Gemini client so we control what each generateContent call returns.
const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import { researchVariety } from "./researchVariety";

/** Wrap a fields object as a Gemini-style response (text is JSON the parser regex-matches). */
function geminiResponse(fields: Record<string, unknown>) {
  return { text: JSON.stringify(fields) };
}

const RICH = {
  plant_description: "A climbing fruit vine.",
  growing_notes: "Plant in full sun, train on a trellis.",
  propagation_notes: "Propagate from hardwood cuttings.",
  lifecycle: "Perennial",
  growth_form: "Vine",
  plant_category: "Fruit",
  soil_preference: "Well-drained",
  native_origin: "Mediterranean",
  sun_requirement: "Full Sun",
  water: "Regular",
};

const THIN = {
  // Fewer than THIN_RESULT_THRESHOLD (3) deep fields populated → triggers species fallback.
  sun_requirement: "Full Sun",
  spacing: "24 inches",
  plant_description: "A niche cultivar.",
};

describe("researchVariety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the model returns no parseable JSON", async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: "no json here" });
    const result = await researchVariety("key", "Tomato", "Cherokee Purple", "");
    expect(result).toBeNull();
  });

  it("parses the full field set including the three classification tags", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(RICH));
    const result = await researchVariety("key", "Grape", "Concord", "");
    expect(result?.lifecycle).toBe("Perennial");
    expect(result?.growth_form).toBe("Vine");
    expect(result?.plant_category).toBe("Fruit");
    expect(result?.growing_notes).toContain("trellis");
    // Rich primary → no species fallback call.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("runs a species-level fallback when the variety result is thin, merging without nulling", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse(THIN)) // variety query — thin
      .mockResolvedValueOnce(geminiResponse(RICH)); // species fallback — rich
    const result = await researchVariety("key", "Canna Lily", "Summer Solstice Lemon", "");
    // Two Gemini calls: the variety query, then the species fallback.
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    // Blanks from the thin primary are filled by the species result...
    expect(result?.growing_notes).toContain("trellis");
    expect(result?.lifecycle).toBe("Perennial");
    // ...but a field the primary already populated is NOT overwritten (variety wins).
    expect(result?.plant_description).toBe("A niche cultivar.");
    expect(result?.sun_requirement).toBe("Full Sun");
  });

  it("does NOT run a species fallback when there is no variety to narrow from", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(THIN));
    const result = await researchVariety("key", "Canna Lily", "", "");
    // No variety → species query would equal the primary query → no second call.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result?.plant_description).toBe("A niche cultivar.");
  });

  it("returns the thin primary if the species fallback itself fails", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse(THIN))
      .mockRejectedValueOnce(new Error("429"));
    const result = await researchVariety("key", "Canna Lily", "Summer Solstice Lemon", "");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result?.plant_description).toBe("A niche cultivar.");
  });
});
