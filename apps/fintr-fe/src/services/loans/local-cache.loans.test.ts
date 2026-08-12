import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  cacheLoansAllPages,
  loadCachedLoansInfiniteData,
  upsertLoanInCachedPages,
} from "./local-cache";
import type { Loan } from "./queries";

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

describe("upsertLoanInCachedPages", () => {
  const spaceCode = "space-loans-cache";

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("updates one loan without dropping other cached loans", async () => {
    await cacheLoansAllPages(spaceCode, [
      {
        loans: [loan("loan-1", "A"), loan("loan-2", "B")],
        nextPage: null,
        totalPages: 1,
        totalCount: 2,
      },
    ]);

    await upsertLoanInCachedPages(spaceCode, {
      ...loan("loan-1", "A"),
      outstandingBalance: 100,
    });

    const cached = await loadCachedLoansInfiniteData(spaceCode);
    expect(cached?.pages[0].loans.map((row) => row.id)).toEqual([
      "loan-1",
      "loan-2",
    ]);
    expect(cached?.pages[0].loans[0].outstandingBalance).toBe(100);
  });

  it("does not overwrite the cached list with a single loan on update", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["loans"], {
      pages: [
        {
          loans: [loan("loan-1", "A"), loan("loan-2", "B")],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
        },
      ],
      pageParams: [1],
    });

    await upsertLoanInCachedPages(
      spaceCode,
      { ...loan("loan-1", "A"), outstandingBalance: 50 },
      { queryClient, seedListWhenEmpty: false },
    );

    const cached = await loadCachedLoansInfiniteData(spaceCode);
    expect(cached?.pages[0].loans).toHaveLength(2);
  });
});
