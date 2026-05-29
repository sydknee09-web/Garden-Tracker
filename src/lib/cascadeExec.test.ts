import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CareSchedule } from "@/types/garden";

type MockRow = Record<string, unknown>;

const state = {
  growInstancesRows: [] as MockRow[],
  existingCopiesRows: [] as MockRow[],
  editCascadeCopiesRows: [] as MockRow[],
  inserts: [] as MockRow[],
  updates: [] as { payload: MockRow; filters: Record<string, unknown> }[],
};

function makeGrowInstancesQuery() {
  // For .eq().eq().is().in() resolved as Promise.
  const chain: MockRow = {};
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.in = vi.fn(() => Promise.resolve({ data: state.growInstancesRows, error: null }));
  return chain;
}

function makeExistingCopiesQuery() {
  // For applyTemplateCreateCascade pre-check: .eq().eq().is() resolved
  const chain: MockRow = {};
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => Promise.resolve({ data: state.existingCopiesRows, error: null }));
  return chain;
}

function makeEditCopiesQuery() {
  // For applyTemplateEditCascade copies fetch: .eq().eq().eq().is() resolved
  const chain: MockRow = {};
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => Promise.resolve({ data: state.editCascadeCopiesRows, error: null }));
  return chain;
}

function makeUpdateChain(payload: MockRow) {
  const filters: Record<string, unknown> = {};
  const chain: MockRow = {};
  chain.eq = vi.fn((key: string, value: unknown) => {
    filters[key] = value;
    // Resolve after second .eq() since update flow uses .eq("id").eq("user_id")
    if (Object.keys(filters).length >= 2) {
      state.updates.push({ payload, filters: { ...filters } });
      return Promise.resolve({ error: null });
    }
    return chain;
  });
  return chain;
}

const careSchedulesHandler = {
  select: vi.fn((columns: string) => {
    if (columns.includes("grow_instance_id") && !columns.includes("title")) {
      return makeExistingCopiesQuery();
    }
    return makeEditCopiesQuery();
  }),
  insert: vi.fn((payload: MockRow) => {
    state.inserts.push(payload);
    return Promise.resolve({ data: null, error: null });
  }),
  update: vi.fn((payload: MockRow) => makeUpdateChain(payload)),
};

const growInstancesHandler = {
  select: vi.fn(() => makeGrowInstancesQuery()),
};

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({ supabase: { from: mockFrom } }));

beforeEach(() => {
  state.growInstancesRows = [];
  state.existingCopiesRows = [];
  state.editCascadeCopiesRows = [];
  state.inserts = [];
  state.updates = [];
  vi.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    if (table === "grow_instances") return growInstancesHandler;
    if (table === "care_schedules") return careSchedulesHandler;
    if (table === "tasks") return { update: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => ({ is: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) })) };
    return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
  });
});

import {
  applyTemplateCreateCascade,
  applyTemplateEditCascade,
  fetchEligibleInstanceIdsForProfile,
} from "./generateCareTasks";

function template(overrides: Partial<CareSchedule> = {}): CareSchedule {
  return {
    id: "tmpl-1",
    plant_profile_id: "profile-1",
    user_id: "user-1",
    title: "Water weekly",
    category: "water",
    recurrence_type: "interval",
    interval_days: 7,
    months: null,
    day_of_month: null,
    custom_dates: null,
    notes: "rainwater preferred",
    supply_profile_id: "sup-1",
    end_date: null,
    is_active: true,
    is_template: true,
    next_due_date: "2026-06-05",
    ...overrides,
  };
}

describe("fetchEligibleInstanceIdsForProfile", () => {
  it("returns ids of active instances", async () => {
    state.growInstancesRows = [{ id: "gi-a" }, { id: "gi-b" }];
    const result = await fetchEligibleInstanceIdsForProfile("profile-1", "user-1");
    expect(result).toEqual(["gi-a", "gi-b"]);
  });

  it("returns empty array when no instances", async () => {
    state.growInstancesRows = [];
    const result = await fetchEligibleInstanceIdsForProfile("profile-1", "user-1");
    expect(result).toEqual([]);
  });
});

