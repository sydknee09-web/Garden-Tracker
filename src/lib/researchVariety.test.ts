import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Gemini client so we control what each generateContent call returns.
const mockGenerateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

import {
  researchVariety,
  researchPlantTiered,
  buildTierLadder,
  buildResearchPrompt,
  RESEARCH_PROMPT,
} from "./researchVariety";

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

describe("buildResearchPrompt framings (Ship 2)", () => {
  it("keeps the EXACT MATCH honesty contract in every framing", () => {
    for (const framing of ["variety", "cultivar", "species"] as const) {
      const prompt = buildResearchPrompt(framing);
      expect(prompt).toContain("EXACT MATCH ONLY");
      expect(prompt).toContain('{"found": false}');
    }
  });

  it("asks for the When-to-Plant structured fields in the shared field list", () => {
    expect(RESEARCH_PROMPT).toContain("when_to_plant_description");
    expect(RESEARCH_PROMPT).toContain("planting_seasons_tags");
    expect(RESEARCH_PROMPT).toContain("optimal_planting_months");
    expect(RESEARCH_PROMPT).toContain("indoor_start_weeks_before_frost");
    expect(RESEARCH_PROMPT).toContain("outdoor_plant_weeks_after_frost");
  });
});

describe("buildTierLadder (Ship 2 tag-aware framing)", () => {
  it("annual vegetable → variety framing first, then combined, then species", () => {
    const ladder = buildTierLadder("Tomato", "Cherokee Purple", {
      lifecycle: "Annual", growth_form: "Herbaceous", plant_category: "Vegetable",
    });
    expect(ladder.map((t) => t.framing)).toEqual(["variety", "species", "species"]);
    expect(ladder.map((t) => t.level)).toEqual(["variety", "species", "species"]);
    expect(ladder.map((t) => t.cacheScope)).toEqual(["variety", "variety", "species"]);
    expect(ladder[2].query).toBe("Tomato");
  });

  it("perennial tree → cultivar framing first", () => {
    const ladder = buildTierLadder("Maple", "October Glory", {
      lifecycle: "Perennial", growth_form: "Tree", plant_category: "Ornamental",
    });
    expect(ladder[0].framing).toBe("cultivar");
    expect(ladder[0].level).toBe("cultivar");
    expect(ladder[0].query).toBe("Maple October Glory");
  });

  it("untagged with a variety → keeps the variety framing as tier 1 (pre-tag profiles keep today's behavior)", () => {
    const ladder = buildTierLadder("Tomato", "Cherokee Purple", null);
    expect(ladder[0].framing).toBe("variety");
    expect(ladder).toHaveLength(3);
  });

  it("tagged non-seed non-woody (fern/canna shape) → combined-name lookup first, no variety framing", () => {
    const ladder = buildTierLadder("Tree Fern", "Australian", {
      lifecycle: "Perennial", growth_form: "Herbaceous", plant_category: "Ornamental",
    });
    expect(ladder.map((t) => t.framing)).toEqual(["species", "species"]);
    expect(ladder[0].query).toBe("Tree Fern Australian");
    // Combined-name data is specific to the full name — cached at the variety identity.
    expect(ladder[0].cacheScope).toBe("variety");
    expect(ladder[1].query).toBe("Tree Fern");
    expect(ladder[1].cacheScope).toBe("species");
  });

  it("no variety → species lookup only", () => {
    const ladder = buildTierLadder("Canna", "", { lifecycle: "Perennial", growth_form: "Bulb", plant_category: "Flower" });
    expect(ladder).toHaveLength(1);
    expect(ladder[0]).toMatchObject({ framing: "species", level: "species", cacheScope: "species", query: "Canna" });
  });
});

describe("researchPlantTiered (Ship 2 tiered retry)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tier-1 hit without running later tiers", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(RICH));
    const outcome = await researchPlantTiered("key", "Grape", "Concord", null);
    expect(outcome).toMatchObject({ found: true, level: "variety", cacheScope: "variety", attempts: 1 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("falls through not-found tiers to a species hit, tagged species-level", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse({ found: false }))
      .mockResolvedValueOnce(geminiResponse({ found: false }))
      .mockResolvedValueOnce(geminiResponse({ found: true, plant_description: "A tropical rhizome." }));
    const outcome = await researchPlantTiered("key", "Canna", "Mystery Cultivar", null);
    expect(outcome).toMatchObject({ found: true, level: "species", cacheScope: "species", attempts: 3 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it("returns {found:false} only after EVERY tier returned not-found (couldn't-find UX)", async () => {
    mockGenerateContent.mockResolvedValue(geminiResponse({ found: false }));
    const outcome = await researchPlantTiered("key", "Madeupplant", "Nonsense", null);
    expect(outcome).toEqual({ found: false, attempts: 3 });
  });

  it("aborts the ladder on AI failure (null) instead of faking a not-found", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse({ found: false }))
      .mockRejectedValueOnce(new Error("429"));
    const outcome = await researchPlantTiered("key", "Tomato", "Cherokee Purple", null);
    expect(outcome).toBeNull();
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});
