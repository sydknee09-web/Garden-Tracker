import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddVarietyForm } from "./AddVarietyModal";

/**
 * AI Fill leak fix (2026-06-13): the Add-to-Library Save handler must route new
 * profiles through the durable server-side job pipeline (useAiFillJobs().enqueue)
 * instead of the old client-side fire-and-forget enrichProfileFromName await chain
 * that died on mobile tab suspend. It also sets hero_image_pending=true at insert
 * so the Library card "Researching…" pulse shows immediately.
 */

const enqueueMock = vi.fn(() => Promise.resolve({ ok: true as const }));
const insertedPayloads: Record<string, unknown>[] = [];

vi.mock("@/contexts/AiFillJobsContext", () => ({
  useAiFillJobs: () => ({ enqueue: enqueueMock }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" }, session: { access_token: "fake" } }),
}));
vi.mock("@/contexts/OnboardingContext", () => ({
  useOnboardingContextOptional: () => ({ reportAction: vi.fn() }),
}));
vi.mock("@/lib/haptics", () => ({ hapticSuccess: vi.fn(), hapticError: vi.fn() }));
vi.mock("@/lib/debugLog", () => ({ logEvent: vi.fn() }));

vi.mock("@/lib/supabase", () => {
  const result = { data: [], error: null };
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(() => ({
        select: () => makeChain(),
        insert: (payload: Record<string, unknown>) => {
          insertedPayloads.push(payload);
          return {
            select: () => ({ single: () => Promise.resolve({ data: { id: "profile-1" }, error: null }) }),
          };
        },
        update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      })),
    },
  };
});

describe("AddVarietyForm — Save enqueues a background AI Fill job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedPayloads.length = 0;
  });

  it("creates the profile with hero_image_pending=true and enqueues the job (not client enrichment)", async () => {
    render(<AddVarietyForm onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Tomato, Basil, Rose"), {
      target: { value: "Gladiola" },
    });
    fireEvent.submit(document.getElementById("add-variety-form")!);

    await waitFor(() => expect(enqueueMock).toHaveBeenCalled());
    // Fill Blanks semantics (overwrite=false) for a brand-new all-blank profile.
    expect(enqueueMock).toHaveBeenCalledWith("profile-1", false);
    // Card "Researching…" pulse flag set atomically at insert.
    expect(insertedPayloads[0]).toMatchObject({ hero_image_pending: true });
  });
});
