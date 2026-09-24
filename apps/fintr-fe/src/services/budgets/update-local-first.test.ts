import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_BUDGET_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheBudgetsResponse } from "@/services/budgets/local-cache";
import type { BudgetsPage } from "@/types/budgetTypes";

vi.mock("@/services/budgets/mutations", () => ({
  updateBudget: vi.fn(),
}));

import { updateBudget } from "@/services/budgets/mutations";
import { updateBudgetLocalFirst } from "./update-local-first";

const basePage = (): BudgetsPage => ({
  budgets: [
    {
      id: "budget-1",
      date: "2026-01-01",
      category_name: "Food",
      total_spent: 100,
      amount_currency: "PHP",
      amount: 500,
    },
  ],
  summary: {
    total_budget: 500,
    total_spent: 100,
    total_spent_percentage: 20,
    remaining: 400,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

describe("updateBudgetLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("keeps pending outbox when network fails", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-01-01",
      "2026-01-31",
      basePage(),
    );
    vi.mocked(updateBudget).mockRejectedValue(new Error("Network Error"));

    const result = await updateBudgetLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        budgetId: "budget-1",
        data: { amount: 600 },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_BUDGET_UPDATE);
  });
});
