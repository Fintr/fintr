import { describe, expect, it } from "vitest";

import type { BudgetsPage } from "@/types/budgetTypes";

import {
  addParentBudgetRowToPage,
  budgetsPageForNetworkCache,
  mergeSavedLocalBudgets,
} from "./budget-cache-ops";
import {
  normalizeBudgetsPage,
  recalculateBudgetSummary,
} from "./normalize-budgets-page";

const screenshotPage = (): BudgetsPage => ({
  budgets: [
    {
      id: "budget-transport",
      date: "2026-08-01",
      category_name: "Transportation1",
      category_id: "cat-transport",
      total_spent: 0,
      amount_currency: "PHP",
      amount: 12_000,
      has_explicit_parent_budget: false,
      subcategories: [
        {
          id: "",
          subcategory_id: "sub-car",
          amount: 0,
          budget: 0,
          spent: 0,
        },
        {
          id: "budget-commute",
          subcategory_id: "sub-commute",
          amount: 500,
          budget: 500,
          spent: 0,
        },
        {
          id: "budget-driver",
          subcategory_id: "sub-driver",
          amount: 2_000,
          budget: 2_000,
          spent: 0,
        },
        {
          id: "budget-gas",
          subcategory_id: "sub-gas",
          amount: 8_000,
          budget: 8_000,
          spent: 0,
        },
        {
          id: "budget-parking",
          subcategory_id: "sub-parking",
          amount: 1_500,
          budget: 1_500,
          spent: 0,
        },
      ],
    },
    {
      id: "budget-church",
      date: "2026-08-01",
      category_name: "Church1",
      category_id: "cat-church",
      total_spent: 32_320.85,
      amount_currency: "PHP",
      amount: 20_001,
      has_explicit_parent_budget: true,
      subcategories: [],
    },
  ],
  summary: {
    total_budget: 0,
    total_spent: 0,
    total_spent_percentage: 0,
    remaining: -1_699_690,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

describe("recalculateBudgetSummary", () => {
  it("sums the displayed parent totals instead of stale or all-expense remaining", () => {
    const page = recalculateBudgetSummary(screenshotPage());

    expect(page.summary).toEqual({
      total_budget: 32_001,
      total_spent: 32_320.85,
      total_spent_percentage: expect.closeTo(101.0, 1),
      remaining: expect.closeTo(-319.85, 2),
    });
  });

  it("does not add subcategory amounts on top of a rolled-up parent total", () => {
    const page = recalculateBudgetSummary(screenshotPage());

    expect(page.summary?.total_budget).toBe(32_001);
  });
});

describe("normalizeBudgetsPage", () => {
  it("normalizes camelCase bootstrap snapshots and recomputes summary from rows", () => {
    const page = normalizeBudgetsPage({
      budgets: [
        {
          id: "budget-transport",
          date: "2026-08-01",
          categoryName: "Transportation1",
          categoryId: "cat-transport",
          totalSpent: 0,
          amountCurrency: "PHP",
          amount: 12_000,
          hasExplicitParentBudget: false,
          subcategories: [
            {
              id: "budget-gas",
              subcategoryId: "sub-gas",
              subcategoryName: "Gas",
              amount: 8_000,
              spent: 0,
            },
          ],
        },
        {
          id: "budget-church",
          date: "2026-08-01",
          categoryName: "Church1",
          categoryId: "cat-church",
          totalSpent: 32_320.85,
          amountCurrency: "PHP",
          amount: 20_001,
          hasExplicitParentBudget: true,
          subcategories: [],
        },
      ],
      summary: {
        totalBudget: 0,
        totalSpent: 0,
        totalSpentPercentage: 0,
        remaining: -1_699_690,
      },
      nextPage: null,
      totalPages: null,
      totalCount: null,
    });

    expect(page.budgets).toHaveLength(2);
    expect(page.budgets[0]?.category_name).toBe("Transportation1");
    expect(page.budgets[1]?.total_spent).toBe(32_320.85);
    expect(page.summary?.total_budget).toBe(32_001);
    expect(page.summary?.total_spent).toBe(32_320.85);
    expect(page.summary?.remaining).toBeCloseTo(-319.85, 2);
  });
});

describe("addParentBudgetRowToPage", () => {
  it("replaces a deleted category row with the new budget amount", () => {
    const page = addParentBudgetRowToPage(
      {
        budgets: [
          {
            id: "",
            category_id: "cat-home",
            category_name: "Home",
            amount: 0,
            total_spent: 18_800,
            has_explicit_parent_budget: false,
            subcategories: [],
          },
          {
            id: "budget-food",
            category_id: "cat-food",
            category_name: "Food",
            amount: 20_000,
            total_spent: 12_000,
            has_explicit_parent_budget: true,
            subcategories: [],
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
      {
        id: "local:home",
        category_id: "cat-home",
        category_name: "Home",
        amount: 30_000,
        total_spent: 0,
        has_explicit_parent_budget: true,
        subcategories: [],
      },
    );

    expect(page.budgets).toHaveLength(2);
    expect(page.budgets[0]).toMatchObject({
      id: "local:home",
      amount: 30_000,
      total_spent: 18_800,
      has_explicit_parent_budget: true,
    });
    expect(page.summary?.total_budget).toBe(50_000);
  });
});

describe("mergeSavedLocalBudgets", () => {
  it("keeps a budget saved while the page was being rebuilt", () => {
    const page = mergeSavedLocalBudgets(
      {
        budgets: [
          {
            id: "",
            category_id: "cat-home",
            category_name: "Home",
            amount: 0,
            total_spent: 18_800,
            has_explicit_parent_budget: false,
            subcategories: [],
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
      {
        budgets: [
          {
            id: "local:home",
            category_id: "cat-home",
            category_name: "Home",
            amount: 30_000,
            total_spent: 0,
            has_explicit_parent_budget: true,
            subcategories: [],
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
    );

    expect(page.budgets).toHaveLength(1);
    expect(page.budgets[0]).toMatchObject({
      id: "local:home",
      amount: 30_000,
      total_spent: 18_800,
    });
  });

  it("keeps a saved server budget when the rebuilt page only has spending", () => {
    const page = mergeSavedLocalBudgets(
      {
        budgets: [
          {
            id: "",
            category_id: "cat-home",
            category_name: "Home",
            amount: 0,
            total_spent: 18_800,
            has_explicit_parent_budget: false,
            subcategories: [],
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
      {
        budgets: [
          {
            id: "budget-home",
            category_id: "cat-home",
            category_name: "Home",
            amount: 30_000,
            total_spent: 18_800,
            has_explicit_parent_budget: true,
            subcategories: [],
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
    );

    expect(page.budgets).toHaveLength(1);
    expect(page.budgets[0]).toMatchObject({
      id: "budget-home",
      amount: 30_000,
      total_spent: 18_800,
      has_explicit_parent_budget: true,
    });
  });
});

describe("budgetsPageForNetworkCache", () => {
  it("keeps a budget created locally when a server page arrives without it", () => {
    const local = {
      budgets: [
        {
          id: "local:home",
          category_id: "cat-home",
          amount: 30_000,
          total_spent: 18_800,
        },
      ],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    };
    const fetched = {
      budgets: [
        {
          id: "",
          category_id: "cat-home",
          amount: 0,
          total_spent: 18_800,
        },
      ],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    };

    expect(
      budgetsPageForNetworkCache({
        fetched,
        local,
      }).budgets[0],
    ).toMatchObject({
      id: "local:home",
      amount: 30_000,
      total_spent: 18_800,
    });
  });
});
