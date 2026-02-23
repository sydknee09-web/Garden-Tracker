import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabaseUser } from "@/app/api/import/auth";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 60;

export type SupplyOrderLineItem = {
  name: string;
  brand: string;
  category: string;
  npk: string;
  application_rate: string;
  usage_instructions: string;
  vendor: string;
  quantity: number;
  price?: string;
};

export type SupplyExtractOrderResponse = {
  items: SupplyOrderLineItem[];
  vendor: string;
  error?: string;
};

const GEMINI_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ??
  process.env.GEMINI_API_KEY?.trim() ??
  process.env.GOOGLE_AI_KEY ??
  "";

const VALID_CATEGORIES = ["fertilizer", "pesticide", "soil_amendment", "other"] as const;

export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    const body = (await req.json()) as { imageBase64?: string; mimeType?: string };
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ items: [], vendor: "", error: "No image provided" }, { status: 400 });
    }

    if (!GEMINI_KEY) {
      return NextResponse.json({ items: [], vendor: "", error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are analyzing a garden supply order confirmation, order details screen, cart screenshot, or receipt (e.g. from Walmart, Amazon, or garden retailers). Extract ALL individual garden supply line items: fertilizers, pesticides, soil amendments, compost, mulch, plant food, gypsum, diatomaceous earth, etc.

For each item, extract:
- "name": Product name (e.g. "Fish Emulsion 5-1-1", "Neem Oil", "Compost")
- "brand": Manufacturer or brand (e.g. "Monterey", "Espoma", "Garden Safe")
- "category": One of "fertilizer", "pesticide", "soil_amendment", "other"
- "npk": N-P-K ratio if visible (e.g. "5-1-1", "10-10-10", empty string if not found)
- "application_rate": Dosage if visible (e.g. "1 tbsp per gallon")
- "usage_instructions": Brief usage notes if visible
- "quantity": Number of units ordered (default 1 if not visible)
- "price": Price per item if visible (e.g. "$12.99")
- "vendor": Per-item vendor if shown (e.g. "Sold and shipped by Esbenshades Garden Center"); otherwise use overall order vendor

Also extract the overall vendor/company name (e.g. from "Sold and shipped by X" or the store name).

Return ONLY valid JSON in this exact format:
{
  "vendor": "Company Name",
  "items": [
    { "name": "Product Name", "brand": "Brand", "category": "fertilizer", "npk": "5-1-1", "application_rate": "", "usage_instructions": "", "vendor": "Company Name", "quantity": 1, "price": "$12.99" }
  ]
}

Important:
- Include ALL garden supplies (fertilizers, pesticides, soil amendments, compost, mulch, gypsum, plant food, insect killers). Exclude seeds, plants, tools, non-garden items.
- Product names may be long (e.g. "Monterey Concentrate Nutra Green All Purpose Fertilizer 5-10-5 + Micro - 1 Quart") - include the full name.
- If you can't determine category, use "other"
- Use empty string for npk, application_rate, usage_instructions if not found
- If there are no recognizable supply items, return an empty items array
- Return ONLY the JSON object, no markdown or explanation`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: imageBase64,
        },
      },
    ]);

    const text = result.response.text().trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: { vendor?: string; items?: unknown[] };
    try {
      parsed = JSON.parse(jsonStr) as { vendor?: string; items?: unknown[] };
    } catch {
      return NextResponse.json(
        { items: [], vendor: "", error: "Could not parse AI response" },
        { status: 200 }
      );
    }

    const vendor = typeof parsed.vendor === "string" ? parsed.vendor.trim() : "";
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const items: SupplyOrderLineItem[] = rawItems
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .map((item) => {
        const cat = typeof item.category === "string" ? item.category.toLowerCase().trim() : "";
        const validCat = VALID_CATEGORIES.includes(cat as (typeof VALID_CATEGORIES)[number]) ? cat : "other";
        return {
          name: typeof item.name === "string" ? item.name.trim() : "Imported supply",
          brand: typeof item.brand === "string" ? item.brand.trim() : "",
          category: validCat,
          npk: typeof item.npk === "string" ? item.npk.trim() : "",
          application_rate: typeof item.application_rate === "string" ? item.application_rate.trim() : "",
          usage_instructions: typeof item.usage_instructions === "string" ? item.usage_instructions.trim() : "",
          vendor: typeof item.vendor === "string" ? item.vendor.trim() : vendor,
          quantity: typeof item.quantity === "number" ? item.quantity : 1,
          price: typeof item.price === "string" ? item.price : undefined,
        };
      })
      .filter((item) => item.name && item.name !== "Imported supply");

    if (auth?.user?.id) {
      logApiUsageAsync({ userId: auth.user.id, provider: "gemini", operation: "supply-extract-order" });
    }
    return NextResponse.json({ items, vendor } satisfies SupplyExtractOrderResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { items: [], vendor: "", error: msg } satisfies SupplyExtractOrderResponse,
      { status: 500 }
    );
  }
}
