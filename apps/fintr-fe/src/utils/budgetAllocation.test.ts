import { describe, expect, it } from "vitest";
import {
  buildBudgetAllocationContext,
  findParentBudgetRow,
  firstDayOfMonth,
  isBudgetOverAllocation,
  isSubcategoryTotalOverParent,
  mergeSubcategoryBudgetLines,
  sumSubcategoryBudgetLines,
  sumSubcategoryBudgets,
} from "./budgetAllocation";

describe("budgetAllocation", () => {
  const parentRow = {
    id: "parent-1",
    category_id: "cat-1",
    subcategory_id: null,
    amount: 20_000,
    has_explicit_parent_budget: true,
    subcategories: [
      {
        id: "sub-1",
        subcategoryId: "sub-a",
        name: "Japan Expense",
        budget: 5_000,
      },
      {
        id: "sub-2",
        subcategoryId: "sub-b",
        name: "Flights",
        budget: 3_000,
      },
    ],
  };

  it("finds parent row by category_id", () => {
    expect(findParentBudgetRow([parentRow], "cat-1")).toEqual(parentRow);
  });

  it("sums subcategory budgets excluding one sub", () => {
    expect(
      sumSubcategoryBudgets(parentRow, { subcategoryId: "sub-a" }),
    ).toBe(3_000);
  });

  it("blocks subcategory create when parent budget record is missing", () => {
    const rolledUpOnly = {
      ...parentRow,
      has_explicit_parent_budget: false,
    };

    const context = buildBudgetAllocationContext({
      categoryValue: "cat-1:sub-a",
      amount: 1_000,
      budgetsData: { budgets: [rolledUpOnly] } as never,
    });

    expect(context?.hasExplicitParentBudget).toBe(false);
    expect(isBudgetOverAllocation(context, 1_000)).toBe(true);
  });

  it("allows subcategory amount within parent cap", () => {
    const context = buildBudgetAllocationContext({
      categoryValue: "cat-1:sub-c",
      amount: 10_000,
      budgetsData: { budgets: [parentRow] } as never,
    });

    expect(isBudgetOverAllocation(context, 10_000)).toBe(false);
  });

  it("rejects subcategory amount over parent cap", () => {
    const context = buildBudgetAllocationContext({
      categoryValue: "cat-1:sub-c",
      amount: 15_000,
      budgetsData: { budgets: [parentRow] } as never,
    });

    expect(isBudgetOverAllocation(context, 15_000)).toBe(true);
  });

  it("rejects parent amount below subcategory total", () => {
    const context = buildBudgetAllocationContext({
      categoryValue: "cat-1",
      amount: 5_000,
      budgetsData: { budgets: [parentRow] } as never,
    });

    expect(isBudgetOverAllocation(context, 5_000)).toBe(true);
  });

  it("normalizes budget month date to first of month", () => {
    expect(firstDayOfMonth("2026-05-20")).toBe("2026-05-01");
  });

  it("merges category children with existing subcategory budgets", () => {
    const lines = mergeSubcategoryBudgetLines(
      [
        { id: "sub-a", label: "Japan Expense" },
        { id: "sub-b", label: "Flights" },
      ],
      [
        {
          id: "budget-1",
          subcategoryId: "sub-a",
          subcategoryName: "Japan Expense",
          budget: 5_000,
        },
      ],
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      subcategoryId: "sub-a",
      budgetId: "budget-1",
      amount: 5_000,
    });
    expect(lines[1]).toMatchObject({
      subcategoryId: "sub-b",
      amount: 0,
    });
  });

  it("detects when subcategory totals exceed parent", () => {
    const lines = mergeSubcategoryBudgetLines(
      [{ id: "sub-a", label: "A" }],
      [{ subcategoryId: "sub-a", budget: 6_000 }],
    );

    expect(isSubcategoryTotalOverParent(5_000, lines)).toBe(true);
    expect(sumSubcategoryBudgetLines(lines)).toBe(6_000);
  });
});
