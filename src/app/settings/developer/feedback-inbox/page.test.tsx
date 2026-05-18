import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FeedbackInboxPage from "./page";

// Auth + unlock state — flipped per test.
const authState: { user: { id: string } | null } = { user: { id: "dev-user-id" } };
const unlockState = { isUnlocked: true };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, signOut: vi.fn() }),
}));

vi.mock("@/contexts/DeveloperUnlockContext", () => ({
  useDeveloperUnlock: () => ({ isUnlocked: unlockState.isUnlocked, tapVersion: vi.fn(), reset: vi.fn() }),
}));

// RPC + storage mocks. Per-test override via rpcResult.
const rpcResult: { data: unknown; error: { code?: string; message: string } | null } = {
  data: [],
  error: null,
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://example.com/${path}` },
        })),
      })),
    },
  },
}));

describe("FeedbackInboxPage", () => {
  beforeEach(() => {
    authState.user = { id: "dev-user-id" };
    unlockState.isUnlocked = true;
    rpcResult.data = [];
    rpcResult.error = null;
  });

  it("renders 'Developer tools require unlock' when isUnlocked is false", async () => {
    unlockState.isUnlocked = false;
    render(<FeedbackInboxPage />);
    expect(await screen.findByText(/developer tools require unlock/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.queryByText(/feedback inbox/i)).not.toBeInTheDocument();
  });

  it("renders 'Sign in' gate when no user", async () => {
    authState.user = null;
    render(<FeedbackInboxPage />);
    expect(await screen.findByText(/sign in to view the feedback inbox/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login");
  });

  it("renders 'Not authorized' guidance when RPC raises 42501", async () => {
    rpcResult.data = null;
    rpcResult.error = { code: "42501", message: "Not authorized" };
    render(<FeedbackInboxPage />);
    expect(await screen.findByText(/^Not authorized$/)).toBeInTheDocument();
    expect(screen.getAllByText(/developer_users/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/INSERT INTO public\.developer_users/i)).toBeInTheDocument();
  });

  it("renders empty state when authorized but no rows", async () => {
    rpcResult.data = [];
    rpcResult.error = null;
    render(<FeedbackInboxPage />);
    expect(await screen.findByText(/no feedback submitted yet/i)).toBeInTheDocument();
  });

  it("renders rows with category badge, email, message, screenshot, voice, and debug log toggle", async () => {
    rpcResult.data = [
      {
        id: "fb-1",
        user_id: "user-a",
        created_at: "2026-05-17T12:00:00Z",
        message: "App crashed when I tapped Save",
        category: "bug",
        page_url: "https://example.com/garden",
        user_email: "tester@example.com",
        screenshot_path: "user-a/feedback-screenshot.jpg",
        voice_path: "user-a/feedback-voice-1.webm",
        debug_log_text: "[12:00:00] error: Save failed\n[12:00:01] error: undefined",
      },
      {
        id: "fb-2",
        user_id: "user-b",
        created_at: "2026-05-17T11:00:00Z",
        message: "Could you add a dark mode?",
        category: "feature",
        page_url: null,
        user_email: "another@example.com",
        screenshot_path: null,
        voice_path: null,
        debug_log_text: null,
      },
    ];
    rpcResult.error = null;
    render(<FeedbackInboxPage />);

    expect(await screen.findByText("App crashed when I tapped Save")).toBeInTheDocument();
    expect(screen.getByText("Could you add a dark mode?")).toBeInTheDocument();
    expect(screen.getByText(/tester@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/another@example\.com/)).toBeInTheDocument();
    // "Bug" + "Feature" appear in both the filter dropdown option AND the row category badge.
    expect(screen.getAllByText("Bug").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Feature").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/example\.com\/garden/)).toBeInTheDocument();

    const screenshot = screen.getByAltText("Screenshot attachment");
    expect(screenshot).toHaveAttribute("src", "https://example.com/user-a/feedback-screenshot.jpg");

    // Voice memo player exists; query by accessible name via the label
    expect(screen.getByText("Voice memo")).toBeInTheDocument();

    // Debug log starts collapsed
    expect(screen.queryByLabelText("Debug log contents")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /show debug log/i });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByLabelText("Debug log contents")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Debug log contents")).toHaveValue("[12:00:00] error: Save failed\n[12:00:01] error: undefined");
  });

  it("filters by category, voice-only, and debug-log-only", async () => {
    rpcResult.data = [
      {
        id: "fb-1",
        user_id: "u",
        created_at: "2026-05-17T12:00:00Z",
        message: "Bug with voice",
        category: "bug",
        page_url: null,
        user_email: null,
        screenshot_path: null,
        voice_path: "u/v1.webm",
        debug_log_text: null,
      },
      {
        id: "fb-2",
        user_id: "u",
        created_at: "2026-05-17T11:00:00Z",
        message: "Feature with debug log",
        category: "feature",
        page_url: null,
        user_email: null,
        screenshot_path: null,
        voice_path: null,
        debug_log_text: "log content",
      },
      {
        id: "fb-3",
        user_id: "u",
        created_at: "2026-05-17T10:00:00Z",
        message: "Plain bug",
        category: "bug",
        page_url: null,
        user_email: null,
        screenshot_path: null,
        voice_path: null,
        debug_log_text: null,
      },
    ];
    rpcResult.error = null;
    render(<FeedbackInboxPage />);

    expect(await screen.findByText("Bug with voice")).toBeInTheDocument();
    expect(screen.getByText("Feature with debug log")).toBeInTheDocument();
    expect(screen.getByText("Plain bug")).toBeInTheDocument();

    // Category=bug → drops feature row
    fireEvent.change(screen.getByLabelText(/filter by category/i), { target: { value: "bug" } });
    expect(screen.getByText("Bug with voice")).toBeInTheDocument();
    expect(screen.queryByText("Feature with debug log")).not.toBeInTheDocument();
    expect(screen.getByText("Plain bug")).toBeInTheDocument();

    // Voice-only → drops Plain bug (no voice)
    fireEvent.click(screen.getByLabelText(/voice only/i));
    expect(screen.getByText("Bug with voice")).toBeInTheDocument();
    expect(screen.queryByText("Plain bug")).not.toBeInTheDocument();

    // Reset to all + debug-log-only
    fireEvent.change(screen.getByLabelText(/filter by category/i), { target: { value: "all" } });
    fireEvent.click(screen.getByLabelText(/voice only/i));
    fireEvent.click(screen.getByLabelText(/debug log only/i));
    expect(screen.queryByText("Bug with voice")).not.toBeInTheDocument();
    expect(screen.getByText("Feature with debug log")).toBeInTheDocument();
    expect(screen.queryByText("Plain bug")).not.toBeInTheDocument();
  });

  it("renders generic error message when RPC fails with non-42501 error", async () => {
    rpcResult.data = null;
    rpcResult.error = { code: "42883", message: "function admin_list_feedback() does not exist" };
    render(<FeedbackInboxPage />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/admin_list_feedback\(\) does not exist/);
    expect(screen.queryByText(/^not authorized$/i)).not.toBeInTheDocument();
  });
});
