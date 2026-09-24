import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CategoryFormDialog from "./category-form-dialog";
import { CategoryTypeEnum } from "@/types/categoryTypes";

vi.mock("@/components/dashboard/category-appearance-picker", () => ({
  CategoryAppearancePicker: () => <div data-testid="appearance-picker" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe("CategoryFormDialog", () => {
  it("omits the trigger when hideTrigger is set", () => {
    render(
      <CategoryFormDialog
        category={{
          id: "c1",
          name: "Church",
          categoryType: CategoryTypeEnum.EXPENSE,
        }}
        onUpdate={vi.fn()}
        open={false}
        onOpenChange={vi.fn()}
        hideTrigger
        trigger={
          <button type="button">
            Open editor
          </button>
        }
      />,
    );

    expect(
      screen.queryByRole("button", { name: /open editor/i }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="dialog-trigger"]'),
    ).not.toBeInTheDocument();
  });

  it("removes the overlay after a controlled close", () => {
    const onOpenChange = vi.fn();
    const props = {
      category: {
        id: "c1",
        name: "Church",
        categoryType: CategoryTypeEnum.EXPENSE,
      },
      onUpdate: vi.fn(),
      onOpenChange,
      hideTrigger: true,
    };

    const { rerender } = render(
      <CategoryFormDialog
        {...props}
        open
      />,
    );

    expect(
      screen.getByRole("heading", { name: /edit category/i }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="dialog-overlay"]'),
    ).toBeInTheDocument();

    rerender(
      <CategoryFormDialog
        {...props}
        open={false}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: /edit category/i }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="dialog-overlay"]'),
    ).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("clears a leftover pointer lock when the editor is cancelled", () => {
    const onOpenChange = vi.fn();

    render(
      <CategoryFormDialog
        category={{
          id: "c1",
          name: "Church",
          categoryType: CategoryTypeEnum.EXPENSE,
        }}
        onUpdate={vi.fn()}
        open
        onOpenChange={onOpenChange}
        hideTrigger
      />,
    );

    document.body.style.pointerEvents = "none";
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("closes immediately after update without showing Updating", () => {
    const onUpdate = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CategoryFormDialog
        category={{
          id: "c1",
          name: "Transportation",
          icon: "car",
          categoryType: CategoryTypeEnum.EXPENSE,
        }}
        onUpdate={onUpdate}
        open
        onOpenChange={onOpenChange}
        hideTrigger
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/^name$/i),
      { target: { value: "Transportation updated" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));

    expect(onUpdate).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        name: "Transportation updated",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(
      screen.queryByRole("button", { name: /updating/i }),
    ).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("clears a leftover pointer lock after update", () => {
    const onUpdate = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CategoryFormDialog
        category={{
          id: "c1",
          name: "Transportation",
          icon: "car",
          categoryType: CategoryTypeEnum.EXPENSE,
        }}
        onUpdate={onUpdate}
        open
        onOpenChange={onOpenChange}
        hideTrigger
      />,
    );

    document.body.style.pointerEvents = "none";
    fireEvent.change(
      screen.getByLabelText(/^name$/i),
      { target: { value: "Transportation updated" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("clears a leftover pointer lock when the editor unmounts", () => {
    const { unmount } = render(
      <CategoryFormDialog
        category={{
          id: "c1",
          name: "Church",
          categoryType: CategoryTypeEnum.EXPENSE,
        }}
        onUpdate={vi.fn()}
        open
        onOpenChange={vi.fn()}
        hideTrigger
      />,
    );

    document.body.style.pointerEvents = "none";
    unmount();

    expect(document.body.style.pointerEvents).not.toBe("none");
  });
});
