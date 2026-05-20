import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryActionsMenu from "./category-actions-menu";

describe("CategoryActionsMenu", () => {
  it("renders an accessible actions trigger for parent categories", () => {
    render(
      <CategoryActionsMenu
        item={{ id: "p1", name: "Food" }}
        variant="parent"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddSubcategory={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /actions for food/i }),
    ).toBeInTheDocument();
  });

  it("renders an accessible actions trigger for subcategories", () => {
    render(
      <CategoryActionsMenu
        item={{ id: "s1", name: "Groceries" }}
        variant="subcategory"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /actions for groceries/i }),
    ).toBeInTheDocument();
  });
});
