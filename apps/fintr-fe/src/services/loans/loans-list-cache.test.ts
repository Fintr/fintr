import { describe, expect, it } from "vitest";

import type { Loan, LoansPage } from "./queries";
import { upsertLoanInInfiniteData } from "./loans-list-cache";

const loan = (id: string, entityName: string): Loan => ({
  id,
  date: "2026-06-18",
  description: null,
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-06-18",
  status: "active",
  paidOffDate: null,
  interestRate: 2,
  entityName,
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
});

const page = (loans: Loan[]): LoansPage => ({
  loans,
  nextPage: null,
  totalPages: 1,
  totalCount: loans.length,
});

describe("upsertLoanInInfiniteData", () => {
  it("does not replace the list with a single loan on update when cache is empty", () => {
    const updated = loan("loan-1", "Jerry Oquendo");
    updated.outstandingBalance = 500;

    const result = upsertLoanInInfiniteData(undefined, updated, {
      seedListWhenEmpty: false,
    });

    expect(result).toBeUndefined();
  });

  it("merges an updated loan into an existing list", () => {
    const existing = {
      pages: [page([loan("loan-1", "A"), loan("loan-2", "B")])],
      pageParams: [1],
    };

    const updated = { ...loan("loan-1", "A"), outstandingBalance: 250 };
    const result = upsertLoanInInfiniteData(existing, updated, {
      seedListWhenEmpty: false,
    });

    expect(result?.pages[0].loans).toHaveLength(2);
    expect(result?.pages[0].loans[0].outstandingBalance).toBe(250);
    expect(result?.pages[0].loans[1].id).toBe("loan-2");
  });

  it("uses fallback list data when the primary cache is empty", () => {
    const fallback = {
      pages: [page([loan("loan-1", "A"), loan("loan-2", "B")])],
      pageParams: [1],
    };
    const updated = { ...loan("loan-1", "A"), outstandingBalance: 100 };

    const result = upsertLoanInInfiniteData(undefined, updated, {
      seedListWhenEmpty: false,
      fallback,
    });

    expect(result?.pages[0].loans).toHaveLength(2);
    expect(result?.pages[0].loans[0].outstandingBalance).toBe(100);
  });

  it("seeds a one-loan list on create when no list exists", () => {
    const created = loan("loan-1", "New Lender");

    const result = upsertLoanInInfiniteData(undefined, created, {
      seedListWhenEmpty: true,
    });

    expect(result?.pages[0].loans).toHaveLength(1);
    expect(result?.pages[0].loans[0].id).toBe("loan-1");
  });
});
