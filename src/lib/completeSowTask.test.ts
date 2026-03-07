import { describe, it, expect, vi, beforeEach } from "vitest";
import { completeTask } from "./completeSowTask";

const mockEq2 = vi.fn(() => Promise.resolve({ error: null }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ eq: mockEq1 })));
const mockFrom = vi.hoisted(() =>
  vi.fn(() => ({
    update: mockUpdate,
    eq: vi.fn().mockReturnThis(),
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }))
);

vi.mock("@/lib/supabase", () => ({ supabase: { from: mockFrom } }));
vi.mock("@/lib/weatherSnapshot", () => ({ fetchWeatherSnapshot: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@/lib/generateCareTasks", () => ({ advanceCareSchedule: vi.fn(() => Promise.resolve()) }));

describe("completeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq2.mockResolvedValue({ error: null });
  });

  it("redates all tasks to today (due_date and completed_at) when completed", async () => {
    const task = {
      id: "task-1",
      plant_profile_id: null,
      category: "water",
      due_date: "2025-03-10",
      completed_at: null,
      grow_instance_id: null,
      care_schedule_id: "sched-1",
    };
    const userId = "user-1";

    await completeTask(task, userId);

    expect(mockFrom).toHaveBeenCalledWith("tasks");
    const updateCall = mockUpdate.mock.calls[0];
    expect(updateCall).toBeDefined();
    const [updates] = updateCall;
    expect(updates).toHaveProperty("due_date");
    expect(updates).toHaveProperty("completed_at");
    expect(updates.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(updates.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const today = new Date().toISOString().slice(0, 10);
    expect(updates.due_date).toBe(today);
  });

  it("does nothing when task already completed", async () => {
    const task = {
      id: "task-2",
      plant_profile_id: null,
      category: "fertilize",
      due_date: "2025-03-05",
      completed_at: "2025-03-05T14:00:00Z",
      grow_instance_id: null,
    };
    const userId = "user-1";

    await completeTask(task, userId);

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
