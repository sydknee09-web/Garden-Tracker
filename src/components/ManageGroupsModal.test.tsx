import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ManageGroupsModal } from "./ManageGroupsModal";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1" }, session: null }),
}));

const fetchUserGroupsMock = vi.fn();
const createGroupMock = vi.fn();
const renameGroupMock = vi.fn();
const deleteGroupMock = vi.fn();
const updateGroupPositionsMock = vi.fn();
vi.mock("@/lib/groups", () => ({
  fetchUserGroups: (...args: unknown[]) => fetchUserGroupsMock(...args),
  createGroup: (...args: unknown[]) => createGroupMock(...args),
  renameGroup: (...args: unknown[]) => renameGroupMock(...args),
  deleteGroup: (...args: unknown[]) => deleteGroupMock(...args),
  updateGroupPositions: (...args: unknown[]) => updateGroupPositionsMock(...args),
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/haptics", () => ({ hapticSuccess: vi.fn(), hapticError: vi.fn() }));
vi.mock("@/hooks/useEscapeKey", () => ({ useEscapeKey: vi.fn() }));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock("@/hooks/useBodyScrollLock", () => ({ useBodyScrollLock: vi.fn() }));

describe("ManageGroupsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchUserGroupsMock.mockResolvedValue([
      { id: "g-1", user_id: "u-1", name: "Patio", position: 0, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null },
      { id: "g-2", user_id: "u-1", name: "Bedroom", position: 1, created_at: "2026-01-02", updated_at: "2026-01-02", deleted_at: null },
    ]);
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ManageGroupsModal open={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders header and groups when open", async () => {
    render(<ManageGroupsModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Manage Groups" })).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Patio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bedroom")).toBeInTheDocument();
  });

  it("creates a new group via the Add button", async () => {
    createGroupMock.mockResolvedValue({
      id: "g-new",
      user_id: "u-1",
      name: "Greenhouse",
      position: null,
      created_at: "2026-05-29",
      updated_at: "2026-05-29",
      deleted_at: null,
    });
    const onMutated = vi.fn();
    render(<ManageGroupsModal open onClose={vi.fn()} onMutated={onMutated} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Patio")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Add Group") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Greenhouse" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createGroupMock).toHaveBeenCalledWith(expect.anything(), "u-1", "Greenhouse");
    });
    expect(onMutated).toHaveBeenCalled();
  });

  it("renames a group when user edits the input and clicks Save", async () => {
    renameGroupMock.mockResolvedValue(undefined);
    render(<ManageGroupsModal open onClose={vi.fn()} />);
    const patioInput = await screen.findByDisplayValue("Patio");
    fireEvent.change(patioInput, { target: { value: "Patio West" } });
    const saveBtn = await screen.findByLabelText("Save rename for Patio");
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(renameGroupMock).toHaveBeenCalledWith(expect.anything(), "g-1", "Patio West");
    });
  });

  it("shows confirm flow on delete then calls deleteGroup", async () => {
    deleteGroupMock.mockResolvedValue(undefined);
    render(<ManageGroupsModal open onClose={vi.fn()} />);
    const deleteBtn = await screen.findByLabelText("Delete Patio");
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Delete?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => {
      expect(deleteGroupMock).toHaveBeenCalledWith(expect.anything(), "g-1");
    });
  });

  it("reorders groups via the down arrow and writes positions for all rows", async () => {
    updateGroupPositionsMock.mockResolvedValue(undefined);
    render(<ManageGroupsModal open onClose={vi.fn()} />);
    const downArrow = await screen.findByLabelText("Move Patio down");
    fireEvent.click(downArrow);
    await waitFor(() => {
      expect(updateGroupPositionsMock).toHaveBeenCalledWith(expect.anything(), [
        { id: "g-2", position: 0 },
        { id: "g-1", position: 1 },
      ]);
    });
  });
});
