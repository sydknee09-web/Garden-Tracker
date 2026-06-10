import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkDailyAiCeiling,
  getDailyLimit,
  getDailyLimitAllowlist,
  DEFAULT_DAILY_LIMIT,
  EXCLUDED_OPERATIONS,
} from "./aiDailyCeiling";

const mockGetSupabaseAdmin = vi.hoisted(() => vi.fn());
const mockLogApiUsageAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));
vi.mock("@/lib/logApiUsage", () => ({ logApiUsageAsync: mockLogApiUsageAsync }));

/** Chainable query mock resolving to the given count/error. Records neq filters. */
function makeAdminWithCount(count: number | null, error: { message: string } | null = null) {
  const neqCalls: Array<[string, string]> = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    neq: vi.fn((col: string, val: string) => {
      neqCalls.push([col, val]);
      return query;
    }),
    then: (resolve: (v: { count: number | null; error: { message: string } | null }) => unknown) =>
      Promise.resolve({ count, error }).then(resolve),
  };
  return { admin: { from: vi.fn(() => query) }, query, neqCalls };
}

describe("checkDailyAiCeiling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_DAILY_LIMIT_PER_USER;
    delete process.env.GEMINI_DAILY_LIMIT_ALLOWLIST;
  });

  afterEach(() => {
    delete process.env.GEMINI_DAILY_LIMIT_PER_USER;
    delete process.env.GEMINI_DAILY_LIMIT_ALLOWLIST;
  });

  it("allows when under the limit and reports usage", async () => {
    const { admin } = makeAdminWithCount(5);
    mockGetSupabaseAdmin.mockReturnValue(admin);
    const out = await checkDailyAiCeiling("user-1");
    expect(out).toEqual({ allowed: true, used: 5, limit: DEFAULT_DAILY_LIMIT });
    expect(mockLogApiUsageAsync).not.toHaveBeenCalled();
  });

  it("blocks at the limit and logs a daily-cap-hit audit row", async () => {
    const { admin } = makeAdminWithCount(DEFAULT_DAILY_LIMIT);
    mockGetSupabaseAdmin.mockReturnValue(admin);
    const out = await checkDailyAiCeiling("user-1");
    expect(out.allowed).toBe(false);
    expect(out.used).toBe(DEFAULT_DAILY_LIMIT);
    expect(mockLogApiUsageAsync).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "gemini",
      operation: "daily-cap-hit",
      metadata: { limit: DEFAULT_DAILY_LIMIT, used: DEFAULT_DAILY_LIMIT },
    });
  });

  it("honors GEMINI_DAILY_LIMIT_PER_USER override", async () => {
    process.env.GEMINI_DAILY_LIMIT_PER_USER = "3";
    const { admin } = makeAdminWithCount(3);
    mockGetSupabaseAdmin.mockReturnValue(admin);
    const out = await checkDailyAiCeiling("user-1");
    expect(out.allowed).toBe(false);
    expect(out.limit).toBe(3);
  });

  it("bypasses the ceiling for allowlisted users without querying", async () => {
    process.env.GEMINI_DAILY_LIMIT_ALLOWLIST = "user-syd, user-dev";
    const out = await checkDailyAiCeiling("user-syd");
    expect(out.allowed).toBe(true);
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("fails open when the admin client is unavailable", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);
    const out = await checkDailyAiCeiling("user-1");
    expect(out).toEqual({ allowed: true, used: null, limit: DEFAULT_DAILY_LIMIT });
  });

  it("fails open when the count query errors", async () => {
    const { admin } = makeAdminWithCount(null, { message: "boom" });
    mockGetSupabaseAdmin.mockReturnValue(admin);
    const out = await checkDailyAiCeiling("user-1");
    expect(out.allowed).toBe(true);
    expect(out.used).toBeNull();
  });

  it("excludes dev-tool and cap-marker operations from the count", async () => {
    const { admin, neqCalls } = makeAdminWithCount(0);
    mockGetSupabaseAdmin.mockReturnValue(admin);
    await checkDailyAiCeiling("user-1");
    expect(neqCalls).toEqual(EXCLUDED_OPERATIONS.map((op) => ["operation", op]));
  });
});

describe("getDailyLimit / getDailyLimitAllowlist", () => {
  beforeEach(() => {
    delete process.env.GEMINI_DAILY_LIMIT_PER_USER;
    delete process.env.GEMINI_DAILY_LIMIT_ALLOWLIST;
  });

  it("falls back to the default on missing or invalid env values", () => {
    expect(getDailyLimit()).toBe(DEFAULT_DAILY_LIMIT);
    process.env.GEMINI_DAILY_LIMIT_PER_USER = "not-a-number";
    expect(getDailyLimit()).toBe(DEFAULT_DAILY_LIMIT);
    process.env.GEMINI_DAILY_LIMIT_PER_USER = "0";
    expect(getDailyLimit()).toBe(DEFAULT_DAILY_LIMIT);
    process.env.GEMINI_DAILY_LIMIT_PER_USER = "250";
    expect(getDailyLimit()).toBe(250);
  });

  it("parses the allowlist as trimmed comma-separated ids", () => {
    expect(getDailyLimitAllowlist().size).toBe(0);
    process.env.GEMINI_DAILY_LIMIT_ALLOWLIST = " a , b ,, c";
    expect([...getDailyLimitAllowlist()]).toEqual(["a", "b", "c"]);
  });
});
