import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { resetLocalDbForTests } from "@/lib/local-db";
import { cacheLoansAllPages } from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";

const fetchLoansPage = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: { get: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/loans/queries", async () => {
  const actual = await vi.importActual<typeof import("@/services/loans/queries")>(
    "@/services/loans/queries",
  );

  return {
    ...actual,
    fetchLoansPage: (...args: unknown[]) => fetchLoansPage(...args),
  };
});

import { useInfiniteLoans } from "./useInfiniteLoans";

const sampleLoan = (): Loan => ({
  id: "loan-1",
  date: "2026-01-01",
  description: null,
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 5,
  entityName: "Alice",
  accountName: "Cash",
  principalAmount: 1000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 800,
  outstandingBalanceCurrency: "PHP",
  value: 1000,
  income: 0,
  expense: 1000,
  totalValue: 1000,
  files: [],
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const store = createStore();
  store.set(offlineSyncReadyAtom, true);

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      JotaiProvider,
      { store },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );

  return { wrapper, queryClient };
};

describe("useInfiniteLoans", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    fetchLoansPage.mockReset();
    localStorage.setItem("spaceCode", "space-a");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof IntersectionObserver;
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("reads cached loans while offline and treats that as success", async () => {
    await cacheLoansAllPages("space-a", [
      {
        loans: [sampleLoan()],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
      },
    ]);

    const loadMoreRef = createRef<HTMLDivElement>();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useInfiniteLoans({ loadMoreRef }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loans).toHaveLength(1);
      expect(result.current.loans[0]?.entityName).toBe("Alice");
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(fetchLoansPage).not.toHaveBeenCalled();
  });

  it("prefers the local loan snapshot over stale network list data", async () => {
    const staleLoan = sampleLoan();
    const localLoan = {
      ...sampleLoan(),
      outstandingBalance: 500,
      loanPayments: [
        {
          id: "pay-local",
          date: "2026-08-14",
          principalPayment: 300,
          interestPayment: 0,
          totalPayment: 300,
          currency: "PHP",
        },
      ],
    };

    await cacheLoansAllPages("space-a", [
      {
        loans: [localLoan],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
      },
    ]);

    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(["loans"], {
      pages: [
        {
          loans: [staleLoan],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
        },
      ],
      pageParams: [1],
    });
    queryClient.setQueryData(["loans", "local", "space-a"], {
      pages: [
        {
          loans: [localLoan],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
        },
      ],
      pageParams: [1],
    });

    const loadMoreRef = createRef<HTMLDivElement>();
    const { result } = renderHook(
      () => useInfiniteLoans({ loadMoreRef }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loans).toHaveLength(1);
      expect(result.current.loans[0]?.outstandingBalance).toBe(500);
    });
  });
});
