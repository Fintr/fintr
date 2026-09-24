import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import DeleteCategoryDialog from "./delete-category-dialog";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("DeleteCategoryDialog", () => {
  it("uses theme-aware text for the confirmation message in dark mode", () => {
    render(
      <DeleteCategoryDialog
        category={{ id: "cat-1", name: "Pet" }}
        onDelete={vi.fn()}
        open
        onOpenChange={vi.fn()}
        hideTrigger
      />,
    );

    const description = screen.getByText(/Are you sure you want to delete/i);
    expect(description).toHaveClass("text-muted-foreground");

    const categoryName = screen.getByText(/"Pet"/);
    expect(categoryName).toHaveClass("text-primary");
    expect(categoryName).not.toHaveClass("text-gray-900");
  });
});
