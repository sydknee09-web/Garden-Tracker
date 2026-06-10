import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { researchVariety as mockResearchVariety } from "@/app/api/seed/extract/route";

const mockGetSupabaseUser = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/app/api/import/auth", () => ({
  getSupabaseUser: mockGetSupabaseUser,
  unauthorized: () =>
    new Response(JSON.stringify({ error: "Authorization required." }), { status: 401 }),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  DEFAULT_RATE_LIMIT: { maxRequests: 10, windowMs: 60_000 },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@/app/api/seed/extract/route", () => ({
  researchVariety: vi.fn().mockResolvedValue(null),
}));

function makeSupabaseWithNullLibrary() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    user: { id: "user-1" },
    supabase: {
      from: vi.fn(() => chain),
    },
  };
}

/**
 * Per-table mock factory. Routes from(table) to a table-specific chain so we can
 * make user_settings.maybeSingle() return a zone string while global_plant_library
 * returns null (forcing the AI path).
 */
function makeSupabaseWithZone(zone: string | null) {
  const userSettingsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: zone ? { planting_zone: zone } : null,
      error: null,
    }),
  };
  const libraryChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const from = vi.fn((table: string) => {
    if (table === "user_settings") return userSettingsChain;
    return libraryChain;
  });
  return {
    user: { id: "user-1" },
    supabase: { from },
    _libraryChain: libraryChain,
    _userSettingsChain: userSettingsChain,
    _from: from,
  };
}

describe("POST /api/seed/enrich-from-name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithNullLibrary());
    mockCheckRateLimit.mockReturnValue(true);
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  it("returns 400 when name is missing", async () => {
    const req = new Request("http://localhost/api/seed/enrich-from-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variety: "Cherokee Purple" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name required/i);
  });

  it("returns 400 when name is an empty string", async () => {
    const req = new Request("http://localhost/api/seed/enrich-from-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name required/i);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const req = new Request("http://localhost/api/seed/enrich-from-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tomato" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/rate/i);
  });

  it("returns 503 when Google AI API key is not configured", async () => {
    const req = new Request("http://localhost/api/seed/enrich-from-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tomato" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/api.?key|not configured/i);
  });

  describe("zone-aware enrichment (Phase 2)", () => {
    beforeEach(() => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
      // Default: researchVariety returns a usable result so we can reach the response payload.
      vi.mocked(mockResearchVariety).mockResolvedValue({
        planting_window: "Indoor sow Feb-Mar, transplant May-Jun",
        sun_requirement: "Full sun",
      });
    });

    it("passes userZone to researchVariety when user_settings has a zone", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      expect(mockResearchVariety).toHaveBeenCalledWith(
        "test-key",
        "Tomato",
        "Cherokee Purple",
        "",
        "5a"
      );
    });

    it("passes userZone undefined when user_settings has no zone", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone(null));
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      expect(mockResearchVariety).toHaveBeenCalledWith(
        "test-key",
        "Tomato",
        "Cherokee Purple",
        "",
        undefined
      );
    });

    it("skips library lookup when zone is non-10b", async () => {
      const ctx = makeSupabaseWithZone("5a");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      // user_settings was consulted; global_plant_library was NOT.
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      expect(tablesConsulted).toContain("user_settings");
      expect(tablesConsulted).not.toContain("global_plant_library");
    });

    it("keeps library lookup when zone is 10b", async () => {
      const ctx = makeSupabaseWithZone("10b");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      expect(tablesConsulted).toContain("user_settings");
      expect(tablesConsulted).toContain("global_plant_library");
    });

    it("response includes zoneUsed field reflecting the server-read zone", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.enriched).toBe(true);
      expect(data.zoneUsed).toBe("5a");
    });

    it("forceRefresh:true bypasses the library cache even at zone 10b", async () => {
      const ctx = makeSupabaseWithZone("10b");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple", forceRefresh: true }),
      });
      const res = await POST(req);
      const data = await res.json();
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      // forceRefresh skips the global_plant_library branch and goes straight to AI.
      expect(tablesConsulted).not.toContain("global_plant_library");
      expect(mockResearchVariety).toHaveBeenCalled();
      expect(data.enriched).toBe(true);
      expect(data.fromCache).toBe(false);
    });

    it("normalizes 'Zone 5a' prefix when deciding library-skip", async () => {
      const ctx = makeSupabaseWithZone("Zone 5a");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      // "Zone 5a" normalizes to "5a" → skipLibrary = true → library NOT consulted.
      expect(tablesConsulted).not.toContain("global_plant_library");
      // researchVariety still receives the raw "Zone 5a" string (server passes userZone as-is).
      expect(mockResearchVariety).toHaveBeenCalledWith(
        "test-key",
        "Tomato",
        "Cherokee Purple",
        "",
        "Zone 5a"
      );
    });
  });
});
