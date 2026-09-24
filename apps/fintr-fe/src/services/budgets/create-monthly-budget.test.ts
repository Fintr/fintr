import { describe, expect, it } from "vitest";

import {
  createMonthlyBudgetsPage,
  monthHasPersistedBudgets,
  previousCalendarMonthRange,
} from "./create-monthly-budget";
import type { BudgetsPage } from "@/types/budgetTypes";

const julyPage = (): BudgetsPage => ({
  budgets: [
    {
      id: "budget-food",
      date: "2026-07-01",
      category_name: "Food",
      category_id: "cat-food",
      subcategory_id: null,
      total_spent: 120,
      amount_currency: "PHP",
      amount: 500,
      has_explicit_parent_budget: true,
      parent_only_spent: 20,
      subcategories: [
        {
          id: "budget-groceries",
          subcategory_id: "sub-groceries",
          subcategory_name: "Groceries",
          amount: 200,
          budget: 200,
          spent: 80,
          date: "2026-07-01",
          amount_currency: "PHP",
        },
        {
          id: "",
          subcategory_id: "sub-dining",
          subcategory_name: "Dining",
          amount: 0,
          budget: 0,
          spent: 40,
          date: null,
          amount_currency: null,
        },
      ],
    },
  ],
  summary: {
    total_budget: 700,
    total_spent: 240,
    total_spent_percentage: 34.29,
    remaining: 460,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

describe("previousCalendarMonthRange", () => {
  it("returns the previous calendar month for a mid-month start date", () => {
    expect(previousCalendarMonthRange("2026-08-15")).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("wraps from January to December of the previous year", () => {
    expect(previousCalendarMonthRange("2026-01-01")).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });
});

describe("monthHasPersistedBudgets", () => {
  it("is false for an empty page", () => {
    expect(
      monthHasPersistedBudgets({
        budgets: [],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      }),
    ).toBe(false);
  });

  it("is true when a parent budget row has an id", () => {
    expect(monthHasPersistedBudgets(julyPage())).toBe(true);
  });
});

describe("createMonthlyBudgetsPage", () => {
  it("copies last month's budget rows into the target month with new ids", () => {
    let nextId = 0;
    const page = createMonthlyBudgetsPage({
      previousPage: julyPage(),
      targetStartDate: "2026-08-01",
      createId: () => `local:budget-${++nextId}`,
    });

    expect(page.budgets).toHaveLength(1);
    const parent = page.budgets[0] as Record<string, unknown>;
    expect(parent.id).toBe("local:budget-1");
    expect(parent.date).toBe("2026-08-01");
    expect(parent.category_id).toBe("cat-food");
    expect(parent.amount).toBe(500);
    expect(parent.total_spent).toBe(0);
    expect(parent.parent_only_spent).toBe(0);

    const subcategories = parent.subcategories as Record<string, unknown>[];
    expect(subcategories).toHaveLength(1);
    expect(subcategories[0]?.id).toBe("local:budget-2");
    expect(subcategories[0]?.subcategory_id).toBe("sub-groceries");
    expect(subcategories[0]?.amount).toBe(200);
    expect(subcategories[0]?.spent).toBe(0);
    expect(subcategories[0]?.date).toBe("2026-08-01");
  });

  it("does not copy spending-only subcategory rows without a budget id", () => {
    const page = createMonthlyBudgetsPage({
      previousPage: julyPage(),
      targetStartDate: "2026-08-01",
      createId: () => "local:x",
    });

    const parent = page.budgets[0] as Record<string, unknown>;
    const subcategories = parent.subcategories as Record<string, unknown>[];
    expect(
      subcategories.map((sub) => sub.subcategory_id),
    ).toEqual(["sub-groceries"]);
  });

  it("recalculates summary from displayed parent totals with zero spent", () => {
    const page = createMonthlyBudgetsPage({
      previousPage: julyPage(),
      targetStartDate: "2026-08-01",
      createId: () => "local:x",
    });

    expect(page.summary).toEqual({
      total_budget: 500,
      total_spent: 0,
      total_spent_percentage: 0,
      remaining: 500,
    });
  });

  it("copies every previous-month parent that is missing from the target month", () => {
    let nextId = 0;
    const previousPage: BudgetsPage = {
      budgets: [
        {
          id: "july-transport",
          category_id: "cat-transport",
          category_name: "Transportation1",
          amount: 12_000,
          has_explicit_parent_budget: false,
          subcategories: [
            {
              id: "july-gas",
              subcategory_id: "sub-gas",
              amount: 8_000,
              budget: 8_000,
              spent: 100,
            },
          ],
        },
        {
          id: "july-church",
          category_id: "cat-church",
          category_name: "Church1",
          amount: 20_001,
          total_spent: 1,
          has_explicit_parent_budget: true,
          subcategories: [],
        },
        {
          id: "july-food",
          category_id: "cat-food",
          category_name: "Food",
          amount: 5_000,
          has_explicit_parent_budget: true,
          subcategories: [],
        },
        {
          id: "july-rent",
          category_id: "cat-rent",
          category_name: "Rent",
          amount: 15_000,
          has_explicit_parent_budget: true,
          subcategories: [],
        },
        {
          id: "july-utilities",
          category_id: "cat-utilities",
          category_name: "Utilities",
          amount: 3_000,
          has_explicit_parent_budget: true,
          subcategories: [],
        },
        {
          id: "july-health",
          category_id: "cat-health",
          category_name: "Health",
          amount: 2_000,
          has_explicit_parent_budget: true,
          subcategories: [],
        },
        {
          id: "july-fun",
          category_id: "cat-fun",
          category_name: "Fun",
          amount: 1_500,
          has_explicit_parent_budget: true,
          subcategories: [],
        },
      ],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    };
    const existingPage: BudgetsPage = {
      budgets: [
        previousPage.budgets[0]!,
        previousPage.budgets[1]!,
      ],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    };

    const page = createMonthlyBudgetsPage({
      previousPage,
      existingPage,
      targetStartDate: "2026-08-01",
      createId: () => `local:budget-${++nextId}`,
    });

    expect(page.budgets).toHaveLength(7);
    expect(page.budgets.map((row) => row.category_name)).toEqual([
      "Transportation1",
      "Church1",
      "Food",
      "Rent",
      "Utilities",
      "Health",
      "Fun",
    ]);
    expect(page.budgets[0]?.id).toBe("july-transport");
    expect(String(page.budgets[2]?.id).startsWith("local:")).toBe(true);
    expect(page.summary?.total_budget).toBe(58_501);
  });
});
