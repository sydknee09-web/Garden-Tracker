import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: () => ({ upload: vi.fn() }) },
  }),
}));

// Mock fetch for scrape-url calls (batch-import fetches internally)
const originalFetch = globalThis.fetch;
beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        is: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  });
});

describe("POST /api/seed/batch-import", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/seed/batch-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: ["https://example.com/seed"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/authorization/i);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("Invalid") });
    const req = new Request("http://localhost/api/seed/batch-import", {
      method: "POST",
      headers: { Authorization: "Bearer bad-token", "Content-Type": "application/json" },
      body: JSON.stringify({ urls: ["https://example.com/seed"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/invalid|expired/i);
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const req = new Request("http://localhost/api/seed/batch-import", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      body: "not valid json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/json/i);
  });

  it("returns 400 when urls array is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const req = new Request("http://localhost/api/seed/batch-import", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid URL|required/i);
  });

  it("returns 400 when urls has only empty/invalid entries", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const req = new Request("http://localhost/api/seed/batch-import", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      body: JSON.stringify({ urls: ["", "   ", "  \t  "] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid URL|required/i);
  });
});
