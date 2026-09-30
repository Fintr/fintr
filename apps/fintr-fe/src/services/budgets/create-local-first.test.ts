import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_BUDGET_DELETE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { applyBudgetsPageToCaches } from "@/services/budgets/budget-cache-ops";
import { cacheBudgetsResponse, loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import type { BudgetsPage } from "@/types/budgetTypes";

vi.mock("@/services/budgets/mutations", () => ({
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
}));

vi.mock("@/services/budgets/queries", () => ({
  fetchBudgetsPage: vi.fn(),
}));

import { createBudget, updateBudget } from "@/services/budgets/mutations";
import { fetchBudgetsPage } from "@/services/budgets/queries";
import { rememberBudgetDeletion } from "./budget-deletions";
import { createBudgetLocalFirst } from "./create-local-first";

const alreadyExistsError = Object.assign(
  new Error("Request failed with status code 422"),
  {
    response: {
      status: 422,
      data: {
        success: false,
        error: {
          message: "Unprocessable Entity",
          details: {
            base: [
              "A budget already exists for this category in the selected month",
            ],
          },
        },
      },
    },
  },
);

const spendingOnlyHomePage = (): BudgetsPage => ({
  budgets: [
    {
      id: "",
      date: "2026-09-01",
      category_name: "Home",
      category_id: "cat-home",
      categoryId: "cat-home",
      total_spent: 18_800,
      amount_currency: "PHP",
      amount: 0,
      has_explicit_parent_budget: false,
      subcategories: [],
    },
  ],
  summary: {
    total_budget: 0,
    total_spent: 18_800,
    total_spent_percentage: null,
    remaining: -18_800,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

const serverHomePage = (): BudgetsPage => ({
  ...spendingOnlyHomePage(),
  budgets: [
    {
      ...spendingOnlyHomePage().budgets[0],
      id: "budget-home",
      amount: 20_000,
      has_explicit_parent_budget: true,
    },
  ],
});

describe("createBudgetLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("updates the deleted server budget instead of dropping the new amount", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      spendingOnlyHomePage(),
    );
    await rememberBudgetDeletion({
      spaceCode: "space-a",
      monthStart: "2026-09-01",
      categoryId: "cat-home",
      subcategoryId: null,
      budgetId: "budget-home",
    });
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_BUDGET_DELETE,
      payload: {
        budgetId: "budget-home",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      },
      clientMutationId: "delete-home",
    });
    vi.mocked(createBudget).mockRejectedValue(alreadyExistsError);
    vi.mocked(updateBudget).mockResolvedValue({ data: { id: "budget-home" } });

    await createBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        data: {
          categoryId: "cat-home",
          categoryName: "Home",
          amount: 30_000,
          date: "2026-09-01",
        },
      },
      { waitForSync: true },
    );

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(page?.budgets[0]?.id).toBe("budget-home");
    expect(page?.budgets[0]?.amount).toBe(30_000);
    expect(updateBudget).toHaveBeenCalledWith(
      expect.anything(),
      "budget-home",
      { amount: 30_000 },
    );
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox.some((row) => row.commandType === OUTBOX_COMMAND_BUDGET_DELETE)).toBe(
      false,
    );
  });

  it("finds the existing server budget when the deletion record is already gone", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      spendingOnlyHomePage(),
    );
    vi.mocked(createBudget).mockRejectedValue(alreadyExistsError);
    vi.mocked(updateBudget).mockResolvedValue({ data: { id: "budget-home" } });
    vi.mocked(fetchBudgetsPage).mockResolvedValue(serverHomePage());

    await createBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        data: {
          categoryId: "cat-home",
          categoryName: "Home",
          amount: 30_000,
          date: "2026-09-01",
        },
      },
      { waitForSync: true },
    );

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(page?.budgets[0]?.id).toBe("budget-home");
    expect(page?.budgets[0]?.amount).toBe(30_000);
    expect(page?.budgets[0]?.total_spent).toBe(18_800);
  });

  it("puts the new amount back when the cache is rebuilt before the server responds", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      spendingOnlyHomePage(),
    );
    vi.mocked(createBudget).mockImplementation(async () => {
      await cacheBudgetsResponse(
        "space-a",
        "2026-09-01",
        "2026-09-30",
        spendingOnlyHomePage(),
      );
      return {
        id: "budget-home",
        amount: 30_000,
        categoryId: "cat-home",
        categoryName: "Home",
        date: "2026-09-01",
      };
    });

    await createBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        data: {
          categoryId: "cat-home",
          categoryName: "Home",
          amount: 30_000,
          date: "2026-09-01",
        },
      },
      { waitForSync: true },
    );

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(page?.budgets[0]?.id).toBe("budget-home");
    expect(page?.budgets[0]?.amount).toBe(30_000);
    expect(page?.budgets[0]?.total_spent).toBe(18_800);
  });

  it("keeps the new Home budget when a later page write drops it", async () => {
    const queryClient = new QueryClient();
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      spendingOnlyHomePage(),
    );
    await rememberBudgetDeletion({
      spaceCode: "space-a",
      monthStart: "2026-09-01",
      categoryId: "cat-home",
      subcategoryId: null,
      budgetId: "budget-home",
    });
    vi.mocked(updateBudget).mockResolvedValue({ data: { id: "budget-home" } });
    vi.mocked(createBudget).mockResolvedValue({
      id: "budget-home",
      amount: 30_000,
      categoryId: "cat-home",
      categoryName: "Home",
      date: "2026-09-01",
    });

    await createBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        data: {
          categoryId: "cat-home",
          categoryName: "Home",
          amount: 30_000,
          date: "2026-09-01",
        },
      },
      { queryClient, waitForSync: true },
    );

    await applyBudgetsPageToCaches({
      spaceCode: "space-a",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      page: spendingOnlyHomePage(),
      queryClient,
    });

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    const home = page?.budgets.find((row) => row.category_id === "cat-home");
    const localPage = queryClient.getQueryData<BudgetsPage>([
      "budgets",
      "local",
      "space-a",
      "2026-09-01",
      "2026-09-30",
    ]);

    expect(home?.id).toBe("budget-home");
    expect(home?.amount).toBe(30_000);
    expect(home?.total_spent).toBe(18_800);
    expect(localPage?.budgets.find((row) => row.category_id === "cat-home")?.amount).toBe(
      30_000,
    );
  });

  it("keeps the optimistic Home budget when saving to the server fails", async () => {
    const queryClient = new QueryClient();
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      spendingOnlyHomePage(),
    );
    await rememberBudgetDeletion({
      spaceCode: "space-a",
      monthStart: "2026-09-01",
      categoryId: "cat-home",
      subcategoryId: null,
      budgetId: "budget-home",
    });
    vi.mocked(updateBudget).mockRejectedValue(
      new Error("Request failed with status code 500"),
    );
    vi.mocked(createBudget).mockRejectedValue(
      new Error("Request failed with status code 500"),
    );

    await expect(
      createBudgetLocalFirst(
        {} as never,
        {
          spaceCode: "space-a",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          data: {
            categoryId: "cat-home",
            categoryName: "Home",
            amount: 30_000,
            date: "2026-09-01",
          },
        },
        { queryClient, waitForSync: true },
      ),
    ).resolves.toMatchObject({ pendingSync: true });

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    const home = page?.budgets.find((row) => row.category_id === "cat-home");
    const localPage = queryClient.getQueryData<BudgetsPage>([
      "budgets",
      "local",
      "space-a",
      "2026-09-01",
      "2026-09-30",
    ]);

    expect(String(home?.id)).toMatch(/^local:/);
    expect(home?.amount).toBe(30_000);
    expect(home?.category_name).toBe("Home");
    expect(localPage?.budgets.find((row) => row.category_id === "cat-home")?.amount).toBe(
      30_000,
    );
  });
});
