import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { EntityDetail } from "@/services/entities/mutation";

import type { Loan, LoansPage } from "./queries";
import {
  removeLoanFromQueryCaches,
  upsertLoanInInfiniteData,
} from "./loans-list-cache";

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

describe("removeLoanFromQueryCaches", () => {
  it("drops the deleted loan from the contact detail list immediately", () => {
    const queryClient = new QueryClient();
    const remainingLoan = {
      id: "loan-keep",
      date: "2026-09-20",
      description: "Share of Split Bill 2",
      loanType: "lent" as const,
      status: "active",
      entityName: "Miko2",
      accountName: "Cash",
      principalAmount: 3000,
      outstandingBalance: 3000,
      currency: "PHP",
    };
    const deletedLoan = {
      ...remainingLoan,
      id: "loan-delete",
      description: "Share of Split Bill",
      principalAmount: 150,
      outstandingBalance: 150,
    };
    const detail: EntityDetail = {
      entity: {
        id: "entity-miko2",
        fullName: "Miko2",
        entityType: "loan",
      },
      transactions: [],
      loans: [deletedLoan, remainingLoan],
      loanPayments: [
        {
          id: "pay-1",
          date: "2026-09-20",
          currency: "PHP",
          loanId: "loan-delete",
          accountName: "Cash",
          principalPayment: 0,
          interestPayment: 0,
          totalPayment: 0,
        },
      ],
      identifiers: [],
    };

    queryClient.setQueryData(
      ["entityDetail", "SPACE_1", "entity-miko2"],
      detail,
    );
    queryClient.setQueryData(
      ["entityDetail", "local", "SPACE_1", "entity-miko2"],
      detail,
    );

    removeLoanFromQueryCaches(queryClient, "loan-delete", "SPACE_1");

    const nextDetail = queryClient.getQueryData<EntityDetail>([
      "entityDetail",
      "SPACE_1",
      "entity-miko2",
    ]);
    const nextLocal = queryClient.getQueryData<EntityDetail>([
      "entityDetail",
      "local",
      "SPACE_1",
      "entity-miko2",
    ]);

    expect(nextDetail?.loans.map((row) => row.id)).toEqual(["loan-keep"]);
    expect(nextDetail?.loanPayments).toEqual([]);
    expect(nextLocal?.loans.map((row) => row.id)).toEqual(["loan-keep"]);
    expect(nextLocal?.loanPayments).toEqual([]);
  });
});
