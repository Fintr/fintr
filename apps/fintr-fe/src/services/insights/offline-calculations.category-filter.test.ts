import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const PARENT_ID = "11111111-1111-4111-8111-111111111111";

const mockTransactions: IndexTransaction[] = [
  {
    id: "food-1",
    date: "2026-03-15",
    description: "Groceries",
    amount: 500,
    categoryName: "Food & Groceries",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: false,
    hasImage: false,
  },
  {
    id: "food-2",
    date: "2026-04-10",
    description: "More groceries",
    amount: 300,
    categoryName: "Food & Groceries",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: false,
    hasImage: false,
  },
  {
    id: "home-1",
    date: "2026-04-02",
    description: "Rent",
    amount: 15000,
    categoryName: "Home",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: false,
    hasImage: false,
  },
];

vi.mock("@/services/transactions/local-cache", () => ({
  loadCachedTransactionsInRange: vi.fn(),
}));

vi.mock("@/services/monthly-financial-summaries/local-cache", () => ({
  loadCachedMonthlyFinancialSummaries: vi.fn(async () => []),
}));

vi.mock("@/services/budgets/local-cache", () => ({
  loadCachedBudgetsResponse: vi.fn(async () => ({ budgets: [] })),
}));

vi.mock("@/services/loans/local-cache", () => ({
  loadCachedLoansInfiniteData: vi.fn(async () => ({ pages: [] })),
}));

import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { buildOfflineInsightsBundle } from "./offline-calculations";

const categoryOptions = {
  expense: [
    {
      id: PARENT_ID,
      label: "Food & Groceries",
      value: PARENT_ID,
      name: "Food & Groceries",
      parentId: null,
      children: [],
    },
  ],
  income: [],
};

describe("buildOfflineInsightsBundle category filter", () => {
  beforeEach(() => {
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue(mockTransactions);
  });

  it("sums only transactions in the selected category for a multi-month range", async () => {
    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      categoryName: "Food & Groceries",
      categoryId: PARENT_ID,
      categoryOptions,
    });

    expect(bundle.summary).toEqual({
      totalIncome: 0,
      totalExpenses: 800,
      netSavings: -800,
    });
    expect(bundle.expenseBreakdown).toHaveLength(1);
    expect(bundle.expenseBreakdown[0]?.name).toBe("Food & Groceries");
    expect(bundle.merchantBreakdown.some((row) => row.name === "Unassigned")).toBe(
      true,
    );
  });

  it("puts category-filtered expense amounts on the expense trends series without savings", async () => {
    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      categoryName: "Food & Groceries",
      categoryId: PARENT_ID,
      categoryOptions,
    });

    const march = bundle.monthlySpending.find((row) => row.month === "Mar");
    const april = bundle.monthlySpending.find((row) => row.month === "Apr");

    expect(march).toMatchObject({
      income: 0,
      expenses: -500,
      savings: 0,
    });
    expect(april).toMatchObject({
      income: 0,
      expenses: -300,
      savings: 0,
    });
    expect(bundle.monthlySpending.every((row) => row.savings === 0)).toBe(true);
  });

  it("puts category-filtered income amounts on the income trends series without savings", async () => {
    const incomeId = "22222222-2222-4222-8222-222222222222";
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([
      {
        id: "salary-1",
        date: "2026-03-01",
        description: "Pay",
        amount: 40000,
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "salary-2",
        date: "2026-04-01",
        description: "Pay",
        amount: 42000,
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
    ]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      categoryName: "Salary",
      categoryId: incomeId,
      categoryOptions: {
        expense: [],
        income: [
          {
            id: incomeId,
            label: "Salary",
            value: incomeId,
            name: "Salary",
            parentId: null,
            children: [],
          },
        ],
      },
    });

    const march = bundle.monthlySpending.find((row) => row.month === "Mar");
    const april = bundle.monthlySpending.find((row) => row.month === "Apr");

    expect(march).toMatchObject({
      income: 40000,
      expenses: -0,
      savings: 0,
    });
    expect(april).toMatchObject({
      income: 42000,
      expenses: -0,
      savings: 0,
    });
  });

  it("still matches when filter categoryName was briefly a picker id before tree load", async () => {
    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      categoryName: PARENT_ID,
      categoryId: PARENT_ID,
      categoryOptions,
    });

    expect(bundle.summary.totalExpenses).toBe(800);
  });
});
