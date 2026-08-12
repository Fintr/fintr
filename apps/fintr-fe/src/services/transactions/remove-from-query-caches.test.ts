import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { removeIndexTransactionsFromQueryCaches } from "./remove-from-query-caches";

const baseExpense = {
  description: "Gone",
  amount: 20,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
};

describe("removeIndexTransactionsFromQueryCaches", () => {
  it("removes matching rows and adjusts totals", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const queryKey = [
      "transactions",
      spaceId,
      "[]",
      "2026-08-01",
      "2026-08-31",
      "",
      "",
      "",
      "[]",
      "local",
    ];

    queryClient.setQueryData(queryKey, {
      pages: [
        {
          transactions: [
            {
              ...baseExpense,
              id: "keep-1",
              date: "2026-08-08",
              description: "Keep",
              amount: 10,
            },
            {
              ...baseExpense,
              id: "remove-1",
              date: "2026-08-08",
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 30, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedTransactions: [
        {
          ...baseExpense,
          id: "remove-1",
          date: "2026-08-08",
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{
        transactions: Array<{ id: string }>;
        totalCount: number;
        totals: { expense: number } | null;
      }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions.map((row) => row.id)).toEqual(["keep-1"]);
    expect(next?.pages[0]?.totalCount).toBe(1);
    expect(next?.pages[0]?.totals?.expense).toBe(10);
  });

  it("removes deleted rows from dashboard period transaction caches", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const dashboardKey = [
      "dashboard",
      "transactions",
      spaceId,
      "2026-08-01",
      "2026-08-31",
    ];

    queryClient.setQueryData(dashboardKey, {
      transactions: [
        {
          ...baseExpense,
          id: "keep-1",
          date: "2026-08-08",
          amount: 10,
          type: CombinedTransactionTypeEnum.INCOME,
          fromAccountName: "",
          toAccountName: "Cash",
        },
        {
          ...baseExpense,
          id: "remove-1",
          date: "2026-08-08",
          amount: 2_462_142,
          type: CombinedTransactionTypeEnum.INCOME,
          fromAccountName: "",
          toAccountName: "Cash",
          categoryName: "Freelance",
        },
      ],
    });

    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedIds: ["remove-1"],
      removedTransactions: [
        {
          ...baseExpense,
          id: "remove-1",
          date: "2026-08-08",
          amount: 2_462_142,
          type: CombinedTransactionTypeEnum.INCOME,
          fromAccountName: "",
          toAccountName: "Cash",
          categoryName: "Freelance",
        },
      ],
    });

    const next = queryClient.getQueryData<{
      transactions: Array<{ id: string; amount: number }>;
    }>(dashboardKey);

    expect(next?.transactions).toHaveLength(1);
    expect(next?.transactions[0]?.id).toBe("keep-1");
  });

  it("removes a visible row even when the seed preview fails the list filter", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const queryKey = [
      "transactions",
      spaceId,
      "[]",
      "2026-08-01",
      "2026-08-31",
      "",
      "",
      "",
      "[]",
      "network",
    ];

    queryClient.setQueryData(queryKey, {
      pages: [
        {
          transactions: [
            {
              ...baseExpense,
              id: "xfer-visible",
              date: "2026-08-08",
              type: CombinedTransactionTypeEnum.TRANSFER,
              categoryName: "Transfer",
              toAccountName: "Bank",
              amount: 100,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 0, transfer: 100 },
        },
      ],
      pageParams: [1],
    });

    // Seed has a date outside the list filter — previously skipped the cache.
    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedIds: ["xfer-visible"],
      removedTransactions: [
        {
          ...baseExpense,
          id: "xfer-visible",
          date: "2026-07-01",
          type: CombinedTransactionTypeEnum.TRANSFER,
          categoryName: "Transfer",
          toAccountName: "Bank",
          amount: 100,
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string }> }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions).toEqual([]);
  });

  it("does not touch lists whose filter does not match the deleted row", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const julyKey = [
      "transactions",
      spaceId,
      "[]",
      "2026-07-01",
      "2026-07-31",
      "",
      "",
      "",
      "[]",
      "network",
    ];

    queryClient.setQueryData(julyKey, {
      pages: [
        {
          transactions: [
            {
              ...baseExpense,
              id: "july-1",
              date: "2026-07-15",
              amount: 5,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 5, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedTransactions: [
        {
          ...baseExpense,
          id: "aug-1",
          date: "2026-08-08",
          amount: 20,
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{
        transactions: Array<{ id: string }>;
        totalCount: number;
        totals: { expense: number };
      }>;
    }>(julyKey);

    expect(next?.pages[0]?.transactions.map((row) => row.id)).toEqual(["july-1"]);
    expect(next?.pages[0]?.totalCount).toBe(1);
    expect(next?.pages[0]?.totals.expense).toBe(5);
  });

  it("clears totals to null when the last matching row is removed", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const queryKey = [
      "transactions",
      spaceId,
      "[]",
      "2026-08-01",
      "2026-08-31",
      "",
      "",
      "",
      "[]",
      "local",
    ];

    queryClient.setQueryData(queryKey, {
      pages: [
        {
          transactions: [
            {
              ...baseExpense,
              id: "only",
              date: "2026-08-08",
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 20, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedTransactions: [
        {
          ...baseExpense,
          id: "only",
          date: "2026-08-08",
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ transactions: unknown[]; totals: unknown }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions).toEqual([]);
    expect(next?.pages[0]?.totals).toBeNull();
  });

  it("removes rows from account activity caches by id or activitableId", () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData([ACCOUNT_DETAIL_ACTIVITIES_KEY, "acct-1"], {
      pages: [
        {
          activities: [
            {
              id: "act-1",
              activitableId: "tx-keep",
              date: "2026-08-08",
              description: "Keep",
              amount: 5,
              categoryName: "Food",
              fromAccountName: "Cash",
              toAccountName: "",
              type: CombinedTransactionTypeEnum.EXPENSE,
              inSeries: false,
              hasImage: false,
            },
            {
              id: "act-2",
              activitableId: "tx-gone",
              date: "2026-08-08",
              description: "Gone",
              amount: 7,
              categoryName: "Food",
              fromAccountName: "Cash",
              toAccountName: "",
              type: CombinedTransactionTypeEnum.EXPENSE,
              inSeries: false,
              hasImage: false,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 12, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId: "space-a",
      removedIds: ["tx-gone"],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ activities: Array<{ id: string }> }>;
    }>([ACCOUNT_DETAIL_ACTIVITIES_KEY, "acct-1"]);

    expect(next?.pages[0]?.activities.map((row) => row.id)).toEqual(["act-1"]);
  });
});
