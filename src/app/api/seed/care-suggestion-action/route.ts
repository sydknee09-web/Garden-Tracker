import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/app/api/import/auth";
import { generateCareTasks } from "@/lib/generateCareTasks";

export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth?.user?.id) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const body = (await req.json()) as { suggestion_id?: string; action?: "approve" | "reject" };
    const suggestionId = typeof body?.suggestion_id === "string" ? body.suggestion_id.trim() : "";
    const action = body?.action === "approve" || body?.action === "reject" ? body.action : null;

    if (!suggestionId || !action) {
      return NextResponse.json({ error: "suggestion_id and action (approve|reject) required" }, { status: 400 });
    }

    const { data: suggestion, error: fetchErr } = await auth.supabase
      .from("care_schedule_suggestions")
      .select("id, plant_profile_id, user_id, title, category, recurrence_type, interval_days, notes")
      .eq("id", suggestionId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (fetchErr || !suggestion) {
      return NextResponse.json({ error: "Suggestion not found or access denied" }, { status: 404 });
    }

    if (action === "reject") {
      const { error: delErr } = await auth.supabase
        .from("care_schedule_suggestions")
        .delete()
        .eq("id", suggestionId)
        .eq("user_id", auth.user.id);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, action: "reject" });
    }

    // approve: insert into care_schedules, then delete suggestion
    const today = new Date().toISOString().slice(0, 10);
    let nextDue = today;
    if (suggestion.recurrence_type === "interval" && suggestion.interval_days != null && suggestion.interval_days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + suggestion.interval_days);
      nextDue = d.toISOString().slice(0, 10);
    }

    const { error: insertErr } = await auth.supabase.from("care_schedules").insert({
      plant_profile_id: suggestion.plant_profile_id,
      user_id: auth.user.id,
      grow_instance_id: null,
      title: suggestion.title,
      category: suggestion.category,
      recurrence_type: suggestion.recurrence_type,
      interval_days: suggestion.interval_days,
      next_due_date: nextDue,
      is_active: true,
      is_template: true,
      notes: suggestion.notes,
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { error: delErr } = await auth.supabase
      .from("care_schedule_suggestions")
      .delete()
      .eq("id", suggestionId)
      .eq("user_id", auth.user.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    await generateCareTasks(auth.user.id);

    return NextResponse.json({ ok: true, action: "approve" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
