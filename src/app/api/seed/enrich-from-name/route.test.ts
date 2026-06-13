import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { researchPlantTiered as mockResearchPlantTiered } from "@/lib/researchVariety";

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

vi.mock("@/lib/researchVariety", () => ({
  researchPlantTiered: vi.fn().mockResolvedValue(null),
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

  describe("zone-agnostic enrichment", () => {
    beforeEach(() => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
      // Default: researchPlantTiered returns a tier-1 found outcome so we can reach the response payload.
      vi.mocked(mockResearchPlantTiered).mockResolvedValue({
        found: true,
        level: "variety",
        cacheScope: "variety",
        attempts: 1,
        data: {
          planting_window: "Indoor sow Feb-Mar, transplant May-Jun",
          sun_requirement: "Full sun",
        },
      });
    });

    it("calls researchPlantTiered WITHOUT any zone (enrichment is zone-agnostic)", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      // Zone-agnostic: the 5th positional zone argument is gone — the prompt no longer biases to a zone.
      expect(mockResearchPlantTiered).toHaveBeenCalledWith(
        "test-key",
        "Tomato",
        "Cherokee Purple",
        { lifecycle: "", growth_form: "", plant_category: "" }
      );
      expect(mockResearchPlantTiered.mock.calls[0]).toHaveLength(4);
    });

    it("consults the library cache regardless of the user's zone (zone-agnostic cache valid for all)", async () => {
      const ctx = makeSupabaseWithZone("5a");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      await POST(req);
      // No per-zone cache skip anymore — the shared library is valid for every zone (NORTH_STAR §1).
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      expect(tablesConsulted).toContain("global_plant_library");
    });

    it("no longer reads user_settings for a zone, and the response carries no zoneUsed field", async () => {
      const ctx = makeSupabaseWithZone("5a");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.enriched).toBe(true);
      expect(data.zoneUsed).toBeUndefined();
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      expect(tablesConsulted).not.toContain("user_settings");
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
      expect(mockResearchPlantTiered).toHaveBeenCalled();
      expect(data.enriched).toBe(true);
      expect(data.fromCache).toBe(false);
    });

    it("returns found:false with NO library cache write when the exact variety isn't found (B5)", async () => {
      const ctx = makeSupabaseWithZone("10b");
      mockGetSupabaseUser.mockResolvedValue(ctx);
      vi.mocked(mockResearchPlantTiered).mockResolvedValue({ found: false, attempts: 3 });
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Canna Lily", variety: "Summer Spritz Lemon Zest", forceRefresh: true }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.enriched).toBe(false);
      expect(data.found).toBe(false);
      // forceRefresh skipped the cache read; found:false must ALSO skip the cache write —
      // global_plant_library is never consulted in this flow (admin mock is null, but the
      // user-client must not touch it either).
      const tablesConsulted = ctx._from.mock.calls.map((c) => c[0]);
      expect(tablesConsulted).not.toContain("global_plant_library");
    });

    it("returns enriched:false without a found flag when the AI fails entirely", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      vi.mocked(mockResearchPlantTiered).mockResolvedValue(null);
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(data.enriched).toBe(false);
      // AI-failure (null) is distinct from variety-not-found ({found:false}).
      expect(data.found).toBeUndefined();
    });

    it("includes found:true on a successful AI fill", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(data.enriched).toBe(true);
      expect(data.found).toBe(true);
    });

    it("returns provenance + parsed When-to-Plant fields on a tier hit (Ship 2)", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      vi.mocked(mockResearchPlantTiered).mockResolvedValue({
        found: true,
        level: "species",
        cacheScope: "species",
        attempts: 2,
        data: {
          plant_description: "Cannas are tropical perennials.",
          when_to_plant_description: "Cannas are a spring/summer plant — they need warm soil to grow.",
          planting_seasons_tags: "Spring, Summer",
          optimal_planting_months: "4,5,6",
          indoor_start_weeks_before_frost: "6",
          outdoor_plant_weeks_after_frost: "0",
        },
      });
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Canna", variety: "Cannova Bronze Scarlet" }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(data.enriched).toBe(true);
      expect(data.found).toBe(true);
      expect(data.provenance).toBe("species");
      expect(data.when_to_plant_description).toMatch(/spring\/summer plant/);
      expect(data.planting_seasons_tags).toEqual(["Spring", "Summer"]);
      expect(data.optimal_planting_months_array).toEqual([4, 5, 6]);
      expect(data.indoor_start_weeks_before_frost).toBe(6);
      // 0 = "at last frost" must survive parsing (not collapse to null).
      expect(data.outdoor_plant_weeks_after_frost).toBe(0);
    });

    it("forwards the caller's three-tag schema values to the tier ladder", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Maple",
          variety: "October Glory",
          tags: { lifecycle: "Perennial", growth_form: "Tree", plant_category: "Ornamental" },
        }),
      });
      await POST(req);
      expect(mockResearchPlantTiered).toHaveBeenCalledWith(
        "test-key",
        "Maple",
        "October Glory",
        { lifecycle: "Perennial", growth_form: "Tree", plant_category: "Ornamental" }
      );
    });

    it("parses + returns the zone-agnostic hardiness range", async () => {
      mockGetSupabaseUser.mockResolvedValue(makeSupabaseWithZone("5a"));
      vi.mocked(mockResearchPlantTiered).mockResolvedValue({
        found: true,
        level: "variety",
        cacheScope: "variety",
        attempts: 1,
        data: {
          plant_description: "A cold-hardy apple.",
          hardiness_zone_min: "3",
          hardiness_zone_max: "8",
        },
      });
      const req = new Request("http://localhost/api/seed/enrich-from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Apple", variety: "Honeycrisp" }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(data.hardiness_zone_min).toBe(3);
      expect(data.hardiness_zone_max).toBe(8);
    });
  });
});
