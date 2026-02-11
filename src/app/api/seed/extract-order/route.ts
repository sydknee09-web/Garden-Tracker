import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

export type OrderLineItem = {
  name: string;
  variety: string;
  vendor: string;
  quantity: number;
  price?: string;
};

export type ExtractOrderResponse = {
  items: OrderLineItem[];
  vendor: string;
  error?: string;
};

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_KEY ?? "";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { imageBase64?: string; mimeType?: string };
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return NextResponse.json({ items: [], vendor: "", error: "No image provided" }, { status: 400 });
    }

    if (!GEMINI_KEY) {
      return NextResponse.json({ items: [], vendor: "", error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are analyzing a seed order confirmation screenshot or email. Extract ALL individual seed/plant line items from this order.

For each item, extract:
- "name": The plant type (e.g. "Tomato", "Pepper", "Basil")
- "variety": The specific variety name (e.g. "Cherokee Purple", "Sweet Banana")
- "quantity": Number of packets ordered (default 1 if not visible)
- "price": Price per item if visible (e.g. "$3.50")

Also extract the overall vendor/company name from the order.

Return ONLY valid JSON in this exact format:
{
  "vendor": "Company Name",
  "items": [
    { "name": "Plant Type", "variety": "Variety Name", "quantity": 1, "price": "$3.50" },
    { "name": "Plant Type 2", "variety": "Variety Name 2", "quantity": 2, "price": "$4.00" }
  ]
}

Important:
- Separate plant type from variety (e.g. "Cherokee Purple Tomato" -> name: "Tomato", variety: "Cherokee Purple")
- If you can't determine the plant type, use "Unknown"
- If there are no recognizable seed/plant items, return an empty items array
- Do NOT include non-seed items (shipping, tools, etc.)
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
    // Strip markdown fences if present
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

    const items: OrderLineItem[] = rawItems
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .map((item) => ({
        name: typeof item.name === "string" ? item.name.trim() : "Unknown",
        variety: typeof item.variety === "string" ? item.variety.trim() : "",
        vendor,
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        price: typeof item.price === "string" ? item.price : undefined,
      }))
      .filter((item) => item.name !== "Unknown" || item.variety !== "");

    return NextResponse.json({ items, vendor } satisfies ExtractOrderResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ items: [], vendor: "", error: msg } satisfies ExtractOrderResponse, { status: 500 });
  }
}
