import { describe, it, expect } from "vitest";

/**
 * Supabase auth.getUser(jwt) returns { data: { user: User | null }, error: AuthError | null }.
 * The correct destructuring in API routes is:
 *   const { data: { user }, error: authError } = await supabase.auth.getUser(token);
 *   if (authError || !user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *
 * WRONG (causes "Property 'id' does not exist on type '{ user: User }'" at build):
 *   const { data: user, error } = await supabase.auth.getUser(token);  // 'user' is actually { user: User }
 *   if (!user?.id) ...
 *
 * This test locks in the response shape so the correct pattern is documented and regression-tested.
 */
type GetUserResponse = {
  data: { user: { id: string } | null };
  error: unknown;
};

function extractUserIdFromGetUserResponse(res: GetUserResponse): string | null {
  const { data: { user }, error } = res;
  if (error || !user?.id) return null;
  return user.id;
}

describe("Supabase auth.getUser response shape", () => {
  it("returns user id when destructuring data.user correctly", () => {
    const res: GetUserResponse = { data: { user: { id: "user-123" } }, error: null };
    expect(extractUserIdFromGetUserResponse(res)).toBe("user-123");
  });

  it("returns null when user is null", () => {
    expect(extractUserIdFromGetUserResponse({ data: { user: null }, error: null })).toBeNull();
  });

  it("returns null when error is set", () => {
    expect(extractUserIdFromGetUserResponse({ data: { user: { id: "x" } }, error: new Error("bad") })).toBeNull();
  });

  it("data.user is the user object (not data itself)", () => {
    const res: GetUserResponse = { data: { user: { id: "abc" } }, error: null };
    const { data } = res;
    expect(data).toHaveProperty("user");
    expect(data.user).toHaveProperty("id", "abc");
    expect(data.user?.id).toBe("abc");
  });
});
