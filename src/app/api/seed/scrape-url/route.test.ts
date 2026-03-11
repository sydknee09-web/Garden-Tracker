import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

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

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({ response: { text: () => "{}" } }),
    }),
  })),
}));

describe("POST /api/seed/scrape-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseUser.mockResolvedValue(null);
    mockCheckRateLimit.mockReturnValue(true);
  });

  it("returns 400 when url is missing", async () => {
    const req = new Request("http://localhost/api/seed/scrape-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/url.*required|required.*url/i);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/seed/scrape-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/json/i);
  });

  it("returns 400 when URL is malformed", async () => {
    const req = new Request("http://localhost/api/seed/scrape-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: ":::bad:::" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid url/i);
  });

  it("returns 400 when URL domain is not in the allowed list", async () => {
    const req = new Request("http://localhost/api/seed/scrape-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://amazon.com/product/seeds" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/domain.*not allowed|not allowed/i);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const req = new Request("http://localhost/api/seed/scrape-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.rareseeds.com/product/test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/rate/i);
  });
});
