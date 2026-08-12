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

vi.mock("@/services/transactions/local-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/transactions/local-cache")>();
  return {
    ...actual,
    loadCachedTransactionsInRange: vi.fn(),
    loadAllCachedTransactionsForInsights: vi.fn(),
    loadAllTransactionsFromLocalIndex: vi.fn(async () => []),
    loadScatteredTransactionSnapshotsFromMeta: vi.fn(async () => []),
    mergeMetaTransactionSnapshotsIntoIndex: vi.fn(async () => undefined),
  };
});

vi.mock("@/services/monthly-financial-summaries/hydrate-from-local-transactions", () => ({
  summariesNeedLocalHydration: vi.fn(async () => false),
  hydrateMonthlyFinancialSummariesFromLocalTransactions: vi.fn(
    async (_spaceCode: string, options?: { existingSummaries?: unknown[] }) =>
      options?.existingSummaries ?? [],
  ),
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

import {
  loadAllCachedTransactionsForInsights,
  loadCachedTransactionsInRange,
} from "@/services/transactions/local-cache";
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
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue(
      mockTransactions,
    );
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

  it("resolves picker-id categoryName to a label so offline filters still match", async () => {
    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      // Offline UI often passes the raw picker UUID when category options
      // were empty at selection time.
      categoryName: PARENT_ID,
      categoryId: PARENT_ID,
      categoryOptions,
    });

    expect(bundle.summary.totalExpenses).toBe(800);
    expect(bundle.summary.netSavings).toBe(-800);
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
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue([
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

  it("sums only transactions with the selected tag", async () => {
    const tagId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue([
      {
        id: "tagged",
        date: "2026-03-15",
        description: "Trip",
        amount: 1200,
        categoryName: "Travel",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        tags: [{ id: tagId, name: "Japan 2026", color: "#0A3D62" }],
      },
      {
        id: "untagged",
        date: "2026-03-20",
        description: "Other",
        amount: 900,
        categoryName: "Travel",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        tags: [],
      },
    ]);
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      tagIds: [tagId],
    });

    expect(bundle.summary).toEqual({
      totalIncome: 0,
      totalExpenses: 1200,
      netSavings: -1200,
    });
  });

  it("still totals tagged past rows when re-sync marked calculated false", async () => {
    const tagId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue([
      {
        id: "japan-pending-flag",
        date: "2026-08-11",
        description: "Trip",
        amount: 41037.1,
        categoryName: "Dine Out & Entertainment",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        calculated: false,
        tags: [{ id: tagId, name: "Japan 2026", color: "#f472b6" }],
        tagIds: [tagId],
      },
    ]);
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      tagIds: [tagId],
    });

    expect(bundle.summary.totalExpenses).toBe(41037.1);
  });

  it("restores tag filter totals from seed metadata when Dexie rows lost tags", async () => {
    const tagId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue([
      {
        id: "japan-stripped",
        date: "2026-08-11",
        description: "Trip",
        amount: 41037.1,
        categoryName: "Dine Out & Entertainment",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    ]);
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      tagIds: [tagId],
      seedTransactions: [
        {
          id: "japan-stripped",
          date: "2026-08-11",
          description: "Trip",
          amount: 41037.1,
          categoryName: "Dine Out & Entertainment",
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
          tags: [{ id: tagId, name: "Japan 2026", color: "#f472b6" }],
          tagIds: [tagId],
        },
      ],
    });

    expect(bundle.summary.totalExpenses).toBe(41037.1);
  });

  it("sums foreign-currency category rows using space display amounts without rates", async () => {
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue([
      {
        id: "church-fx",
        date: "2026-03-15",
        description: "Tithe",
        amount: 2500,
        amountCurrency: "PHP",
        bookedAmount: 45,
        bookedAmountCurrency: "USD",
        categoryName: "Church",
        categoryId: PARENT_ID,
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    ]);
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      categoryName: "Church",
      categoryId: PARENT_ID,
      categoryOptions: {
        expense: [
          {
            id: PARENT_ID,
            label: "Church",
            value: PARENT_ID,
            name: "Church",
            parentId: null,
            children: [],
          },
        ],
        income: [],
      },
    });

    expect(bundle.summary.totalExpenses).toBe(2500);
    expect(bundle.expenseBreakdown[0]?.name).toBe("Church");
  });

  it("matches categoryId filter using only categoryName on Dexie rows when options resolve the label", async () => {
    const dineId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const japanTagId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    vi.mocked(loadAllCachedTransactionsForInsights).mockResolvedValue([
      {
        id: "dine-name-only",
        date: "2026-08-11",
        description: "Coffee",
        amount: 41037.1,
        categoryName: "Dine Out & Entertainment",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        tagIds: [japanTagId],
        tags: [{ id: japanTagId, name: "Japan 2026", color: "#f472b6" }],
      },
    ]);
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([]);

    const options = {
      expense: [
        {
          id: dineId,
          label: "Dine Out & Entertainment",
          value: dineId,
          name: "Dine Out & Entertainment",
          parentId: null,
          children: [],
        },
      ],
      income: [],
    };

    const byCategory = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      categoryName: dineId,
      categoryId: dineId,
      categoryOptions: options,
    });
    expect(byCategory.summary.totalExpenses).toBeCloseTo(41037.1);

    const byTag = await buildOfflineInsightsBundle({
      spaceCode: "space-a",
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      tagIds: [japanTagId],
    });
    expect(byTag.summary.totalExpenses).toBeCloseTo(41037.1);
  });
});
