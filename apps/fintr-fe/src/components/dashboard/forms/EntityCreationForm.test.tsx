import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EntityCreationForm from "./EntityCreationForm";

const mockCreateEntity = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/hooks/async/useEntitiesMutations", () => ({
  useEntitiesMutations: () => ({
    createEntity: (...args: unknown[]) => mockCreateEntity(...args),
  }),
}));

vi.mock("@/components/ui/image-crop-dialog", () => ({
  ImageCropDialog: ({
    open,
    title,
  }: {
    open: boolean;
    title?: string;
  }) => (open ? <div>{title}</div> : null),
}));

describe("EntityCreationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:entity-photo"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    mockCreateEntity.mockResolvedValue({
      data: { id: "entity-1", fullName: "Alex", entityType: "loan" },
    });
  });

  it("associates Add photo with a reachable file input", () => {
    render(
      <EntityCreationForm
        onSuccess={vi.fn()}
        entityType="loan"
        nameLabel="Borrower name"
        photoLabel="Borrower photo"
      />,
    );

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;

    expect(fileInput).toBeTruthy();
    expect(fileInput?.className).not.toContain("hidden");
    expect(screen.getByLabelText("Add photo")).toBe(fileInput);
  });

  it("opens the crop dialog after a photo is chosen", async () => {
    const user = userEvent.setup();

    render(
      <EntityCreationForm
        onSuccess={vi.fn()}
        entityType="loan"
        photoLabel="Borrower photo"
      />,
    );

    const fileInput = screen.getByLabelText("Add photo");
    const file = new File(["photo"], "borrower.png", { type: "image/png" });

    await user.upload(fileInput, file);

    expect(await screen.findByText("Crop borrower photo")).toBeInTheDocument();
  });

  it("saves a new borrower through the entity mutation", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <EntityCreationForm
        onSuccess={onSuccess}
        entityType="loan"
        nameLabel="Borrower name"
      />,
    );

    await user.type(screen.getByLabelText("Borrower name"), "Alex");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockCreateEntity).toHaveBeenCalledWith({
        fullName: "Alex",
        entityType: "loan",
        photo: null,
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("Alex");
    });
  });
});
