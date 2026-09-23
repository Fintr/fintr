import "fake-indexeddb/auto";

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { resetLocalDbForTests } from "@/lib/local-db";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";
import { resetRelationIdBackfillForTests } from "@/services/transactions/relation-ids-local";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { useInfiniteTransactions } from "./useInfiniteTransactions";

const { mockUseAuthApi } = vi.hoisted(() => ({
  mockUseAuthApi: vi.fn(() => ({
    api: { get: vi.fn() },
    getToken: vi.fn().mockResolvedValue("mock-token"),
    isAuthenticated: true,
    isLoading: false,
    error: null,
  })),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  __esModule: true,
  default: mockUseAuthApi,
  useAuthApi: mockUseAuthApi,
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: vi.fn(() => ["space-a", vi.fn()]),
}));

vi.mock("@/services/transactions/queries", () => ({
  fetchTransactionsPage: vi.fn(),
}));

const buildRow = (
  overrides: Partial<Parameters<typeof upsertLocalIndexTransaction>[1]>,
) => ({
  date: "2026-08-10",
  createdAt: "2026-08-10T12:00:00.000Z",
  description: "Row",
  amount: 100,
  amountCurrency: "PHP",
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("useInfiniteTransactions entry-type pills", () => {
  const originalOnline = onlineManager.isOnline();
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    onlineManager.setOnline(false);

    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof IntersectionObserver;
  });

  afterEach(async () => {
    queryClient.clear();
    vi.clearAllMocks();
    onlineManager.setOnline(originalOnline);
    resetRelationIdBackfillForTests();
    await resetLocalDbForTests();
  });

  const renderTransactionsHook = (
    entryType: "income" | "transfers" | "loans" | "recurring",
  ) => {
    const store = createStore();
    store.set(offlineSyncReadyAtom, true);

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        JotaiProvider,
        { store },
        createElement(QueryClientProvider, { client: queryClient }, children),
      );

    const loadMoreRef = { current: document.createElement("div") };

    return renderHook(
      () =>
        useInfiniteTransactions({
          appliedCategories: [],
          queryStartDate: "2026-08-01",
          queryEndDate: "2026-08-31",
          appliedMinAmount: "",
          appliedMaxAmount: "",
          searchQuery: "",
          entryType,
          loadMoreRef,
        }),
      { wrapper },
    );
  };

  it("loads income, transfers, loans, and recurring from IndexedDB while offline", async () => {
    await upsertLocalIndexTransaction(
      "space-a",
      buildRow({
        id: "income-1",
        description: "Salary",
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
      }),
    );
    await upsertLocalIndexTransaction(
      "space-a",
      buildRow({
        id: "transfer-1",
        description: "Move money",
        fromAccountName: "Cash",
        toAccountName: "Savings",
        type: CombinedTransactionTypeEnum.TRANSFER,
      }),
    );
    await upsertLocalIndexTransaction(
      "space-a",
      buildRow({
        id: "loan-1",
        description: "Loan payment",
        categoryName: "Loan",
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      }),
    );
    await upsertLocalIndexTransaction(
      "space-a",
      buildRow({
        id: "recurring-1",
        description: "Netflix",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: true,
        scheduleType: "repeat",
      }),
    );

    const cases = [
      { entryType: "income" as const, id: "income-1" },
      { entryType: "transfers" as const, id: "transfer-1" },
      { entryType: "loans" as const, id: "loan-1" },
      { entryType: "recurring" as const, id: "recurring-1" },
    ];

    for (const { entryType, id } of cases) {
      const { result } = renderTransactionsHook(entryType);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const ids =
        result.current.data?.pages.flatMap(
          (page) => page.transactions.map((row) => row.id),
        ) ?? [];

      expect(ids).toContain(id);
    }
  });
});
