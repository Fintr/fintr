import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { resetLocalDbForTests } from "@/lib/local-db";
import {
  cacheLoanDetail,
  cacheLoansAllPages,
} from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";

const fetchLoanById = vi.fn();

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
    fetchLoanById: (...args: unknown[]) => fetchLoanById(...args),
  };
});

import { useLoan } from "./useLoan";

const sampleLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2026-01-01",
  description: "Bike loan",
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
  ...overrides,
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

  return ({ children }: { children: ReactNode }) =>
    createElement(
      JotaiProvider,
      { store },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );
};

describe("useLoan", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    fetchLoanById.mockReset();
    localStorage.setItem("spaceCode", "space-a");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
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

  it("reads the cached loan while offline and does not hit the API", async () => {
    await cacheLoanDetail("space-a", "loan-1", sampleLoan());

    const { result } = renderHook(() => useLoan("loan-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.entityName).toBe("Alice");
      expect(result.current.data?.outstandingBalance).toBe(800);
    });

    expect(result.current.isError).toBe(false);
    expect(fetchLoanById).not.toHaveBeenCalled();
  });

  it("falls back to the loans list snapshot when detail cache is missing", async () => {
    await cacheLoansAllPages("space-a", [
      {
        loans: [sampleLoan({ entityName: "From list" })],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
      },
    ]);

    const { result } = renderHook(() => useLoan("loan-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.entityName).toBe("From list");
    });

    expect(result.current.isError).toBe(false);
    expect(fetchLoanById).not.toHaveBeenCalled();
  });
});
