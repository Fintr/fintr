import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CategoryToggle from "./category-toggle";

describe("CategoryToggle", () => {
  it("labels the expense and income tabs on narrow phones", () => {
    render(
      <CategoryToggle
        activeCategory="expense"
        onCategoryChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Expense").className).not.toContain("hidden");
    expect(screen.getByText("Income").className).not.toContain("hidden");
  });
});
