import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetSupabaseUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  DEFAULT_RATE_LIMIT: { maxRequests: 10, windowMs: 60_000 },
}));

vi.mock("@/app/api/import/auth", () => ({
  getSupabaseUser: mockGetSupabaseUser,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: "" }),
    },
  })),
}));

describe("POST /api/seed/find-hero-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(true);
    mockGetSupabaseUser.mockResolvedValue(null);
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  it("returns 400 when name is missing", async () => {
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variety: "Cherokee Purple" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name required/i);
  });

  it("returns 400 when name is empty string", async () => {
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/name required/i);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
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
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tomato" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/api.*key|not configured/i);
  });
});
