import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "./page";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
    signOut: vi.fn(),
  }),
}));

const unlockState = { isUnlocked: false };
vi.mock("@/contexts/DeveloperUnlockContext", () => ({
  useDeveloperUnlock: () => ({ isUnlocked: unlockState.isUnlocked, tapVersion: vi.fn(), reset: vi.fn() }),
}));

describe("Settings page", () => {
  it("renders user-facing settings without developer links when locked", async () => {
    unlockState.isUnlocked = false;
    render(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "/settings/profile");
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /developer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /import logs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /extract cache/i })).not.toBeInTheDocument();
  });

  it("renders developer links when the tap-unlock has been activated", async () => {
    unlockState.isUnlocked = true;
    render(<SettingsPage />);

    expect(await screen.findByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Developer Fill in blanks/i })).toHaveAttribute("href", "/settings/developer");
    expect(screen.getByRole("link", { name: /feedback inbox/i })).toHaveAttribute("href", "/settings/developer/feedback-inbox");
    expect(screen.getByRole("link", { name: /import logs/i })).toHaveAttribute("href", "/settings/import-logs");
    expect(screen.getByRole("link", { name: /extract cache/i })).toHaveAttribute("href", "/settings/extract-cache");
  });
});
