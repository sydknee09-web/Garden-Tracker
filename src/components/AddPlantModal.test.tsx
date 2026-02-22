import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AddPlantModal } from "./AddPlantModal";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() =>
            ({ is: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })
          ),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: "profile-1" }, error: null })) })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
    })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(() => Promise.resolve({ error: null })) })) },
  },
}));
vi.mock("@/lib/compressImage", () => ({ compressImage: vi.fn(() => Promise.resolve({ blob: new Blob(), fileName: "test.jpg" })) }));
vi.mock("@/lib/haptics", () => ({ hapticSuccess: vi.fn(), hapticError: vi.fn() }));
vi.mock("@/hooks/useEscapeKey", () => ({ useEscapeKey: vi.fn() }));

describe("AddPlantModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <AddPlantModal open={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal when open with Permanent and Seasonal options", async () => {
    render(<AddPlantModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Add Plant" })).toBeInTheDocument();
    });
    expect(screen.getByText("Permanent")).toBeInTheDocument();
    expect(screen.getByText("Seasonal")).toBeInTheDocument();
  });

  it("shows Create new and Link to existing modes", async () => {
    render(<AddPlantModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Link to existing")).toBeInTheDocument();
    });
    expect(screen.getByText("Create new")).toBeInTheDocument();
  });
});
