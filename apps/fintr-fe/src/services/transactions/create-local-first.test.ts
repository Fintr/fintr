import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { getLocalDb, resetLocalDbForTests } from "@/lib/local-db";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  createTransaction: vi.fn(),
}));

import { createTransaction } from "./mutation";
import {
  buildOptimisticIndexTransaction,
  buildOptimisticSeriesTransactions,
  createTransactionLocalFirst,
} from "./create-local-first";

const listQueryKey = [
  "transactions",
  "space-a",
  "[]",
  "2026-08-01",
  "2026-08-31",
  "",
  "",
  "",
  "[]",
  "local",
] as const;

describe("createTransactionLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("writes locally first, then reconciles with the server id", async () => {
    vi.mocked(createTransaction).mockResolvedValue({
      data: { id: "server-tx-1" },
    });

    const api = {} as never;
    const result = await createTransactionLocalFirst(api, {
      spaceId: "space-a",
      data: {
        amount: 50,
        description: "Lunch",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
      amountCurrency: "PHP",
    });

    expect(createTransaction).toHaveBeenCalledOnce();
    expect(createTransaction).toHaveBeenCalledWith(
      api,
      expect.objectContaining({
        description: "Lunch",
        clientMutationId: expect.any(String),
      }),
    );
    expect(result.pendingSync).toBe(false);
    expect(result.data.id).toBe("server-tx-1");
    expect(result.localTransaction.type).toBe(
      CombinedTransactionTypeEnum.EXPENSE,
    );

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("server-tx-1");
    expect(rows[0]?.description).toBe("Lunch");

    const outboxCount = await getLocalDb().outbox.count();
    expect(outboxCount).toBe(0);
  });

  it("keeps the local row when the network fails", async () => {
    vi.mocked(createTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );

    const result = await createTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      data: {
        amount: 20,
        description: "Offline snack",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });

    expect(result.pendingSync).toBe(true);
    expect(result.data.id.startsWith("local:")).toBe(true);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(result.data.id);

    const pending = await getLocalDb()
      .outbox.where("status")
      .equals("pending")
      .count();
    expect(pending).toBe(1);
  });

  it("writes local repeat children offline and keeps them pending sync", async () => {
    vi.mocked(createTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );

    const result = await createTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      data: {
        amount: 100,
        description: "Rent",
        transactionType: "expense",
        categoryName: "Home",
        accountName: "Cash",
        date: "2026-06-08",
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_month",
      },
    });

    expect(result.pendingSync).toBe(true);
    expect(result.localSeriesTransactions.length).toBeGreaterThan(1);
    expect(
      result.localSeriesTransactions.every((row) => row.inSeries),
    ).toBe(true);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-06-01",
      "2026-09-30",
    );
    expect(rows.length).toBe(result.localSeriesTransactions.length);
    expect(rows.map((row) => row.date).sort()).toEqual(
      result.localSeriesTransactions.map((row) => row.date).sort(),
    );
  });

  it("rolls back the local row on server validation errors", async () => {
    vi.mocked(createTransaction).mockRejectedValue({
      success: false,
      message: "Validation failed",
      details: { categoryName: ["is invalid"] },
    });

    await expect(
      createTransactionLocalFirst({} as never, {
        spaceId: "space-a",
        data: {
          amount: 25,
          description: "Bad category",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      }),
    ).rejects.toMatchObject({ success: false });

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects client-invalid payloads before writing locally", async () => {
    await expect(
      createTransactionLocalFirst({} as never, {
        spaceId: "space-a",
        data: {
          amount: -1,
          description: "Bad",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      }),
    ).rejects.toMatchObject({
      success: false,
      details: expect.objectContaining({ amount: expect.any(Array) }),
    });

    expect(createTransaction).not.toHaveBeenCalled();
    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);
  });

  it("patches React Query with series rows that match the active list range first", async () => {
    vi.mocked(createTransaction).mockImplementation(
      () => new Promise(() => undefined),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
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

    const result = await createTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 40,
          description: "Weekly snack",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-01",
          scheduleType: ScheduleTypeEnum.REPEAT,
          repeatInterval: "every_week",
        },
        amountCurrency: "PHP",
      },
      {
        queryClient,
        waitForSync: false,
        today: "2026-08-08",
      },
    );

    expect(result.localSeriesTransactions.length).toBeGreaterThan(1);

    const inListRange = result.localSeriesTransactions.filter((row) => {
      const day = row.date.slice(0, 10);
      return day >= "2026-08-01" && day <= "2026-08-31";
    });
    expect(inListRange.length).toBeGreaterThan(1);

    const cachedIds =
      queryClient.getQueryData<{
        pages: Array<{ transactions: Array<{ id: string }> }>;
      }>(listQueryKey)?.pages[0]?.transactions.map((row) => row.id) ?? [];

    expect(cachedIds.sort()).toEqual(inListRange.map((row) => row.id).sort());
  });

  it("returns optimistically before the network finishes when waitForSync is false", async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.mocked(createTransaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
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

    const result = await createTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 40,
          description: "Optimistic lunch",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
        amountCurrency: "PHP",
      },
      {
        queryClient,
        waitForSync: false,
      },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.data.id.startsWith("local:")).toBe(true);
    expect(result.syncPromise).toBeInstanceOf(Promise);

    const cached = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string; description: string }> }>;
    }>(listQueryKey);
    expect(cached?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      result.data.id,
    ]);
    expect(cached?.pages[0]?.transactions[0]?.description).toBe(
      "Optimistic lunch",
    );

    resolveCreate({ data: { id: "server-tx-opt" } });
    const synced = await result.syncPromise;
    expect(synced.pendingSync).toBe(false);
    expect(synced.data.id).toBe("server-tx-opt");

    const afterSync = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string }> }>;
    }>(listQueryKey);
    expect(afterSync?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      "server-tx-opt",
    ]);
  });

  it("rolls back React Query caches when optimistic sync hits validation errors", async () => {
    vi.mocked(createTransaction).mockRejectedValue({
      success: false,
      message: "Validation failed",
      details: { accountName: ["not found"] },
    });

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
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

    const result = await createTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 15,
          description: "Will fail",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      },
      {
        queryClient,
        waitForSync: false,
      },
    );

    expect(
      queryClient.getQueryData<{
        pages: Array<{ transactions: unknown[] }>;
      }>(listQueryKey)?.pages[0]?.transactions,
    ).toHaveLength(1);

    await expect(result.syncPromise).rejects.toMatchObject({ success: false });

    expect(
      queryClient.getQueryData<{
        pages: Array<{ transactions: unknown[] }>;
      }>(listQueryKey)?.pages[0]?.transactions,
    ).toHaveLength(0);
  });

  it("sends clientMutationId so server creates are idempotent for peers/retries", async () => {
    vi.mocked(createTransaction).mockResolvedValue({
      data: { id: "server-tx-idempotent" },
    });

    await createTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      data: {
        amount: 12,
        description: "Coffee",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });

    expect(createTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientMutationId: expect.stringMatching(/\S+/),
        description: "Coffee",
      }),
    );
  });

  it("persists converted FX amount into IndexedDB on create", async () => {
    vi.mocked(createTransaction).mockResolvedValue({
      data: { id: "server-fx-1" },
    });

    const result = await createTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      data: {
        amount: 200,
        description: "Starbucks",
        transactionType: "expense",
        categoryName: "Coffee",
        accountName: "BDO",
        date: "2026-08-10",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        original_currency: "GBP",
        exchange_rate: 82.0742,
        exchange_rate_source: "auto",
      },
      amountCurrency: "PHP",
    });

    expect(result.localTransaction.amount).toBe(16414.84);
    expect(result.localTransaction.bookedAmountCurrency).toBe("GBP");

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(16414.84);
    expect(rows[0]?.amountCurrency).toBe("PHP");
    expect(rows[0]?.bookedAmount).toBe(200);
    expect(rows[0]?.bookedAmountCurrency).toBe("GBP");
  });

  it("converts optimistic FX amount into space currency for list display", () => {
    const row = buildOptimisticIndexTransaction({
      id: "local:fx",
      amountCurrency: "PHP",
      data: {
        amount: 200,
        description: "Starbucks",
        transactionType: "expense",
        categoryName: "Coffee",
        accountName: "SAMPLE BDO LONG ASS NAME",
        date: "2026-08-10",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        original_currency: "GBP",
        exchange_rate: 82.0742,
        exchange_rate_source: "auto",
      },
    });

    expect(row.amount).toBe(16414.84);
    expect(row.amountCurrency).toBe("PHP");
    expect(row.bookedAmount).toBe(200);
    expect(row.bookedAmountCurrency).toBe("GBP");
  });

  it("leaves same-currency creates unconverted", () => {
    const row = buildOptimisticIndexTransaction({
      id: "local:same",
      amountCurrency: "PHP",
      data: {
        amount: 200,
        description: "Local coffee",
        transactionType: "expense",
        categoryName: "Coffee",
        accountName: "Cash",
        date: "2026-08-10",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });

    expect(row.amount).toBe(200);
    expect(row.amountCurrency).toBe("PHP");
    expect(row.bookedAmount).toBeUndefined();
    expect(row.bookedAmountCurrency).toBeUndefined();
  });

  it("marks optimistic rows calculated when date is on or before today", () => {
    const today = "2026-08-08";
    const past = buildOptimisticIndexTransaction({
      id: "local:past",
      data: {
        amount: 10,
        description: "Past",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-01",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
      today,
    });
    const current = buildOptimisticIndexTransaction({
      id: "local:today",
      data: {
        amount: 10,
        description: "Today",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: today,
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
      today,
    });
    const future = buildOptimisticIndexTransaction({
      id: "local:future",
      data: {
        amount: 10,
        description: "Future",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-15",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
      today,
    });

    expect(past.calculated).toBe(true);
    expect(current.calculated).toBe(true);
    expect(future.calculated).toBe(false);
  });

  it("derives calculated per occurrence in an optimistic repeat series", () => {
    const series = buildOptimisticSeriesTransactions({
      clientMutationId: "series-cid",
      today: "2026-08-08",
      data: {
        amount: 40,
        description: "Weekly",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-01",
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_week",
      },
    });

    const calculatedByDate = Object.fromEntries(
      series.map((row) => [row.date.slice(0, 10), row.calculated]),
    );

    expect(calculatedByDate["2026-08-01"]).toBe(true);
    expect(calculatedByDate["2026-08-08"]).toBe(true);
    expect(calculatedByDate["2026-08-15"]).toBe(false);
  });
});
