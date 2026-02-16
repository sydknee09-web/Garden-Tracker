import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetSupabaseAdmin = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

describe("save-hero-to-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/seed/save-hero-to-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity_key: "tomato_roma", hero_image_url: "https://example.com/hero.jpg" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/authorization/i);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid or user missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = new Request("http://localhost/api/seed/save-hero-to-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer bad-token" },
      body: JSON.stringify({ identity_key: "tomato_roma", hero_image_url: "https://example.com/hero.jpg" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("returns 400 when identity_key is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const req = new Request("http://localhost/api/seed/save-hero-to-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ hero_image_url: "https://example.com/hero.jpg" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/identity_key/i);
  });

  it("returns 400 when hero_image_url is missing or not http", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const req = new Request("http://localhost/api/seed/save-hero-to-cache", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify({ identity_key: "tomato_roma" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/hero_image_url|http/i);
  });
});
