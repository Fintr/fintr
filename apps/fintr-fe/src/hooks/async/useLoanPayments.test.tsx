import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import {
  getLocalDb,
  OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import {
  cacheLoanDetail,
  cacheLoanPayments,
} from "@/services/loans/local-cache";
import type { LoanPayment } from "@/services/loans/payments";
import type { Loan } from "@/services/loans/queries";

const { fetchLoanPayments, createLoanPayment } = vi.hoisted(() => ({
  fetchLoanPayments: vi.fn(),
  createLoanPayment: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: { get: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/loans/payments", async () => {
  const actual = await vi.importActual<typeof import("@/services/loans/payments")>(
    "@/services/loans/payments",
  );

  return {
    ...actual,
    fetchLoanPayments: (...args: unknown[]) => fetchLoanPayments(...args),
    createLoanPayment: (...args: unknown[]) => createLoanPayment(...args),
  };
});

import { useLoanPayments } from "./useLoanPayments";

const samplePayment = (overrides: Partial<LoanPayment> = {}): LoanPayment => ({
  id: "pay-1",
  loanId: "loan-1",
  accountId: "acct-1",
  accountName: "Cash",
  date: "2026-02-01",
  principalPayment: 100,
  interestPayment: 5,
  totalPayment: 105,
  currency: "PHP",
  ...overrides,
});

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
  outstandingBalance: 900,
  outstandingBalanceCurrency: "PHP",
  value: 1000,
  income: 0,
  expense: 1000,
  totalValue: 1000,
  files: [],
  loanPayments: [
    {
      id: "pay-embedded",
      date: "2026-02-01",
      principalPayment: 100,
      interestPayment: 5,
      totalPayment: 105,
      currency: "PHP",
    },
  ],
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

describe("useLoanPayments", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    fetchLoanPayments.mockReset();
    createLoanPayment.mockReset();
    createLoanPayment.mockImplementation(() => new Promise(() => {}));
    localStorage.setItem("spaceCode", "space-a");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    onlineManager.setOnline(false);
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("reads cached payments while offline and does not hit the API", async () => {
    await cacheLoanPayments("space-a", "loan-1", [samplePayment()]);

    const { result } = renderHook(() => useLoanPayments("loan-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.payments).toHaveLength(1);
      expect(result.current.payments[0]?.accountName).toBe("Cash");
    });

    expect(result.current.isError).toBe(false);
    expect(fetchLoanPayments).not.toHaveBeenCalled();
  });

  it("falls back to payments embedded on the cached loan", async () => {
    await cacheLoanDetail("space-a", "loan-1", sampleLoan());

    const { result } = renderHook(() => useLoanPayments("loan-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.payments.map((row) => row.id)).toEqual([
        "pay-embedded",
      ]);
    });

    expect(result.current.isError).toBe(false);
    expect(fetchLoanPayments).not.toHaveBeenCalled();
  });

  it("records a payment locally while offline without waiting for the API", async () => {
    await cacheLoanPayments("space-a", "loan-1", []);

    const { result } = renderHook(() => useLoanPayments("loan-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.payments).toEqual([]);
    });

    let recorded: { data: { id: string }; pendingSync: boolean } | undefined;

    await act(async () => {
      recorded = await result.current.createPayment({
        accountName: "ShopeePay",
        date: "2026-08-14",
        totalPayment: 12.25,
      });
    });

    expect(recorded?.pendingSync).toBe(true);
    expect(recorded?.data.id.startsWith("local:")).toBe(true);

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
    });

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_LOAN_PAYMENT_CREATE);
  });
});