describe("applyTemplateCreateCascade", () => {
  it("inserts one copy per eligible instance, with source_template_id set", async () => {
    state.existingCopiesRows = [];
    const result = await applyTemplateCreateCascade(template(), ["gi-a", "gi-b"], "user-1");
    expect(result).toBe(2);
    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0]!.source_template_id).toBe("tmpl-1");
    expect(state.inserts[0]!.grow_instance_id).toBe("gi-a");
    expect(state.inserts[0]!.is_template).toBe(false);
    expect(state.inserts[0]!.supply_profile_id).toBe("sup-1");
    expect(state.inserts[0]!.notes).toBe("rainwater preferred");
    expect(state.inserts[1]!.grow_instance_id).toBe("gi-b");
  });

  it("skips instances that already have a copy of this template (no double-apply)", async () => {
    state.existingCopiesRows = [{ grow_instance_id: "gi-a" }];
    const result = await applyTemplateCreateCascade(template(), ["gi-a", "gi-b"], "user-1");
    expect(result).toBe(1);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.grow_instance_id).toBe("gi-b");
  });

  it("returns 0 when no eligible instances", async () => {
    const result = await applyTemplateCreateCascade(template(), [], "user-1");
    expect(result).toBe(0);
    expect(state.inserts).toHaveLength(0);
  });

  it("returns 0 when all eligible instances already have a copy", async () => {
    state.existingCopiesRows = [{ grow_instance_id: "gi-a" }, { grow_instance_id: "gi-b" }];
    const result = await applyTemplateCreateCascade(template(), ["gi-a", "gi-b"], "user-1");
    expect(result).toBe(0);
    expect(state.inserts).toHaveLength(0);
  });
});

describe("applyTemplateEditCascade", () => {
  const oldValues = {
    title: "Water weekly",
    category: "water",
    recurrence_type: "interval",
    interval_days: 7,
    months: null,
    day_of_month: null,
    custom_dates: null,
    notes: "rainwater preferred",
    supply_profile_id: "sup-1",
    end_date: null,
  };

  it("updates copies that match the pre-edit template (not locally edited)", async () => {
    state.growInstancesRows = [{ id: "gi-a" }, { id: "gi-b" }];
    state.editCascadeCopiesRows = [
      { id: "copy-a", grow_instance_id: "gi-a", ...oldValues },
      { id: "copy-b", grow_instance_id: "gi-b", ...oldValues },
    ];
    const newTemplate = template({ interval_days: 14, notes: "use tap, not rain" });
    const result = await applyTemplateEditCascade(newTemplate, oldValues, "user-1", false);
    expect(result.updated).toBe(2);
    expect(result.skippedLocallyEdited).toBe(0);
    expect(state.updates).toHaveLength(2);
    expect(state.updates[0]!.payload.interval_days).toBe(14);
    expect(state.updates[0]!.payload.notes).toBe("use tap, not rain");
  });

  it("skips locally-edited copies by default and counts them", async () => {
    state.growInstancesRows = [{ id: "gi-a" }, { id: "gi-b" }];
    state.editCascadeCopiesRows = [
      { id: "copy-a", grow_instance_id: "gi-a", ...oldValues },
      // gi-b has been locally edited (different interval)
      { id: "copy-b", grow_instance_id: "gi-b", ...oldValues, interval_days: 10 },
    ];
    const newTemplate = template({ interval_days: 14 });
    const result = await applyTemplateEditCascade(newTemplate, oldValues, "user-1", false);
    expect(result.updated).toBe(1);
    expect(result.skippedLocallyEdited).toBe(1);
    expect(state.updates).toHaveLength(1);
  });

  it("force-overwrites locally-edited copies when forceOverwrite=true", async () => {
    state.growInstancesRows = [{ id: "gi-a" }, { id: "gi-b" }];
    state.editCascadeCopiesRows = [
      { id: "copy-a", grow_instance_id: "gi-a", ...oldValues },
      { id: "copy-b", grow_instance_id: "gi-b", ...oldValues, interval_days: 10 },
    ];
    const newTemplate = template({ interval_days: 14 });
    const result = await applyTemplateEditCascade(newTemplate, oldValues, "user-1", true);
    expect(result.updated).toBe(2);
    expect(result.skippedLocallyEdited).toBe(0);
    expect(state.updates).toHaveLength(2);
  });

  it("skips copies whose grow_instance is not in the eligible set (archived/dead/deleted)", async () => {
    state.growInstancesRows = [{ id: "gi-a" }]; // gi-b excluded (e.g., archived)
    state.editCascadeCopiesRows = [
      { id: "copy-a", grow_instance_id: "gi-a", ...oldValues },
      { id: "copy-b", grow_instance_id: "gi-b", ...oldValues },
    ];
    const newTemplate = template({ interval_days: 14 });
    const result = await applyTemplateEditCascade(newTemplate, oldValues, "user-1", false);
    expect(result.updated).toBe(1);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]!.filters.id).toBe("copy-a");
  });

  it("returns zero counts when no eligible instances exist", async () => {
    state.growInstancesRows = [];
    state.editCascadeCopiesRows = [];
    const newTemplate = template({ interval_days: 14 });
    const result = await applyTemplateEditCascade(newTemplate, oldValues, "user-1", false);
    expect(result.updated).toBe(0);
    expect(result.skippedLocallyEdited).toBe(0);
  });
});
