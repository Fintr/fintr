import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  replaceIndexTransactionIdInQueryCaches,
  transactionMatchesListFilter,
  upsertIndexTransactionsIntoQueryCaches,
} from "./upsert-into-query-caches";

const baseRow = {
  description: "Coffee",
  amount: 10,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  categoryId: "11111111-1111-4111-8111-111111111111",
};

describe("transactionMatchesListFilter", () => {
  it("matches open date range and rejects out-of-range dates", () => {
    const tx = {
      ...baseRow,
      id: "a",
      date: "2026-08-15",
    };

    expect(
      transactionMatchesListFilter(tx, {
        categories: [],
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        minAmount: "",
        maxAmount: "",
        searchQuery: "",
        accountNames: [],
        tagIds: [],
        entryType: "all",
      }),
    ).toBe(true);

    expect(
      transactionMatchesListFilter(tx, {
        categories: [],
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        minAmount: "",
        maxAmount: "",
        searchQuery: "",
        accountNames: [],
        tagIds: [],
        entryType: "all",
      }),
    ).toBe(false);
  });
});

describe("upsertIndexTransactionsIntoQueryCaches", () => {
  it("inserts at date-desc position and updates totals", () => {
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
              ...baseRow,
              id: "newer",
              date: "2026-08-20",
              createdAt: "2026-08-20T10:00:00.000Z",
              description: "Newer",
              amount: 5,
            },
            {
              ...baseRow,
              id: "older",
              date: "2026-08-01",
              createdAt: "2026-08-01T10:00:00.000Z",
              description: "Older",
              amount: 5,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 10, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "mid",
          date: "2026-08-10",
          createdAt: "2026-08-10T12:00:00.000Z",
          description: "Middle",
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
    }>(queryKey);

    expect(next?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      "newer",
      "mid",
      "older",
    ]);
    expect(next?.pages[0]?.totalCount).toBe(3);
    expect(next?.pages[0]?.totals.expense).toBe(30);
  });

  it("puts same-day newest createdAt at the top without shifting later", () => {
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
              ...baseRow,
              id: "first",
              date: "2026-08-08",
              createdAt: "2026-08-08T01:00:00.000Z",
              description: "Earlier same day",
              amount: 5,
            },
            {
              ...baseRow,
              id: "prev-day",
              date: "2026-08-07",
              createdAt: "2026-08-07T12:00:00.000Z",
              description: "Previous day",
              amount: 5,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 10, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "latest",
          date: "2026-08-08",
          createdAt: "2026-08-08T05:00:00.000Z",
          description: "Latest same day",
          amount: 20,
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string }> }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      "latest",
      "first",
      "prev-day",
    ]);
  });

  it("keeps totals null when empty, then sets them once a row is inserted", () => {
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
          transactions: [],
          nextPage: null,
          totalPages: 1,
          totalCount: 0,
          totals: null,
        },
      ],
      pageParams: [1],
    });

    expect(
      queryClient.getQueryData<{ pages: Array<{ totals: unknown }> }>(queryKey)
        ?.pages[0]?.totals,
    ).toBeNull();

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "new",
          date: "2026-08-08",
          createdAt: "2026-08-08T12:00:00.000Z",
          amount: 42,
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ totals: { expense: number; income: number } | null }>;
    }>(queryKey);

    expect(next?.pages[0]?.totals).toEqual({
      income: 0,
      expense: 42,
      transfer: 0,
    });
  });

  it("ignores caches whose filters do not match", () => {
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
          transactions: [],
          nextPage: null,
          totalPages: 1,
          totalCount: 0,
          totals: { income: 0, expense: 0, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "aug",
          date: "2026-08-08",
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ transactions: unknown[]; totalCount: number }>;
    }>(julyKey);

    expect(next?.pages[0]?.transactions).toEqual([]);
    expect(next?.pages[0]?.totalCount).toBe(0);
  });

  it("replaces an existing id without growing totalCount", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const queryKey = [
      "transactions",
      "local",
      spaceId,
      "[]|2026-08-01|2026-08-31||||[]",
    ];

    queryClient.setQueryData(queryKey, {
      pages: [
        {
          transactions: [
            {
              ...baseRow,
              id: "same",
              date: "2026-08-08",
              description: "Old note",
              amount: 10,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 10, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "same",
          date: "2026-08-08",
          description: "New note",
          amount: 15,
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{
        transactions: Array<{ description: string; amount: number }>;
        totalCount: number;
        totals: { expense: number };
      }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions).toHaveLength(1);
    expect(next?.pages[0]?.transactions[0]?.description).toBe("New note");
    expect(next?.pages[0]?.totalCount).toBe(1);
    expect(next?.pages[0]?.totals.expense).toBe(15);
  });

  it("keeps position on same-id upsert when only createdAt changes", () => {
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
              ...baseRow,
              id: "top",
              date: "2026-08-10",
              createdAt: "2026-08-10T12:00:00.000Z",
              description: "Top",
              amount: 20,
            },
            {
              ...baseRow,
              id: "mid",
              date: "2026-08-10",
              createdAt: "2026-08-10T11:00:00.000Z",
              description: "Mid",
              amount: 10,
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

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "top",
          date: "2026-08-10",
          createdAt: "2026-08-10T08:00:00.000Z",
          description: "Top synced",
          amount: 20,
        },
      ],
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string; description: string }> }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      "top",
      "mid",
    ]);
    expect(next?.pages[0]?.transactions[0]?.description).toBe("Top synced");
  });

  it("drops the previous id when next id is already in the list", () => {
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
              ...baseRow,
              id: "server-1",
              date: "2026-08-10",
              amount: 20,
            },
            {
              ...baseRow,
              id: "local:cid",
              date: "2026-08-10",
              amount: 20,
            },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 40, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    replaceIndexTransactionIdInQueryCaches(queryClient, {
      spaceId,
      previousId: "local:cid",
      nextId: "server-1",
    });

    const next = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string }> }>;
    }>(queryKey);

    expect(next?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      "server-1",
    ]);
  });

  it("patches dashboard period transaction caches used by Income/Savings cards", () => {
    const queryClient = new QueryClient();
    const spaceId = "space-a";
    const dashboardKey = [
      "dashboard",
      "transactions",
      spaceId,
      "2026-08-01",
      "2026-08-31",
    ] as const;

    queryClient.setQueryData(dashboardKey, {
      transactions: [
        {
          ...baseRow,
          id: "income-1",
          date: "2026-08-11",
          amount: 10_000_000,
          type: CombinedTransactionTypeEnum.INCOME,
          categoryName: "Freelance",
        },
      ],
    });

    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [
        {
          ...baseRow,
          id: "income-1",
          date: "2026-08-11",
          amount: 1,
          type: CombinedTransactionTypeEnum.INCOME,
          categoryName: "Freelance",
        },
      ],
    });

    const next = queryClient.getQueryData<{
      transactions: Array<{ amount: number }>;
    }>(dashboardKey);

    expect(next?.transactions[0]?.amount).toBe(1);
  });
});
