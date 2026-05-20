import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryList from "./category-list";
import { CategoryTypeEnum } from "@/types/categoryTypes";

describe("CategoryList", () => {
  it("renders root categories with subcategory counts and detail links", () => {
    render(
      <CategoryList
        kind="expense"
        addButtonLabel="Add new expense category"
        onAddRoot={vi.fn()}
        categories={[
          {
            id: "p1",
            name: "Food",
            categoryType: CategoryTypeEnum.EXPENSE,
            children: [
              {
                id: "s1",
                name: "Groceries",
                categoryType: CategoryTypeEnum.EXPENSE,
                parentId: "p1",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("1 subcategory")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /food/i })).toHaveAttribute(
      "href",
      "/dashboard/space_settings/categories/detail?categoryId=p1&kind=expense",
    );
  });

  it("hides subcategory label when a category has none", () => {
    render(
      <CategoryList
        kind="expense"
        addButtonLabel="Add new expense category"
        onAddRoot={vi.fn()}
        categories={[
          {
            id: "p2",
            name: "Credit Card",
            categoryType: CategoryTypeEnum.EXPENSE,
            children: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("Credit Card")).toBeInTheDocument();
    expect(screen.queryByText(/subcategor/i)).not.toBeInTheDocument();
  });

  it("shows empty state when there are no categories", () => {
    render(
      <CategoryList
        kind="income"
        addButtonLabel="Add new income category"
        onAddRoot={vi.fn()}
        categories={[]}
      />,
    );

    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
  });
});
