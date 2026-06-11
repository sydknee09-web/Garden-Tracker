import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Gemini client so we control what each generateContent call returns.
const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import { researchVariety, RESEARCH_PROMPT } from "./researchVariety";

/** Wrap a fields object as a Gemini-style response (text is JSON the parser regex-matches). */
function geminiResponse(fields: Record<string, unknown>) {
  return { text: JSON.stringify(fields) };
}

const RICH = {
  found: true,
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

describe("researchVariety (exact-match-only contract, B5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("instructs the model to return found:false instead of substituting or guessing", () => {
    // Prompt-contract guard: exact-match-only + no species fallback is the locked behavior.
    expect(RESEARCH_PROMPT).toContain("EXACT MATCH ONLY");
    expect(RESEARCH_PROMPT).toContain('{"found": false}');
  });

  it("returns null when the model returns no parseable JSON (AI-unavailable semantics)", async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: "no json here" });
    const outcome = await researchVariety("key", "Tomato", "Cherokee Purple", "");
    expect(outcome).toBeNull();
  });

  it("returns null when the Gemini call throws", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("429"));
    const outcome = await researchVariety("key", "Tomato", "Cherokee Purple", "");
    expect(outcome).toBeNull();
  });

  it("parses the full field set including the three classification tags on a found result", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(RICH));
    const outcome = await researchVariety("key", "Grape", "Concord", "");
    expect(outcome).not.toBeNull();
    expect(outcome!.found).toBe(true);
    if (!outcome!.found) throw new Error("unreachable");
    expect(outcome!.data.lifecycle).toBe("Perennial");
    expect(outcome!.data.growth_form).toBe("Vine");
    expect(outcome!.data.plant_category).toBe("Fruit");
    expect(outcome!.data.growing_notes).toContain("trellis");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("treats legacy responses without a found flag as found (back-compat)", async () => {
    const { found: _found, ...legacyFields } = RICH;
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(legacyFields));
    const outcome = await researchVariety("key", "Grape", "Concord", "");
    expect(outcome?.found).toBe(true);
  });

  it("returns {found:false} when the model can't find the exact variety — NO species fallback call", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse({ found: false }));
    const outcome = await researchVariety("key", "Canna Lily", "Summer Spritz Lemon Zest", "");
    expect(outcome).toEqual({ found: false });
    // Exactly ONE Gemini call: the species-level fallback is removed (Syd lock 2026-06-10).
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("runs exactly one query even when a variety is present (no thin-result retry)", async () => {
    // A sparse-but-found result must NOT trigger a second (species) query.
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({ found: true, sun_requirement: "Full Sun", spacing: "24 inches" })
    );
    const outcome = await researchVariety("key", "Canna Lily", "Summer Solstice Lemon", "");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(outcome?.found).toBe(true);
    if (outcome?.found) expect(outcome.data.sun_requirement).toBe("Full Sun");
  });
});
