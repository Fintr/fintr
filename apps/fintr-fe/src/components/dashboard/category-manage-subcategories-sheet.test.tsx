import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { CategoryManageSubcategoriesSheet } from "./category-manage-subcategories-sheet";

describe("CategoryManageSubcategoriesSheet", () => {
  it("pads the sheet body and subcategory rows away from the screen edges", async () => {
    render(
      <CategoryManageSubcategoriesSheet
        open
        onOpenChange={vi.fn()}
        parentName="Transportation"
        subcategories={[
          { id: "s1", name: "Car", icon: "car", color: "#c0392b" },
        ]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onConvertToParent={vi.fn()}
      />,
    );

    const description = await screen.findByText(
      /Edit names and icons for Transportation subcategories/,
    );

    expect(description.parentElement).toHaveClass("px-6", "pb-6");

    const row = screen.getByText("Car").closest("li");
    expect(row).toHaveClass("px-4", "py-3");
  });
});
