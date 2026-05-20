import { describe, expect, it } from "vitest";
import {
  enrichCategoriesWithSubcategoryTree,
  transformBudgetsToCategories,
} from "./queries";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";

describe("budget queries", () => {
  it("transformBudgetsToCategories maps parent_only_spent from API rows", () => {
    const categories = transformBudgetsToCategories([
      {
        id: "budget-1",
        category_id: "cat-travel",
        category_name: "Travel & Vacations",
        total_spent: 1332,
        amount: 20_000,
        parent_only_spent: 1132,
        has_explicit_parent_budget: true,
        subcategories: [
          {
            id: "sub-budget-1",
            subcategory_id: "sub-church",
            subcategory_name: "Church",
            spent: 200,
            amount: 1000,
          },
        ],
      },
    ]);

    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      categoryId: "cat-travel",
      name: "Travel & Vacations",
      spent: 1332,
      budget: 20_000,
      parentOnlySpent: 1132,
      hasExplicitParentBudget: true,
    });
    expect(categories[0].subcategories[0]).toMatchObject({
      subcategoryId: "sub-church",
      subcategoryName: "Church",
      spent: 200,
      budget: 1000,
    });
  });

  it("enrichCategoriesWithSubcategoryTree fills missing subcategory placeholders", () => {
    const expenseOptions: CategoryTreeOption[] = [
      {
        id: "cat-travel",
        label: "Travel",
        value: "Travel",
        name: "Travel",
        parentId: null,
        children: [
          {
            id: "sub-japan",
            label: "Japan 2026",
            value: "Japan 2026",
            name: "Japan 2026",
            parentId: "cat-travel",
          },
        ],
      },
    ];

    const enriched = enrichCategoriesWithSubcategoryTree(
      [
        {
          id: "budget-1",
          name: "Travel",
          categoryId: "cat-travel",
          spent: 0,
          budget: 20_000,
          color: "#000",
          subcategories: [],
        },
      ],
      expenseOptions,
    );

    expect(enriched[0].subcategories).toHaveLength(1);
    expect(enriched[0].subcategories[0]).toMatchObject({
      subcategoryId: "sub-japan",
      subcategoryName: "Japan 2026",
      budget: 0,
      spent: 0,
    });
  });
});
