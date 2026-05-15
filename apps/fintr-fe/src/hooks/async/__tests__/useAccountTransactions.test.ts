import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAccountTransactions } from "../useAccountTransactions";

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
  useLocalStorage: vi.fn(() => ["TEST_SPACE", vi.fn()]),
}));

vi.mock("@/utils/dateUtils", () => ({
  getCurrentMonthDates: vi.fn(() => ({
    firstDay: "2024-01-01",
    lastDay: "2024-01-31",
  })),
}));

vi.mock("@/services/transactions/queries", () => ({
  fetchTransactionsPage: vi.fn(),
}));

describe("useAccountTransactions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it("passes explicit startDate and endDate into fetchTransactionsPage queryKey", async () => {
    const transactionQueries = await import("@/services/transactions/queries");
    const fetchSpy = vi.spyOn(transactionQueries, "fetchTransactionsPage");
    fetchSpy.mockResolvedValue({
      transactions: [],
      nextPage: null,
    });

    renderHook(
      () =>
        useAccountTransactions({
          accountName: "Growth Portfolio",
          startDate: "2024-06-01",
          endDate: "2024-06-30",
        }),
      { wrapper }
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageParam: 1,
        queryKey: [
          "transactions",
          "TEST_SPACE",
          "",
          "2024-06-01",
          "2024-06-30",
          undefined,
          undefined,
          "",
          "Growth Portfolio",
        ],
      })
    );
  });

  it("uses calendar month defaults from getCurrentMonthDates when dates are omitted", async () => {
    const transactionQueries = await import("@/services/transactions/queries");
    const fetchSpy = vi.spyOn(transactionQueries, "fetchTransactionsPage");
    fetchSpy.mockResolvedValue({
      transactions: [],
      nextPage: null,
    });

    renderHook(
      () =>
        useAccountTransactions({
          accountName: "Checking",
        }),
      { wrapper }
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          "transactions",
          "TEST_SPACE",
          "",
          "2024-01-01",
          "2024-01-31",
          undefined,
          undefined,
          "",
          "Checking",
        ]),
      })
    );
  });

  it("does not fetch when disabled", async () => {
    const transactionQueries = await import("@/services/transactions/queries");
    const fetchSpy = vi.spyOn(transactionQueries, "fetchTransactionsPage");

    renderHook(
      () =>
        useAccountTransactions({
          accountName: "Savings",
          enabled: false,
        }),
      { wrapper }
    );

    await new Promise((r) => setTimeout(r, 100));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
