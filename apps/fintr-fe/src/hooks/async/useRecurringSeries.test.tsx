import "fake-indexeddb/auto";

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ScheduleTypeEnum,
  UpdateScopeEnum,
} from "@/constants/transactionConstants";
import { resetLocalDbForTests } from "@/lib/local-db";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: { get: vi.fn().mockRejectedValue(new Error("offline")) },
  }),
}));

vi.mock("@/services/transactions/mutation", () => ({
  updateTransaction: vi.fn(() => new Promise(() => {})),
}));

import { updateTransactionLocalFirst } from "@/services/transactions/update-local-first";
import {
  prefetchRecurringSeries,
  useRecurringSeries,
} from "./useRecurringSeries";

vi.mock("@/services/transactions/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/transactions/queries")
  >("@/services/transactions/queries");

  return {
    ...actual,
    fetchTransactionById: vi.fn(() => new Promise(() => {})),
  };
});

const SPACE = "space-install-offline";
const ROOT_ID = "install9-root";

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

const seedInstallmentSeries = async () => {
  for (let index = 0; index < 24; index += 1) {
    const date = new Date(Date.UTC(2026, index, 1));
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
    await upsertLocalIndexTransaction(SPACE, {
      id: index === 0 ? ROOT_ID : `install9-${index}`,
      date: dateKey,
      seriesParentDate: "2026-01-01",
      description: "INSTALL9",
      amount: 10_000,
      amountCurrency: "PHP",
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      parentId: index === 0 ? undefined : ROOT_ID,
      rootParentId: ROOT_ID,
      currencyConversion: {
        originalAmount: 100,
        originalCurrency: "GBP",
        convertedAmount: 10_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    });
  }
};

describe("useRecurringSeries", () => {
  const originalOnline = onlineManager.isOnline();

  beforeEach(async () => {
    localStorage.setItem("spaceCode", SPACE);
    await resetLocalDbForTests();
    onlineManager.setOnline(true);
  });

  afterEach(async () => {
    onlineManager.setOnline(originalOnline);
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("loads installment series from IndexedDB while offline", async () => {
    await seedInstallmentSeries();
    onlineManager.setOnline(false);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useRecurringSeries(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.summaries[0]?.title).toBe("INSTALL9");
    });
    expect(result.current.summaries[0]?.amount).toBe(10_000);
    expect(result.current.summaries[0]?.installmentTotal).toBe(240_000);
  });

  it("refreshes the installment detail totals after an offline apply-all to GBP 3000", async () => {
    await seedInstallmentSeries();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useRecurringSeries(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.summaries[0]?.amount).toBe(10_000);
    });

    onlineManager.setOnline(false);

    await act(async () => {
      await updateTransactionLocalFirst(
        {} as never,
        {
          spaceId: SPACE,
          amountCurrency: "PHP",
          data: {
            id: ROOT_ID,
            amount: 125,
            description: "INSTALL9",
            transactionType: "expense",
            categoryName: "Home",
            accountName: "Cash",
            date: "2026-01-01",
            scheduleType: ScheduleTypeEnum.INSTALLMENT,
            installmentPeriod: 24,
            installmentTotal: 3000,
            updateScope: UpdateScopeEnum.ALL_IN_SERIES,
            installmentRevisionAnchor: "explicit",
            original_currency: "GBP",
            exchange_rate: 100,
            exchange_rate_source: "manual",
          } as never,
        },
        { queryClient, waitForSync: false },
      );
    });

    await waitFor(() => {
      expect(result.current.summaries[0]?.amount).toBe(12_500);
      expect(result.current.summaries[0]?.installmentTotal).toBe(300_000);
    });
    expect(
      result.current.summaries[0]?.occurrences.every((row) => row.amount === 12_500),
    ).toBe(true);
  });

  it("resolves from IndexedDB without waiting on transaction detail GETs", async () => {
    await upsertLocalIndexTransaction(SPACE, {
      id: "repeat-root",
      date: "2026-09-01",
      description: "Gym",
      amount: 1_500,
      amountCurrency: "PHP",
      categoryName: "Fitness",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.REPEAT,
      rootParentId: "repeat-root",
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useRecurringSeries(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(result.current.summaries[0]?.title).toBe("Gym");
    });
  });

  it("is not pending after prefetchRecurringSeries", async () => {
    await seedInstallmentSeries();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await prefetchRecurringSeries(queryClient, SPACE);

    const { result } = renderHook(() => useRecurringSeries(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.summaries[0]?.title).toBe("INSTALL9");
  });
});
