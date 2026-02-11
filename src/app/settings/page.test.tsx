import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "./page";

// Mock auth so the page renders without Supabase
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
    signOut: vi.fn(),
  }),
}));

// Chain mock: every method returns the same chain; async end resolves with empty data.
// Defined inside factory so hoisting doesn't leave it undefined.
vi.mock("@/lib/supabase", () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [] }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  };
  // Ensure returnThis actually returns the chain (in case "this" is wrong in mock)
  chain.select.mockImplementation(() => chain);
  chain.eq.mockImplementation(() => chain);
  chain.is.mockImplementation(() => chain);
  chain.not.mockImplementation(() => chain);
  chain.in.mockImplementation(() => chain);
  return {
    supabase: {
      from: vi.fn(() => chain),
    },
  };
});

describe("Settings page", () => {
  it("renders primary action buttons so they are present in the DOM (visibility regression)", async () => {
    render(<SettingsPage />);

    // Buttons that were invisible due to bg-emerald-600 not existing in Tailwind scale
    expect(await screen.findByRole("button", { name: /use my location/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /save|saving|saved/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /download json/i })).toBeInTheDocument();
  });
});
