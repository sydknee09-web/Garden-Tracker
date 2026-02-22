import { describe, it, expect, vi, beforeEach } from "vitest";
import { logApiUsage } from "./logApiUsage";

const mockInsert = vi.hoisted(() => vi.fn());
const mockGetSupabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

describe("logApiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("does nothing when getSupabaseAdmin returns null", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);
    await logApiUsage({
      userId: "user-1",
      provider: "gemini",
      operation: "extract",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts a row when admin client is available", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ insert: mockInsert }),
    });

    await logApiUsage({
      userId: "user-1",
      provider: "gemini",
      operation: "extract",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      provider: "gemini",
      operation: "extract",
      tokens: null,
      metadata: null,
    });
  });

  it("includes tokens and metadata when provided", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ insert: mockInsert }),
    });

    await logApiUsage({
      userId: "user-2",
      provider: "openai",
      operation: "ocr-extract",
      tokens: 150,
      metadata: { model: "gpt-4o-mini" },
    });

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-2",
      provider: "openai",
      operation: "ocr-extract",
      tokens: 150,
      metadata: { model: "gpt-4o-mini" },
    });
  });

  it("does not throw when insert fails", async () => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({ insert: mockInsert }),
    });
    mockInsert.mockRejectedValue(new Error("DB error"));

    await expect(
      logApiUsage({ userId: "user-1", provider: "perenual", operation: "enrich" })
    ).resolves.toBeUndefined();
  });
});
