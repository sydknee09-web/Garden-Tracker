import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockInviteUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: mockInviteUser,
      },
    },
  }),
}));

describe("POST /api/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 500 when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const req = new Request("http://localhost/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/supabase|service role|configuration/i);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json {",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/json/i);
  });

  it("returns 400 when email is missing", async () => {
    const req = new Request("http://localhost/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 400 when email is empty string", async () => {
    const req = new Request("http://localhost/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "   " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 400 when Supabase returns an invite error", async () => {
    mockInviteUser.mockResolvedValue({
      data: null,
      error: { message: "User already invited" },
    });
    const req = new Request("http://localhost/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("User already invited");
  });

  it("returns 200 with success message when invite succeeds", async () => {
    mockInviteUser.mockResolvedValue({
      data: { user: { id: "u-1", email: "test@example.com" } },
      error: null,
    });
    const req = new Request("http://localhost/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toMatch(/invitation sent/i);
  });
});
