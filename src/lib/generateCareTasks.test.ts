import { describe, it, expect, vi, beforeEach } from "vitest";

const capturedInserts: Array<Record<string, unknown>> = [];
let mockTemplates: Array<Record<string, unknown>> = [];

const mockFrom = vi.hoisted(() =>
  vi.fn(() => {
    const selectChain: Record<string, unknown> = {};
    selectChain.eq = vi.fn(() => selectChain);
    selectChain.is = vi.fn(() => Promise.resolve({ data: mockTemplates, error: null }));
    return {
      select: vi.fn(() => selectChain),
      insert: vi.fn((payload: Record<string, unknown>) => {
        capturedInserts.push(payload);
        return Promise.resolve({ error: null });
      }),
    };
  })
);

vi.mock("@/lib/supabase", () => ({ supabase: { from: mockFrom } }));

import { getEffectiveInstanceIds, copyCareTemplatesToInstance } from "./generateCareTasks";

describe("getEffectiveInstanceIds", () => {
  it("returns grow_instance_ids when non-empty", () => {
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["a", "b"] })).toEqual(["a", "b"]);
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["x"] })).toEqual(["x"]);
  });

  it("dedupes grow_instance_ids", () => {
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["a", "a", "b"] })).toEqual(["a", "b"]);
  });

  it("returns [grow_instance_id] when grow_instance_ids is null/empty and grow_instance_id is set", () => {
    expect(getEffectiveInstanceIds({ grow_instance_id: "single-id" })).toEqual(["single-id"]);
    expect(getEffectiveInstanceIds({ grow_instance_ids: null, grow_instance_id: "x" })).toEqual(["x"]);
    expect(getEffectiveInstanceIds({ grow_instance_ids: [], grow_instance_id: "y" })).toEqual(["y"]);
  });

  it("returns null when both are null/empty (all plants)", () => {
    expect(getEffectiveInstanceIds({})).toBeNull();
    expect(getEffectiveInstanceIds({ grow_instance_ids: null, grow_instance_id: null })).toBeNull();
    expect(getEffectiveInstanceIds({ grow_instance_ids: [] })).toBeNull();
  });

  it("prefers grow_instance_ids over grow_instance_id when both set", () => {
    expect(getEffectiveInstanceIds({ grow_instance_ids: ["a", "b"], grow_instance_id: "x" })).toEqual(["a", "b"]);
  });
});

describe("copyCareTemplatesToInstance", () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    mockTemplates = [];
    vi.clearAllMocks();
  });

  it("copies supply_profile_id, end_date, and source_template_id from template to instance schedule", async () => {
    mockTemplates = [
      {
        id: "tmpl-1",
        title: "Water weekly",
        category: "water",
        recurrence_type: "interval",
        interval_days: 7,
        months: null,
        day_of_month: null,
        custom_dates: null,
        notes: "use rainwater",
        supply_profile_id: "supply-1",
        end_date: "2026-10-15",
      },
    ];

    await copyCareTemplatesToInstance("profile-1", "instance-1", "user-1", "2026-05-29");

    expect(capturedInserts).toHaveLength(1);
    const payload = capturedInserts[0]!;
    expect(payload.source_template_id).toBe("tmpl-1");
    expect(payload.supply_profile_id).toBe("supply-1");
    expect(payload.end_date).toBe("2026-10-15");
    expect(payload.plant_profile_id).toBe("profile-1");
    expect(payload.grow_instance_id).toBe("instance-1");
    expect(payload.user_id).toBe("user-1");
    expect(payload.is_template).toBe(false);
    expect(payload.is_active).toBe(true);
    expect(payload.title).toBe("Water weekly");
    expect(payload.notes).toBe("use rainwater");
  });

  it("passes through null supply_profile_id and end_date when template has none", async () => {
    mockTemplates = [
      {
        id: "tmpl-2",
        title: "Fertilize monthly",
        category: "fertilize",
        recurrence_type: "monthly",
        interval_days: null,
        months: null,
        day_of_month: 15,
        custom_dates: null,
        notes: null,
        supply_profile_id: null,
        end_date: null,
      },
    ];

    await copyCareTemplatesToInstance("profile-2", "instance-2", "user-1", "2026-05-29");

    expect(capturedInserts).toHaveLength(1);
    const payload = capturedInserts[0]!;
    expect(payload.source_template_id).toBe("tmpl-2");
    expect(payload.supply_profile_id).toBeNull();
    expect(payload.end_date).toBeNull();
  });

  it("copies fields for every template when multiple are present", async () => {
    mockTemplates = [
      {
        id: "tmpl-a",
        title: "A",
        category: "water",
        recurrence_type: "interval",
        interval_days: 3,
        months: null,
        day_of_month: null,
        custom_dates: null,
        notes: null,
        supply_profile_id: "sup-a",
        end_date: null,
      },
      {
        id: "tmpl-b",
        title: "B",
        category: "fertilize",
        recurrence_type: "interval",
        interval_days: 14,
        months: null,
        day_of_month: null,
        custom_dates: null,
        notes: null,
        supply_profile_id: null,
        end_date: "2026-09-01",
      },
    ];

    await copyCareTemplatesToInstance("profile-3", "instance-3", "user-1", "2026-05-29");

    expect(capturedInserts).toHaveLength(2);
    expect(capturedInserts[0]!.source_template_id).toBe("tmpl-a");
    expect(capturedInserts[0]!.supply_profile_id).toBe("sup-a");
    expect(capturedInserts[1]!.source_template_id).toBe("tmpl-b");
    expect(capturedInserts[1]!.end_date).toBe("2026-09-01");
  });
});
