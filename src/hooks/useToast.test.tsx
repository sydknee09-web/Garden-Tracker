import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useToast } from "./useToast";

vi.mock("@/lib/successSound", () => ({
  isSuccessSoundEnabled: () => false,
  playSuccessSound: vi.fn(),
}));
vi.mock("@/lib/debugLog", () => ({ logEvent: vi.fn() }));

// Capture the hook's return so tests can drive showToast and the rendered toast can be clicked.
let api: ReturnType<typeof useToast> | null = null;
function Harness() {
  api = useToast();
  return <>{api.toast}</>;
}

const deferredOpts = (onAutoDismiss: () => void, onAction: () => void) => ({
  durationMs: 5000,
  action: { label: "Undo", onAction },
  onAutoDismiss,
});

describe("useToast deferred-commit (swipe-complete undo)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("commits the deferred action when the window closes, not before", () => {
    render(<Harness />);
    const commit = vi.fn();
    act(() => {
      api!.showToast("Marked as purchased", deferredOpts(commit, vi.fn()));
    });

    expect(screen.getByText("Marked as purchased")).toBeInTheDocument();
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Marked as purchased")).not.toBeInTheDocument();
  });

  it("Undo cancels the commit and runs the restore handler", () => {
    render(<Harness />);
    const commit = vi.fn();
    const restore = vi.fn();
    act(() => {
      api!.showToast("Marked as done", deferredOpts(commit, restore));
    });

    act(() => {
      fireEvent.click(screen.getByText("Undo"));
    });

    expect(restore).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Marked as done")).not.toBeInTheDocument();

    // Advancing past the original window must NOT fire the commit — it was cancelled.
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("a new toast commits the prior pending action (single-pending-slot)", () => {
    render(<Harness />);
    const commitA = vi.fn();
    const commitB = vi.fn();
    act(() => {
      api!.showToast("A", deferredOpts(commitA, vi.fn()));
    });
    act(() => {
      api!.showToast("B", deferredOpts(commitB, vi.fn()));
    });

    expect(commitA).toHaveBeenCalledTimes(1); // prior flushed on replace
    expect(commitB).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(commitB).toHaveBeenCalledTimes(1);
  });

  it("flushes the pending commit on unmount (navigate away within window)", () => {
    const { unmount } = render(<Harness />);
    const commit = vi.fn();
    act(() => {
      api!.showToast("Marked as purchased", deferredOpts(commit, vi.fn()));
    });
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      unmount();
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("plain toasts are unaffected — no action button, auto-dismiss at default duration", () => {
    render(<Harness />);
    act(() => {
      api!.showToast("Saved");
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
