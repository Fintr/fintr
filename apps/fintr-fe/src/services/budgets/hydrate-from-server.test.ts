import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { cacheBudgetsResponse, loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import type { BudgetsPage } from "@/types/budgetTypes";

vi.mock("@/services/budgets/queries", () => ({
  fetchBudgetsPage: vi.fn(),
}));

import { fetchBudgetsPage } from "@/services/budgets/queries";
import { hydrateBudgetsFromServer } from "./hydrate-from-server";

const serverSeptemberPage = (): BudgetsPage => ({
  budgets: [
    {
      id: "server-food",
      date: "2026-09-01",
      category_id: "cat-food",
      category_name: "Food",
      amount: 500,
      has_explicit_parent_budget: true,
      subcategories: [],
    },
    {
      id: "server-home",
      date: "2026-09-01",
      category_id: "cat-home",
      category_name: "Home",
      amount: 2000,
      has_explicit_parent_budget: true,
      subcategories: [],
    },
  ],
  summary: {
    total_budget: 2500,
    total_spent: 0,
    total_spent_percentage: 0,
    remaining: 2500,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

describe("hydrateBudgetsFromServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchBudgetsPage).mockResolvedValue({
      budgets: [],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    });
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("writes Rails budget rows for the current month into IndexedDB", async () => {
    vi.mocked(fetchBudgetsPage).mockImplementation(async (_api, { queryKey }) => {
      const startDate = String(queryKey[2] ?? "");
      if (startDate.startsWith("2026-09")) {
        return serverSeptemberPage();
      }

      return {
        budgets: [],
        summary: null,
        nextPage: null,
        totalPages: null,
        totalCount: null,
      };
    });

    const result = await hydrateBudgetsFromServer(
      {} as never,
      {
        spaceCode: "space-a",
        asOfStartDate: "2026-09-01",
        monthCount: 1,
      },
    );

    expect(result.hydratedMonths).toBe(1);
    const cached = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(cached?.budgets.map((row) => row.id)).toEqual([
      "server-food",
      "server-home",
    ]);
  });

  it("replaces an incomplete local month with the fuller Rails page", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      {
        budgets: [
          {
            id: "stale-food",
            date: "2026-09-01",
            category_id: "cat-food",
            category_name: "Food",
            amount: 500,
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
    vi.mocked(fetchBudgetsPage).mockResolvedValue(serverSeptemberPage());

    await hydrateBudgetsFromServer(
      {} as never,
      {
        spaceCode: "space-a",
        asOfStartDate: "2026-09-01",
        monthCount: 1,
      },
    );

    const cached = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(cached?.budgets).toHaveLength(2);
    expect(cached?.budgets.map((row) => row.id)).toEqual([
      "server-food",
      "server-home",
    ]);
  });

  it("does not overwrite a month that still has pending local creates", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
      {
        budgets: [
          {
            id: "local:pending-food",
            date: "2026-09-01",
            category_id: "cat-food",
            category_name: "Food",
            amount: 500,
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
    vi.mocked(fetchBudgetsPage).mockResolvedValue(serverSeptemberPage());

    await hydrateBudgetsFromServer(
      {} as never,
      {
        spaceCode: "space-a",
        asOfStartDate: "2026-09-01",
        monthCount: 1,
      },
    );

    const cached = await loadCachedBudgetsResponse(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    expect(cached?.budgets[0]?.id).toBe("local:pending-food");
    expect(fetchBudgetsPage).not.toHaveBeenCalled();
  });

  it("fetches each month with the space header so Rails rows belong to that space", async () => {
    vi.mocked(fetchBudgetsPage).mockResolvedValue(serverSeptemberPage());

    await hydrateBudgetsFromServer(
      {} as never,
      {
        spaceCode: "space-a",
        asOfStartDate: "2026-09-01",
        monthCount: 1,
      },
    );

    expect(fetchBudgetsPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        queryKey: ["budgets", "space-a", "2026-09-01", "2026-09-30"],
        requestConfig: {
          headers: {
            "X-Space-Code": "space-a",
          },
        },
      }),
    );
  });
});
