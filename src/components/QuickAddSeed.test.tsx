import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SeedPacketForm } from "./QuickAddSeed";

/**
 * AI Fill leak fix (2026-06-13): the Quick Add Seed "Save for Later" handler must
 * route new profiles through the durable server-side job pipeline
 * (useAiFillJobs().enqueue) instead of the old client-side fire-and-forget
 * enrichProfileFromName await chain that died on mobile tab suspend, and set
 * hero_image_pending=true at insert for the Library card "Researching…" pulse.
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
vi.mock("@/lib/fetchWithRetry", () => ({ fetchWithRetry: vi.fn(() => Promise.resolve(new Response("{}"))) }));

vi.mock("@/lib/supabase", () => {
  const result = { data: [], error: null };
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      single: vi.fn(() => Promise.resolve(result)),
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
    return chain;
  };
  return {
    supabase: {
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
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

describe("SeedPacketForm — Save for Later enqueues a background AI Fill job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedPayloads.length = 0;
  });

  it("creates the profile with hero_image_pending=true and enqueues the job (not client enrichment)", async () => {
    render(<SeedPacketForm onClose={vi.fn()} onSuccess={vi.fn()} startOnManual />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Tomato"), { target: { value: "Gladiola" } });
    fireEvent.click(await screen.findByRole("button", { name: "Save for Later" }));

    await waitFor(() => expect(enqueueMock).toHaveBeenCalled());
    expect(enqueueMock).toHaveBeenCalledWith("profile-1", false);
    expect(insertedPayloads[0]).toMatchObject({ hero_image_pending: true });
  });
});
