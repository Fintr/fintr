import { describe, expect, it } from "vitest";

import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import { patchLoanFromPayments } from "@/utils/patch-loan-from-payments";

const createLoan = (): Loan => ({
  id: "loan-1",
  date: "2024-01-01",
  description: null,
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2025-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 10,
  entityName: "Bank",
  accountName: "Checking",
  principalAmount: 100_000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 100_000,
  outstandingBalanceCurrency: "PHP",
  value: -100_000,
  income: 0,
  expense: 0,
  totalValue: 110_000,
  files: [],
});

const createPayment = (
  overrides: Partial<LoanPayment> = {},
): LoanPayment => ({
  id: "payment-1",
  loanId: "loan-1",
  accountId: "account-1",
  accountName: "Checking",
  date: "2024-02-01",
  principalPayment: 7_942.27,
  interestPayment: 849.32,
  totalPayment: 8_791.59,
  currency: "PHP",
  ...overrides,
});

describe("patchLoanFromPayments", () => {
  it("reduces outstanding balance by principal paid", () => {
    const patched = patchLoanFromPayments(createLoan(), [createPayment()]);

    expect(patched.outstandingBalance).toBeCloseTo(92_057.73, 2);
    expect(patched.loanPayments).toHaveLength(1);
  });

  it("marks the loan paid off when principal is fully repaid", () => {
    const patched = patchLoanFromPayments(createLoan(), [
      createPayment({ principalPayment: 100_000, totalPayment: 100_000 }),
    ]);

    expect(patched.outstandingBalance).toBe(0);
    expect(patched.status).toBe("paid_off");
  });
});
