import { NextResponse } from "next/server";

export const maxDuration = 30;

export type OcrExtractResponse = {
  vendor: string | null;
  plantType: string | null;
  variety: string | null;
  /** ISO date YYYY-MM-DD derived from packet year (e.g. 2026 → 2026-01-01), or null if not found. */
  purchaseDate: string | null;
};

const SYSTEM_PROMPT = `You are a seed packet label parser. Given raw OCR text from a seed packet photo, extract exactly four fields. Return ONLY valid JSON with these keys (use empty string or 0 if not found):
- vendor: The seed company or brand (e.g. "Baker Creek", "Johnny's Seeds"). Omit "Packed for" distributors; use the actual seed brand if visible.
- plantType: The plant type or species (e.g. "Tomato", "Lettuce", "Kale").
- variety: The variety or cultivar name (e.g. "Brandywine", "Buttercrunch", "Early Prolific Straightneck"). Include the full variety name; do not truncate. Leave empty if the packet only shows a plant type with no variety.
- purchaseYear: A 4-digit year number if visible on the packet (e.g. 2025, 2026). Look for phrases like "Packed for 2026", "Sell by 2026", "Packed for season 2026", or a standalone year near the bottom. Use 0 if no year is found.`;

const VISION_SYSTEM_PROMPT = `You are a seed packet label parser. Look at the seed packet image and extract exactly four fields from the visible text. Return ONLY valid JSON with these keys (use empty string or 0 if not found):
- vendor: The seed company or brand (e.g. "Baker Creek", "Mary's Heirloom Seeds"). Omit "Packed for" distributors; use the actual seed brand if visible.
- plantType: The plant type or species (e.g. "Tomato", "Squash", "Kale").
- variety: The full variety or cultivar name (e.g. "Early Prolific Straightneck", "Brandywine"). Do not truncate; include the complete variety name as shown on the packet.
- purchaseYear: A 4-digit year number if visible (e.g. 2025, 2026). Look for "Packed for", "Sell by", or "Packed for season" followed by a year, or a year printed on the packet. Use 0 if no year is found.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ocrText = typeof body?.ocrText === "string" ? body.ocrText.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (!ocrText && !imageUrl) {
      return NextResponse.json(
        { vendor: null, plantType: null, variety: null, purchaseDate: null },
        { status: 200 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 503 }
      );
    }

    let userContent: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
    let systemContent = SYSTEM_PROMPT;

    if (imageUrl) {
      systemContent = VISION_SYSTEM_PROMPT;
      userContent = [
        { type: "text" as const, text: "Extract vendor, plant type, variety, and purchaseYear (4-digit year from 'Packed for' or 'Sell by' if visible) from this seed packet image. Return only valid JSON with keys: vendor, plantType, variety, purchaseYear." },
        { type: "image_url" as const, image_url: { url: imageUrl } },
      ];
    } else {
      userContent = `Extract vendor, plant type, variety, and purchaseYear (4-digit year from "Packed for" or "Sell by" if present) from this seed packet OCR text. Return only valid JSON with keys: vendor, plantType, variety, purchaseYear.\n\n${ocrText}`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 256,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI OCR extract error:", res.status, errText);
      return NextResponse.json(
        { error: "Extraction service unavailable" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { vendor: null, plantType: null, variety: null, purchaseDate: null },
        { status: 200 }
      );
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const vendor = typeof parsed.vendor === "string" ? parsed.vendor.trim() || null : null;
    const plantType = typeof parsed.plantType === "string" ? parsed.plantType.trim() || null : null;
    const variety = typeof parsed.variety === "string" ? parsed.variety.trim() || null : null;
    const rawYear = parsed.purchaseYear;
    const year =
      typeof rawYear === "number" && Number.isInteger(rawYear) && rawYear >= 1990 && rawYear <= 2100
        ? rawYear
        : typeof rawYear === "string"
          ? (() => {
              const n = parseInt(rawYear.trim(), 10);
              return n >= 1990 && n <= 2100 ? n : null;
            })()
          : null;
    const purchaseDate = year != null ? `${year}-01-01` : null;

    return NextResponse.json({
      vendor: vendor ?? null,
      plantType: plantType ?? null,
      variety: variety ?? null,
      purchaseDate,
    } satisfies OcrExtractResponse);
  } catch (e) {
    console.error("OCR extract route error:", e);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
