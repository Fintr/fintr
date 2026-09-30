import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_BUDGET_CREATE,
  OUTBOX_COMMAND_BUDGET_DELETE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import {
  cacheBudgetsResponse,
  loadCachedBudgetsResponse,
} from "@/services/budgets/local-cache";
import type { BudgetsPage } from "@/types/budgetTypes";

vi.mock("@/services/budgets/mutations", () => ({
  createBudget: vi.fn(),
  deleteBudget: vi.fn(),
}));

import { createBudget, deleteBudget } from "@/services/budgets/mutations";
import { forgetBudgetDeletion } from "./budget-deletions";
import { deleteBudgetLocalFirst } from "./delete-local-first";

const homePage = (): BudgetsPage => ({
  budgets: [
    {
      id: "budget-home",
      date: "2026-09-01",
      category_name: "Home",
      category_id: "cat-home",
      categoryId: "cat-home",
      total_spent: 18_800,
      amount_currency: "PHP",
      amount: 20_000,
      has_explicit_parent_budget: true,
      subcategories: [],
    },
  ],
  summary: {
    total_budget: 20_000,
    total_spent: 18_800,
    total_spent_percentage: 94,
    remaining: 1_200,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

const notFoundError = Object.assign(
  new Error("Request failed with status code 404"),
  {
    response: {
      status: 404,
      data: {
        success: false,
        error: { message: "Resource not found", details: "Budget not found" },
      },
    },
  },
);

describe("deleteBudgetLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("keeps a budget that was set again while the delete was in flight", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      homePage(),
    );
    vi.mocked(deleteBudget).mockImplementation(async () => {
      await forgetBudgetDeletion({
        spaceCode: "space-a",
        monthStart: "2026-09-01",
        categoryId: "cat-home",
        subcategoryId: null,
      });
      await cacheBudgetsResponse(
        "space-a",
        "2026-09-01",
        "2026-09-30",
        {
          ...homePage(),
          budgets: [
            {
              ...homePage().budgets[0],
              id: "local:reset-home",
              amount: 30_000,
            },
          ],
        },
      );
      return { success: true };
    });
    vi.mocked(createBudget).mockResolvedValue({
      data: { id: "budget-home-2" },
    });

    await deleteBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        budgetId: "budget-home",
      },
      { waitForSync: true },
    );

    expect(createBudget).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        categoryId: "cat-home",
        amount: 30_000,
      }),
    );
    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(page?.budgets[0]?.id).toBe("budget-home-2");
    expect(page?.budgets[0]?.amount).toBe(30_000);
  });

  it("keeps the local deletion when the server budget is already gone", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      homePage(),
    );
    vi.mocked(deleteBudget).mockRejectedValue(notFoundError);

    await deleteBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        budgetId: "budget-home",
      },
      { waitForSync: true },
    );

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(page?.budgets.some((row) => row.id === "budget-home")).toBe(false);
  });

  it("keeps the local deletion and the server delete when the API fails", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      homePage(),
    );
    vi.mocked(deleteBudget).mockRejectedValue(
      Object.assign(new Error("Request failed with status code 500"), {
        response: { status: 500, data: { success: false } },
      }),
    );

    await deleteBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        budgetId: "budget-home",
      },
      { waitForSync: true },
    );

    const page = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(page?.budgets.some((row) => row.id === "budget-home")).toBe(false);
    const deletes = (await getLocalDb().outbox.toArray()).filter(
      (row) => row.commandType === OUTBOX_COMMAND_BUDGET_DELETE,
    );
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.payload).toMatchObject({ budgetId: "budget-home" });
    expect(deletes[0]?.status).toBe("pending");
  });

  it("drops a pending copy so the deleted budget is not created on the server", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      {
        ...homePage(),
        budgets: [
          {
            ...homePage().budgets[0],
            id: "local:home",
          },
        ],
      },
    );
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_BUDGET_CREATE,
      payload: {
        localId: "local:home",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        amount: 20_000,
        date: "2026-09-01",
        categoryId: "cat-home",
        categoryName: "Home",
      },
      clientMutationId: "create-home",
    });

    await deleteBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        budgetId: "local:home",
      },
      { waitForSync: true },
    );

    const commands = (await getLocalDb().outbox.toArray()).map(
      (row) => row.commandType,
    );
    expect(commands).not.toContain(OUTBOX_COMMAND_BUDGET_CREATE);
    expect(deleteBudget).not.toHaveBeenCalled();
  });
});
