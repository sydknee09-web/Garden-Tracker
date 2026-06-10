import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetSupabaseUser = vi.hoisted(() => vi.fn());
const mockCheckDailyAiCeiling = vi.hoisted(() => vi.fn());
const mockGenerateContent = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/aiDailyCeiling", () => ({
  checkDailyAiCeiling: mockCheckDailyAiCeiling,
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe("POST /api/seed/find-hero-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(true);
    mockGetSupabaseUser.mockResolvedValue(null);
    mockCheckDailyAiCeiling.mockResolvedValue({ allowed: true, used: 0, limit: 100 });
    mockGenerateContent.mockResolvedValue({ text: "" });
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  afterEach(() => {
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

  it("fires exactly ONE Gemini attempt on a miss by default (Leak 2 fan-out cap)", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("fires primary + ONE fallback attempt when allow_fallback is true (explicit AI refresh)", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tomato", variety: "Cherokee Purple", allow_fallback: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("returns 429 DAILY_AI_LIMIT before any Gemini call when the daily ceiling is hit (Leak 3)", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    mockGetSupabaseUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {},
    });
    mockCheckDailyAiCeiling.mockResolvedValue({ allowed: false, used: 100, limit: 100 });
    const req = new Request("http://localhost/api/seed/find-hero-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      body: JSON.stringify({ name: "Tomato" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("DAILY_AI_LIMIT");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
