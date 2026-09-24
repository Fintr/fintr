import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import type { BudgetsPage } from "@/types/budgetTypes";

import {
  cacheBudgetsResponse,
  loadCachedBudgetsResponse,
} from "./local-cache";

const augustPage = (): BudgetsPage => ({
  budgets: [
    {
      id: "budget-food",
      date: "2026-08-01",
      category_name: "Food",
      total_spent: 10,
      amount_currency: "PHP",
      amount: 500,
    },
  ],
  summary: {
    total_budget: 500,
    total_spent: 10,
    total_spent_percentage: 2,
    remaining: 490,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

describe("budgets local-cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("loads a calendar-month snapshot when the tab asks for first-of-month through today", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      augustPage(),
    );

    const loaded = await loadCachedBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-27",
    );

    expect(loaded?.budgets).toHaveLength(1);
    expect(loaded?.budgets[0]?.id).toBe("budget-food");
  });

  it("normalizes camelCase bootstrap snapshots so summary matches the list", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      {
        budgets: [
          {
            id: "budget-transport",
            date: "2026-08-01",
            categoryName: "Transportation1",
            amount: 12_000,
            totalSpent: 0,
          } as never,
          {
            id: "budget-church",
            date: "2026-08-01",
            categoryName: "Church1",
            amount: 20_001,
            totalSpent: 32_320.85,
          } as never,
        ],
        summary: {
          totalBudget: 0,
          totalSpent: 0,
          remaining: -1_699_690,
        } as never,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
    );

    const loaded = await loadCachedBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );

    expect(loaded?.budgets[0]?.category_name).toBe("Transportation1");
    expect(loaded?.summary?.total_budget).toBe(32_001);
    expect(loaded?.summary?.total_spent).toBe(32_320.85);
    expect(loaded?.summary?.remaining).toBeCloseTo(-319.85, 2);
  });
});
