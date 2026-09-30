import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { putSpaceTransactions } from "@/lib/local-db/transactions";
import { cacheBudgetsResponse } from "@/services/budgets/local-cache";

import { useBudgetsData } from "./useBudgetsData";

vi.mock("../useAuthApi", () => ({
  default: () => ({
    api: {},
  }),
}));

vi.mock("@/hooks/useOfflineReadMode", () => ({
  useSkipCachedNetworkFetch: () => true,
}));

const augustPage = {
  budgets: [
    {
      id: "budget-food",
      date: "2026-08-01",
      category_name: "Food",
      category_id: "cat-food",
      total_spent: 0,
      amount_currency: "PHP",
      amount: 500,
      has_explicit_parent_budget: true,
      subcategories: [],
    },
  ],
  summary: {
    total_budget: 500,
    total_spent: 0,
    total_spent_percentage: 0,
    remaining: 500,
  },
  nextPage: null,
  totalPages: null,
  totalCount: null,
};

const expense = (id: string, amount: number) => ({
  id,
  date: "2026-08-10",
  description: id,
  amount,
  categoryName: "Food",
  categoryId: "cat-food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: "expense" as const,
  inSeries: false,
  hasImage: false,
  calculated: true,
});

const flushQueries = async () => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  });
};

describe("useBudgetsData", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    window.localStorage.setItem("spaceCode", "space-a");
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(async () => {
    queryClient.clear();
    window.localStorage.clear();
    await resetLocalDbForTests();
  });

  it("recomputes total spent from local transactions when the page is opened again", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      augustPage,
    );
    await putSpaceTransactions("space-a", [expense("tx-lunch", 80)]);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const firstVisit = renderHook(
      () => useBudgetsData("2026-08-01", "2026-08-31"),
      { wrapper },
    );

    await flushQueries();

    expect(firstVisit.result.current.data?.summary?.total_spent).toBe(80);

    firstVisit.unmount();

    await putSpaceTransactions("space-a", [expense("tx-dinner", 40)]);

    const returnVisit = renderHook(
      () => useBudgetsData("2026-08-01", "2026-08-31"),
      { wrapper },
    );

    await flushQueries();

    expect(returnVisit.result.current.data?.summary?.total_spent).toBe(120);
  });

  it("recomputes total spent when the budgets tab becomes active again", async () => {
    await cacheBudgetsResponse(
      "space-a",
      "2026-08-01",
      "2026-08-31",
      augustPage,
    );
    await putSpaceTransactions("space-a", [expense("tx-lunch", 80)]);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const visit = renderHook(
      ({ active }: { active: boolean }) =>
        useBudgetsData("2026-08-01", "2026-08-31", active),
      {
        wrapper,
        initialProps: { active: true },
      },
    );

    await flushQueries();

    expect(visit.result.current.data?.summary?.total_spent).toBe(80);

    visit.rerender({ active: false });
    await putSpaceTransactions("space-a", [expense("tx-dinner", 40)]);
    visit.rerender({ active: true });

    await flushQueries();

    expect(visit.result.current.data?.summary?.total_spent).toBe(120);
  });
});
