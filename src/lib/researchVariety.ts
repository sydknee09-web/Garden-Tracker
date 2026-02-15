/**
 * Shared research logic: Gemini + Search for plant/variety details (description, growing notes, specs).
 * Used by: API route (enrich-from-name, extract), fill-in-blanks, and backfill CLI script.
 */

import { GoogleGenAI } from "@google/genai";

export const RESEARCH_PROMPT = `Using Google Search Grounding, find the official product page or a reliable gardening guide for this specific seed variety.

Also: find a high-quality stock image URL or product photo that represents the Actual Plant or Fruit (not the seed packet) for this variety. Prefer a clear photo of the mature plant, flower, or harvest.

Extract the following and return a single JSON object only (no markdown, no explanation):
- sowing_depth: e.g. "0.25 inches" or "1/4 inch"
- spacing: e.g. "12-18 inches" or "2 feet"
- sun_requirement: e.g. "Full Sun", "Partial Shade", "Full Sun to Partial Shade"
- days_to_germination: e.g. "7-14" or "10"
- days_to_maturity: e.g. "65" or "55-70"
- source_url: the URL of the page you used (so the user can verify)
- stock_photo_url: a direct URL (https://...) to a high-quality stock image of the actual plant/fruit for this variety—not the packet. Use empty string if no suitable image found.
- plant_description: 2-4 factual sentences describing this plant/variety (appearance, use, growing context). Gardening-relevant only; no marketing fluff. Use empty string if not found.
- growing_notes: optional short "how to grow" or seed-starting paragraph if easily found; otherwise empty string.

Use standard units: inches for depth and spacing, days for germination and maturity. Use empty string for any field you cannot find. Return only valid JSON.`;

export type ResearchVarietyResult = {
  sowing_depth?: string;
  spacing?: string;
  sun_requirement?: string;
  days_to_germination?: string;
  days_to_maturity?: string;
  source_url?: string;
  stock_photo_url?: string;
  plant_description?: string;
  growing_notes?: string;
};

/**
 * Name+variety research via Gemini + Google Search. Returns structured fields and description/notes.
 */
export async function researchVariety(
  apiKey: string,
  plantType: string,
  variety: string,
  vendor: string
): Promise<ResearchVarietyResult | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const searchQuery =
      [vendor, plantType, variety].filter(Boolean).join(" ") || "seed planting guide";
    const prompt = `${RESEARCH_PROMPT}\n\nSearch for: ${searchQuery}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text?.trim();
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const getStr = (k: string) =>
      typeof parsed[k] === "string" ? (parsed[k] as string).trim() : "";
    let source_url = getStr("source_url");
    if (!source_url && response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length) {
      const firstWeb = response.candidates[0].groundingMetadata.groundingChunks.find(
        (c: { web?: { uri?: string } }) => c.web?.uri
      );
      source_url = firstWeb?.web?.uri ?? "";
    }
    return {
      sowing_depth: getStr("sowing_depth") || undefined,
      spacing: getStr("spacing") || undefined,
      sun_requirement: getStr("sun_requirement") || undefined,
      days_to_germination: getStr("days_to_germination") || undefined,
      days_to_maturity: getStr("days_to_maturity") || undefined,
      source_url: source_url || undefined,
      stock_photo_url: getStr("stock_photo_url") || undefined,
      plant_description: getStr("plant_description") || undefined,
      growing_notes: getStr("growing_notes") || undefined,
    };
  } catch {
    return null;
  }
}
