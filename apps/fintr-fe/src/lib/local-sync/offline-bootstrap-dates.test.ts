import { describe, expect, it } from "vitest";

import type { TransactionsPage } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  earliestTransactionDate,
  monthRangesForOfflineHydration,
  monthRangesInclusive,
} from "./offline-bootstrap-dates";

describe("offline-bootstrap-dates", () => {
  it("finds the earliest transaction date across pages", () => {
    const pages: TransactionsPage[] = [
      {
        transactions: [
          {
            id: "2",
            date: "2026-07-15",
            amount: 1,
            type: CombinedTransactionTypeEnum.EXPENSE,
          } as TransactionsPage["transactions"][number],
          {
            id: "1",
            date: "2026-03-02",
            amount: 1,
            type: CombinedTransactionTypeEnum.EXPENSE,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 2,
        totals: null,
      },
    ];

    expect(earliestTransactionDate(pages)).toBe("2026-03-02");
  });

  it("lists inclusive month ranges", () => {
    expect(monthRangesInclusive("2026-06-15", "2026-08-01")).toEqual([
      { startDate: "2026-06-01", endDate: "2026-06-30" },
      { startDate: "2026-07-01", endDate: "2026-07-31" },
      { startDate: "2026-08-01", endDate: "2026-08-31" },
    ]);
  });

  it("builds hydration months from first transaction through today", () => {
    const pages: TransactionsPage[] = [
      {
        transactions: [
          {
            id: "1",
            date: "2026-07-01",
            amount: 1,
            type: CombinedTransactionTypeEnum.EXPENSE,
          } as TransactionsPage["transactions"][number],
        ],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
        totals: null,
      },
    ];

    const ranges = monthRangesForOfflineHydration(pages);
    expect(ranges[0]).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    expect(ranges.at(-1)?.startDate.startsWith("2026-08")).toBe(true);
  });
});
