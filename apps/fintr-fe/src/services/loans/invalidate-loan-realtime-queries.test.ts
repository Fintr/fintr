import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("@/services/loans/loan-payments-cache", () => ({
  removeLoanPaymentFromLocalStores: vi.fn(),
}));

import { removeLoanPaymentFromLocalStores } from "@/services/loans/loan-payments-cache";
import {
  applyLoanPaymentRealtimeDeletes,
  invalidateLoanRealtimeQueries,
  syncLoanRealtimeAfterDelete,
  transactionRowTouchesLoans,
} from "./invalidate-loan-realtime-queries";

describe("transactionRowTouchesLoans", () => {
  it("returns true for loan payment rows", () => {
    expect(
      transactionRowTouchesLoans({
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      }),
    ).toBe(true);
  });

  it("returns true when loanId is present", () => {
    expect(
      transactionRowTouchesLoans({
        type: CombinedTransactionTypeEnum.EXPENSE,
        loanId: "loan-1",
      }),
    ).toBe(true);
  });
});

describe("invalidateLoanRealtimeQueries", () => {
  it("invalidates loans list and scoped payment/detail queries", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    await invalidateLoanRealtimeQueries(client, [
      {
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
        loanId: "loan-abc",
      },
    ]);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["loans"],
      refetchType: "active",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["loanPayments", "loan-abc"],
      refetchType: "active",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [LOAN_DETAIL_KEY, "loan-abc"],
      refetchType: "active",
    });
  });

  it("falls back to broad loan payment/detail invalidation without loanId", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    await invalidateLoanRealtimeQueries(client, [
      {
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      },
    ]);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["loanPayments"],
      exact: false,
      refetchType: "active",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [LOAN_DETAIL_KEY],
      exact: false,
      refetchType: "active",
    });
  });
});

describe("applyLoanPaymentRealtimeDeletes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes deleted loan payments from local stores immediately", async () => {
    const client = new QueryClient();

    await applyLoanPaymentRealtimeDeletes(client, "space-a", [
      {
        id: "pay-1",
        loanId: "loan-abc",
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      },
    ]);

    expect(removeLoanPaymentFromLocalStores).toHaveBeenCalledWith({
      spaceCode: "space-a",
      loanId: "loan-abc",
      paymentId: "pay-1",
      queryClient: client,
    });
  });

  it("resolves loanId from cached payments when the payload omits it", async () => {
    const client = new QueryClient();
    client.setQueryData(["loanPayments", "loan-abc"], [
      {
        id: "pay-1",
        loanId: "loan-abc",
        accountId: "acct-1",
        accountName: "Cash",
        date: "2026-08-08",
        principalPayment: 100,
        interestPayment: 0,
        totalPayment: 100,
        currency: "PHP",
      },
    ]);

    await applyLoanPaymentRealtimeDeletes(client, "space-a", [
      {
        id: "pay-1",
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      },
    ]);

    expect(removeLoanPaymentFromLocalStores).toHaveBeenCalledWith({
      spaceCode: "space-a",
      loanId: "loan-abc",
      paymentId: "pay-1",
      queryClient: client,
    });
  });
});

describe("syncLoanRealtimeAfterDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("patches local stores before invalidating loan queries", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const callOrder: string[] = [];

    vi.mocked(removeLoanPaymentFromLocalStores).mockImplementation(async () => {
      callOrder.push("remove");
    });
    invalidateSpy.mockImplementation(async () => {
      callOrder.push("invalidate");
    });

    await syncLoanRealtimeAfterDelete(client, "space-a", [
      {
        id: "pay-1",
        loanId: "loan-abc",
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      },
    ]);

    expect(removeLoanPaymentFromLocalStores).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
    expect(callOrder[0]).toBe("remove");
  });
});
