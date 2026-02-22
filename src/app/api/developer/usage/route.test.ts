import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: mockOrder,
        }),
      }),
    }),
  }),
}));

describe("GET /api/developer/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({
      data: [
        { provider: "gemini", operation: "extract", created_at: "2025-02-15T10:00:00Z", tokens: 100 },
        { provider: "gemini", operation: "enrich", created_at: "2025-02-14T10:00:00Z", tokens: 50 },
        { provider: "openai", operation: "ocr-extract", created_at: "2025-02-10T10:00:00Z", tokens: 80 },
      ],
      error: null,
    });
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/developer/usage", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/authorization/i);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("Invalid") });
    const req = new Request("http://localhost/api/developer/usage", {
      method: "GET",
      headers: { Authorization: "Bearer bad-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("returns aggregated usage when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const req = new Request("http://localhost/api/developer/usage", {
      method: "GET",
      headers: { Authorization: "Bearer valid-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("byProvider");
    expect(data.byProvider.gemini).toBeDefined();
    expect(data.byProvider.openai).toBeDefined();
    expect(data.byProvider.perenual).toBeDefined();
    expect(data.note).toMatch(/self-tracked/i);
  });
});
