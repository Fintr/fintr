import { describe, expect, it } from "vitest";
import { Loan } from "@/services/loans/queries";
import { buildLoanEntityProfiles } from "@/utils/loan-entity-profiles";

const createLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2024-01-01",
  description: null,
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2025-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 12,
  entityName: "Jerry Oquendo",
  accountName: "Checking",
  principalAmount: 12_000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 10_000,
  outstandingBalanceCurrency: "PHP",
  value: -12_000,
  income: 0,
  expense: 0,
  totalValue: 12_720,
  files: [],
  ...overrides,
});

describe("buildLoanEntityProfiles", () => {
  it("nets borrowed and lent balances for the same entity", () => {
    const profiles = buildLoanEntityProfiles([
      createLoan({
        id: "borrowed",
        loanType: "borrowed",
        outstandingBalance: 8_000,
      }),
      createLoan({
        id: "lent",
        loanType: "lent",
        outstandingBalance: 3_000,
      }),
    ]);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].entityName).toBe("Jerry Oquendo");
    expect(profiles[0].primaryBalance).toMatchObject({
      currency: "PHP",
      borrowedAmount: 8_000,
      lentAmount: 3_000,
      netAmount: -5_000,
      direction: "you_owe",
    });
  });

  it("keeps separate currency nets on one profile", () => {
    const profiles = buildLoanEntityProfiles([
      createLoan({
        id: "php",
        loanType: "borrowed",
        outstandingBalance: 2_000,
        outstandingBalanceCurrency: "PHP",
      }),
      createLoan({
        id: "usd",
        loanType: "lent",
        outstandingBalance: 500,
        outstandingBalanceCurrency: "USD",
      }),
    ]);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].balances).toHaveLength(2);
    expect(profiles[0].primaryBalance.currency).toBe("PHP");
    expect(profiles[0].primaryBalance.direction).toBe("you_owe");
  });

  it("skips paid-off loans and settled nets", () => {
    const profiles = buildLoanEntityProfiles([
      createLoan({
        id: "paid",
        status: "paid_off",
        outstandingBalance: 0,
      }),
      createLoan({
        id: "borrowed",
        loanType: "borrowed",
        outstandingBalance: 1_000,
      }),
      createLoan({
        id: "lent",
        loanType: "lent",
        outstandingBalance: 1_000,
      }),
    ]);

    expect(profiles).toHaveLength(0);
  });
});
