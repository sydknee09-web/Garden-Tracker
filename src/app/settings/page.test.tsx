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

// Mock developer unlock so Developer link is visible in tests
vi.mock("@/contexts/DeveloperUnlockContext", () => ({
  useDeveloperUnlock: () => ({ isUnlocked: true, tapVersion: vi.fn(), reset: vi.fn() }),
}));

describe("Settings page", () => {
  it("renders settings menu with Profile and Developer links", async () => {
    render(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "/settings/profile");
    expect(screen.getByRole("link", { name: /developer/i })).toHaveAttribute("href", "/settings/developer");
    expect(screen.getByRole("link", { name: /back to garden/i })).toHaveAttribute("href", "/");
  });
});
