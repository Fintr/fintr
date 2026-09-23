import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLocalDb, resetLocalDbForTests } from "@/lib/local-db";
import { cacheBudgetsResponse, loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import type { BudgetsPage } from "@/types/budgetTypes";

vi.mock("@/services/budgets/queries", () => ({
  fetchBudgetsPage: vi.fn(),
}));

import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  applyBudgetSpendingToPage,
  catchUpMonthlyBudgetsLocalFirst,
  ensureMonthlyBudgetsLocalFirst,
} from "./ensure-monthly-budgets-local-first";

const julyPage = (): BudgetsPage => ({
  budgets: [
    {
      id: "budget-food",
      date: "2026-07-01",
      category_name: "Food",
      category_id: "cat-food",
      total_spent: 120,
      amount_currency: "PHP",
      amount: 500,
      has_explicit_parent_budget: true,
      subcategories: [],
    },
  ],
  summary: {
    total_budget: 500,
    total_spent: 120,
    total_spent_percentage: 24,
    remaining: 380,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

describe("ensureMonthlyBudgetsLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBudgetsPage).mockImplementation(() => new Promise(() => {}));
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("copies last month's budgets into an empty month and enqueues ensure-month", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-07-01",
      "2026-07-31",
      julyPage(),
    );

    const result = await ensureMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-08-01",
        endDate: "2026-08-27",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(true);
    expect(result.page.budgets).toHaveLength(1);
    expect(String(result.page.budgets[0]?.id).startsWith("local:")).toBe(true);
    expect(result.page.budgets[0]?.date).toBe("2026-08-01");
    expect(result.page.budgets[0]?.amount).toBe(500);

    const cached = await loadCachedBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-27",
    );
    expect(cached?.budgets).toHaveLength(1);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe("budget.create");
    expect(outbox[0]?.payload).toEqual(
      expect.objectContaining({
        amount: 500,
        categoryId: "cat-food",
        date: "2026-08-01",
      }),
    );
  });

  it("copies missing previous-month budgets even when the target month already has some", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-07-01",
      "2026-07-31",
      {
        budgets: [
          {
            id: "july-transport",
            date: "2026-07-01",
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
                spent: 0,
              },
            ],
          },
          {
            id: "july-church",
            date: "2026-07-01",
            category_id: "cat-church",
            category_name: "Church1",
            amount: 20_001,
            has_explicit_parent_budget: true,
            subcategories: [],
          },
          {
            id: "july-food",
            date: "2026-07-01",
            category_id: "cat-food",
            category_name: "Food",
            amount: 5_000,
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
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      {
        budgets: [
          {
            id: "aug-transport",
            date: "2026-08-01",
            category_id: "cat-transport",
            category_name: "Transportation1",
            amount: 12_000,
            has_explicit_parent_budget: false,
            subcategories: [
              {
                id: "aug-gas",
                subcategory_id: "sub-gas",
                amount: 8_000,
                budget: 8_000,
                spent: 0,
              },
            ],
          },
          {
            id: "aug-church",
            date: "2026-08-01",
            category_id: "cat-church",
            category_name: "Church1",
            amount: 20_001,
            total_spent: 32_320.85,
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
      },
    );

    const result = await ensureMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(true);
    expect(result.page.budgets).toHaveLength(3);
    expect(result.page.budgets.map((row) => row.category_name)).toEqual([
      "Transportation1",
      "Church1",
      "Food",
    ]);
    expect(result.page.summary?.total_budget).toBe(37_001);
    expect(result.page.summary?.total_spent).toBe(32_320.85);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe("budget.create");
    expect(outbox[0]?.payload).toEqual(
      expect.objectContaining({
        amount: 5_000,
        categoryId: "cat-food",
      }),
    );
  });

  it("fills an incomplete previous month from two months back before copying into the viewed month", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-07-01",
      "2026-07-31",
      {
        budgets: [
          {
            id: "july-transport",
            date: "2026-07-01",
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
                spent: 0,
              },
            ],
          },
          {
            id: "july-church",
            date: "2026-07-01",
            category_id: "cat-church",
            category_name: "Church1",
            amount: 20_001,
            has_explicit_parent_budget: true,
            subcategories: [],
          },
          {
            id: "july-food",
            date: "2026-07-01",
            category_id: "cat-food",
            category_name: "Food",
            amount: 5_000,
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
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      {
        budgets: [
          {
            id: "aug-transport",
            date: "2026-08-01",
            category_id: "cat-transport",
            category_name: "Transportation1",
            amount: 12_000,
            has_explicit_parent_budget: false,
            subcategories: [
              {
                id: "aug-gas",
                subcategory_id: "sub-gas",
                amount: 8_000,
                budget: 8_000,
                spent: 0,
              },
            ],
          },
          {
            id: "aug-church",
            date: "2026-08-01",
            category_id: "cat-church",
            category_name: "Church1",
            amount: 20_001,
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

    const result = await ensureMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(true);
    expect(result.page.budgets.map((row) => row.category_name)).toEqual([
      "Transportation1",
      "Church1",
      "Food",
    ]);

    const august = await loadCachedBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(august?.budgets.map((row) => row.category_name)).toEqual([
      "Transportation1",
      "Church1",
      "Food",
    ]);

    const outbox = await getLocalDb().outbox.toArray();
    const foodCreates = outbox.filter((record) => {
      const payload = record.payload as { categoryId?: string };
      return payload.categoryId === "cat-food";
    });
    expect(foodCreates).toHaveLength(2);
  });

  it("copies through several skipped months when the app opens months later", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-07-01",
      "2026-07-31",
      julyPage(),
    );

    const result = await ensureMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(true);
    expect(result.page.budgets).toHaveLength(1);
    expect(result.page.budgets[0]?.date).toBe("2026-11-01");
    expect(result.page.budgets[0]?.amount).toBe(500);

    const october = await loadCachedBudgetsResponse(
      "space-a",
      "2026-10-01",
      "2026-10-31",
    );
    expect(october?.budgets).toHaveLength(1);
    expect(october?.budgets[0]?.date).toBe("2026-10-01");

    const foodCreates = (await getLocalDb().outbox.toArray()).filter((record) => {
      const payload = record.payload as { categoryId?: string };
      return payload.categoryId === "cat-food";
    });
    expect(foodCreates).toHaveLength(4);
  });

  it("does not copy when the target month already has every previous-month budget", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      {
        budgets: [
          {
            id: "budget-transport",
            date: "2026-08-01",
            category_name: "Transport",
            total_spent: 0,
            amount_currency: "PHP",
            amount: 300,
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
    );

    const result = await ensureMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-08-01",
        endDate: "2026-08-27",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(false);
    expect(result.page.budgets[0]?.id).toBe("budget-transport");
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("no-ops when last month has no budgets to copy", async () => {
    const result = await ensureMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(false);
    expect(result.page.budgets).toEqual([]);
    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});

describe("catchUpMonthlyBudgetsLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBudgetsPage).mockImplementation(() => new Promise(() => {}));
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("copies last month's budgets into the current month even if that month was never opened", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-07-01",
      "2026-07-31",
      julyPage(),
    );

    const result = await catchUpMonthlyBudgetsLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        asOfStartDate: "2026-09-01",
      },
      { waitForSync: false },
    );

    expect(result.created).toBe(true);
    expect(result.page.budgets[0]?.date).toBe("2026-09-01");

    const august = await loadCachedBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(august?.budgets[0]?.date).toBe("2026-08-01");
  });
});

describe("applyBudgetSpendingToPage", () => {
  it("fills parent spent from local expenses so summary matches the list", () => {
    const page = applyBudgetSpendingToPage(
      {
        budgets: [
          {
            id: "budget-church",
            category_id: "cat-church",
            category_name: "Church1",
            amount: 20_001,
            total_spent: 0,
            subcategories: [],
          },
          {
            id: "budget-transport",
            category_id: "cat-transport",
            category_name: "Transportation1",
            amount: 12_000,
            total_spent: 0,
            subcategories: [],
          },
        ],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      },
      [
        {
          id: "tx-1",
          date: "2026-08-10",
          description: "Tithe",
          amount: 32_320.85,
          categoryName: "Church1",
          categoryId: "cat-church",
          fromAccountName: "Cash",
          toAccountName: "",
          type: "expense",
          inSeries: false,
          hasImage: false,
          calculated: true,
        },
      ],
    );

    expect(page.budgets[0]?.total_spent).toBe(32_320.85);
    expect(page.summary?.total_budget).toBe(32_001);
    expect(page.summary?.total_spent).toBe(32_320.85);
    expect(page.summary?.remaining).toBeCloseTo(-319.85, 2);
  });
});
