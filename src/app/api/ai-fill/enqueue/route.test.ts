import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetSupabaseUser = vi.hoisted(() => vi.fn());
/** Promises handed to waitUntil — tests await them to run the background continuation. */
const waitUntilPromises = vi.hoisted(() => [] as Promise<unknown>[]);

vi.mock("@/app/api/import/auth", () => ({
  getSupabaseUser: mockGetSupabaseUser,
  unauthorized: () =>
    new Response(JSON.stringify({ error: "Authorization required." }), { status: 401 }),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: (p: Promise<unknown>) => {
    waitUntilPromises.push(p);
  },
}));

type DbOptions = {
  profile?: Record<string, unknown> | null;
  existingActive?: Record<string, unknown> | null;
  insertError?: { code?: string; message: string } | null;
};

/**
 * Per-table chain mock. Records job inserts/updates so tests can assert the
 * background continuation wrote the completion row.
 */
function makeDb(opts: DbOptions = {}) {
  const profile =
    opts.profile === undefined
      ? { id: "profile-1", name: "Tomato", variety_name: "Cherokee Purple" }
      : opts.profile;
  const jobInserts: Record<string, unknown>[] = [];
  const jobUpdates: Record<string, unknown>[] = [];
  /** plant_profiles update patches — records the hero_image_pending reset write. */
  const profileUpdates: Record<string, unknown>[] = [];

  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
    update: vi.fn((patch: Record<string, unknown>) => {
      profileUpdates.push(patch);
      return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    }),
  };

  const makeJobsChain = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.existingActive ?? null, error: null }),
    insert: vi.fn((row: Record<string, unknown>) => {
      jobInserts.push(row);
      return {
        select: () => ({
          single: () =>
            Promise.resolve(
              opts.insertError
                ? { data: null, error: opts.insertError }
                : { data: { id: "job-1" }, error: null }
            ),
        }),
      };
    }),
    update: vi.fn((patch: Record<string, unknown>) => {
      jobUpdates.push(patch);
      return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    }),
  });

  const from = vi.fn((table: string) => (table === "plant_profiles" ? profileChain : makeJobsChain()));
  return {
    auth: { user: { id: "user-1" }, supabase: { from } },
    jobInserts,
    jobUpdates,
    profileUpdates,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ai-fill/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}

async function flushBackground() {
  await Promise.all(waitUntilPromises.splice(0));
}

describe("POST /api/ai-fill/enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitUntilPromises.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, enriched: true, fieldsFilled: 5 }), { status: 200 })
      )
    );
  });

  it("401s without auth", async () => {
    mockGetSupabaseUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ profileId: "profile-1" }));
    expect(res.status).toBe(401);
  });

  it("400s without profileId", async () => {
    mockGetSupabaseUser.mockResolvedValue(makeDb().auth);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("404s when the profile isn't the user's", async () => {
    mockGetSupabaseUser.mockResolvedValue(makeDb({ profile: null }).auth);
    const res = await POST(makeRequest({ profileId: "profile-1" }));
    expect(res.status).toBe(404);
  });

  it("returns the existing job instead of double-running (one active job per profile)", async () => {
    const db = makeDb({ existingActive: { id: "job-already", status: "running" } });
    mockGetSupabaseUser.mockResolvedValue(db.auth);
    const res = await POST(makeRequest({ profileId: "profile-1" }));
    const data = await res.json();
    expect(data).toEqual({ jobId: "job-already", alreadyRunning: true });
    expect(db.jobInserts).toHaveLength(0);
  });

  it("enqueues, returns immediately, and the background continuation runs the pipeline + writes completion", async () => {
    const db = makeDb();
    mockGetSupabaseUser.mockResolvedValue(db.auth);

    const res = await POST(makeRequest({ profileId: "profile-1" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.jobId).toBe("job-1");
    expect(db.jobInserts[0]).toMatchObject({ user_id: "user-1", plant_profile_id: "profile-1", status: "pending", overwrite: false });
    // running mark happened before the response
    expect(db.jobUpdates[0]).toMatchObject({ status: "running" });

    await flushBackground();

    // Pipeline self-fetch: byte-identical body to the old foreground Fill Blanks handler.
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/seed\/fill-blanks-for-profile$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body as string)).toEqual({ profileId: "profile-1", useGemini: true, forceRefresh: true });

    const completion = db.jobUpdates[1];
    expect(completion).toMatchObject({ status: "complete" });
    expect(completion.result_summary).toMatchObject({ fieldsFilled: 5, enriched: true, plantName: "Cherokee Purple" });
    expect(completion.completed_at).toBeTruthy();

    // Hero lifecycle: the job worker resets hero_image_pending=false so the
    // creation-path card "Researching…" pulse clears (item 4).
    expect(db.profileUpdates).toContainEqual({ hero_image_pending: false });
  });

  it("forwards overwrite mode to the job row and the pipeline body", async () => {
    const db = makeDb();
    mockGetSupabaseUser.mockResolvedValue(db.auth);
    await POST(makeRequest({ profileId: "profile-1", overwrite: true }));
    expect(db.jobInserts[0]).toMatchObject({ overwrite: true });
    await flushBackground();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ overwrite: true });
  });

  it("marks the job failed when the pipeline errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "DAILY_AI_LIMIT" }), { status: 429 }))
    );
    const db = makeDb();
    mockGetSupabaseUser.mockResolvedValue(db.auth);
    await POST(makeRequest({ profileId: "profile-1" }));
    await flushBackground();
    const completion = db.jobUpdates[1];
    expect(completion).toMatchObject({ status: "failed" });
    expect(completion.result_summary).toMatchObject({ error: "DAILY_AI_LIMIT", plantName: "Cherokee Purple" });
    // Reset must run on failure too (finally), or the card pulse strands forever.
    expect(db.profileUpdates).toContainEqual({ hero_image_pending: false });
  });

  it("recovers the winner job on an insert unique-violation race", async () => {
    const db = makeDb({ insertError: { code: "23505", message: "duplicate key" } });
    // After the failed insert, the route re-selects the active job — return one.
    let selectCalls = 0;
    const origFrom = db.auth.supabase.from as ReturnType<typeof vi.fn>;
    const baseImpl = origFrom.getMockImplementation()!;
    origFrom.mockImplementation((table: string) => {
      const chain = baseImpl(table) as Record<string, unknown>;
      if (table === "ai_fill_jobs") {
        (chain as { maybeSingle: ReturnType<typeof vi.fn> }).maybeSingle = vi.fn(() => {
          selectCalls += 1;
          // 1st select: no active job (pre-insert check); 2nd: the race winner.
          return Promise.resolve({ data: selectCalls >= 2 ? { id: "job-winner", status: "running" } : null, error: null });
        });
      }
      return chain;
    });
    mockGetSupabaseUser.mockResolvedValue(db.auth);
    const res = await POST(makeRequest({ profileId: "profile-1" }));
    const data = await res.json();
    expect(data).toEqual({ jobId: "job-winner", alreadyRunning: true });
  });
});
