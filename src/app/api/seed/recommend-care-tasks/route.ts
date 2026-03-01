import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseUser } from "@/app/api/import/auth";
import { logApiError } from "@/lib/apiErrorLog";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 30;

const CARE_PROMPT = `Using Google Search Grounding, find reliable gardening care information for this plant.

Return 2-4 recommended care tasks. EXCLUDE watering. Include: fertilizing, pruning, mulching, pest control (spray), repotting, harvesting (for fruiting plants), etc.

For each task return JSON with:
- title: short label (e.g. "Fertilize with balanced fertilizer")
- category: one of fertilize, prune, mulch, spray, repot, harvest, other
- recurrence_type: "interval" | "monthly" | "yearly" | "one_off"
- interval_days: number for interval (e.g. 30 for monthly) or one_off (days after planting, e.g. 30), null for monthly/yearly
- notes: 1-2 sentence tip, easy to understand

Return ONLY valid JSON in this format:
{
  "tasks": [
    { "title": "...", "category": "fertilize", "recurrence_type": "interval", "interval_days": 30, "notes": "..." },
    ...
  ]
}

Keep it simple. Not too detailed. User will approve or reject each.`;

const VALID_CATEGORIES = ["fertilize", "prune", "mulch", "spray", "repot", "harvest", "other"] as const;
const VALID_RECURRENCE = ["interval", "monthly", "yearly", "one_off"] as const;

export type CareSuggestionPayload = {
  title: string;
  category: string;
  recurrence_type: string;
  interval_days: number | null;
  notes: string | null;
};

export type RecommendCareTasksResponse = {
  suggestions: CareSuggestionPayload[];
  error?: string;
};

export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth?.user?.id) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const body = (await req.json()) as {
      plant_profile_id?: string;
      name?: string;
      variety?: string;
      profile_type?: "seed" | "permanent";
    };
    const profileId = typeof body?.plant_profile_id === "string" ? body.plant_profile_id.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const variety = typeof body?.variety === "string" ? body.variety.trim() : "";
    const profileType = body?.profile_type === "permanent" ? "permanent" : "seed";

    if (!profileId || !name) {
      return NextResponse.json({ error: "plant_profile_id and name required" }, { status: 400 });
    }

    // Verify user owns the profile
    const { data: profile } = await auth.supabase
      .from("plant_profiles")
      .select("id, user_id")
      .eq("id", profileId)
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found or access denied" }, { status: 404 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const searchQuery = [name, variety, profileType === "permanent" ? "perennial care" : "annual care"]
      .filter(Boolean)
      .join(" ");
    const prompt = `${CARE_PROMPT}\n\nPlant: ${searchQuery}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text?.trim();
    if (!text) {
      return NextResponse.json(
        { suggestions: [], error: "No response from AI" } satisfies RecommendCareTasksResponse,
        { status: 200 }
      );
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { suggestions: [], error: "Could not parse AI response" } satisfies RecommendCareTasksResponse,
        { status: 200 }
      );
    }

    let parsed: { tasks?: unknown[] };
    try {
      parsed = JSON.parse(jsonMatch[0]) as { tasks?: unknown[] };
    } catch {
      return NextResponse.json(
        { suggestions: [], error: "Invalid JSON from AI" } satisfies RecommendCareTasksResponse,
        { status: 200 }
      );
    }

    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const validTasks: CareSuggestionPayload[] = [];
    for (const t of rawTasks) {
      if (!t || typeof t !== "object") continue;
      const obj = t as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title.trim() : "";
      if (!title) continue;
      const category = VALID_CATEGORIES.includes((obj.category as string) as (typeof VALID_CATEGORIES)[number])
        ? (obj.category as string)
        : "other";
      const recurrence_type = VALID_RECURRENCE.includes((obj.recurrence_type as string) as (typeof VALID_RECURRENCE)[number])
        ? (obj.recurrence_type as string)
        : "interval";
      let interval_days: number | null = null;
      if (recurrence_type === "interval" && typeof obj.interval_days === "number" && obj.interval_days > 0) {
        interval_days = Math.min(365, Math.round(obj.interval_days));
      } else if (recurrence_type === "interval") {
        interval_days = 30;
      } else if (recurrence_type === "one_off" && typeof obj.interval_days === "number" && obj.interval_days > 0) {
        interval_days = Math.min(365, Math.round(obj.interval_days));
      } else if (recurrence_type === "one_off") {
        interval_days = 30;
      }
      const notes = typeof obj.notes === "string" && obj.notes.trim() ? obj.notes.trim() : null;
      validTasks.push({ title, category, recurrence_type, interval_days, notes });
      if (validTasks.length >= 4) break;
    }

    if (validTasks.length === 0) {
      return NextResponse.json(
        { suggestions: [], error: "No valid tasks from AI" } satisfies RecommendCareTasksResponse,
        { status: 200 }
      );
    }

    const inserts = validTasks.map((t) => ({
      plant_profile_id: profileId,
      user_id: auth.user.id,
      title: t.title,
      category: t.category,
      recurrence_type: t.recurrence_type,
      interval_days: t.interval_days,
      notes: t.notes,
    }));

    const { data: inserted, error: insertErr } = await auth.supabase
      .from("care_schedule_suggestions")
      .insert(inserts)
      .select("id, title, category, recurrence_type, interval_days, notes");

    if (insertErr) {
      logApiError("recommend-care-tasks-insert", insertErr);
      return NextResponse.json(
        { suggestions: [], error: insertErr.message } satisfies RecommendCareTasksResponse,
        { status: 500 }
      );
    }

    logApiUsageAsync({ userId: auth.user.id, provider: "gemini", operation: "recommend-care-tasks" });

    return NextResponse.json({
      suggestions: (inserted ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        recurrence_type: r.recurrence_type,
        interval_days: r.interval_days,
        notes: r.notes,
      })),
    } satisfies RecommendCareTasksResponse & { suggestions: Array<CareSuggestionPayload & { id: string }> });
  } catch (e) {
    logApiError("recommend-care-tasks", e);
    return NextResponse.json(
      { suggestions: [], error: e instanceof Error ? e.message : "Unknown error" } satisfies RecommendCareTasksResponse,
      { status: 500 }
    );
  }
}
