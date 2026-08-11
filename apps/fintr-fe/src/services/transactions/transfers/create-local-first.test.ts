import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { getLocalDb, resetLocalDbForTests } from "@/lib/local-db";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  createTransfer: vi.fn(),
}));

import { createTransfer } from "./mutation";
import {
  buildOptimisticSeriesTransfers,
  createTransferLocalFirst,
} from "./create-local-first";
import { TRANSFER_FEE_CATEGORY_NAME } from "./fee-description";

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

describe("createTransferLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("optimistically inserts the transfer and fee expense when transactionCost > 0", async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.mocked(createTransfer).mockImplementation(
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
          totals: { income: 0, expense: 0, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    const result = await createTransferLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 1000,
          transactionCost: 25,
          date: "2026-08-08",
          description: "Move to savings",
          fromAccountName: "Cash",
          toAccountName: "Bank",
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
    expect(result.localFeeTransaction).not.toBeNull();
    expect(result.localFeeTransaction?.description).toBe(
      "Transfer fee for: Move to savings, amount: 1000",
    );
    expect(result.localFeeTransaction?.amount).toBe(25);
    expect(result.localFeeTransaction?.categoryName).toBe(
      TRANSFER_FEE_CATEGORY_NAME,
    );
    expect(result.localFeeTransaction?.type).toBe(
      CombinedTransactionTypeEnum.EXPENSE,
    );

    const cachedRows = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string; type: string }> }>;
    }>(listQueryKey)?.pages[0]?.transactions;
    expect(cachedRows).toHaveLength(2);
    expect(cachedRows?.map((row) => row.type).sort()).toEqual([
      CombinedTransactionTypeEnum.EXPENSE,
      CombinedTransactionTypeEnum.TRANSFER,
    ]);

    const idbRows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(idbRows).toHaveLength(2);

    resolveCreate({ data: { id: "server-xfer-1" } });
    await result.syncPromise;
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("omits a fee row when transactionCost is zero", async () => {
    vi.mocked(createTransfer).mockResolvedValue({ data: { id: "xfer-1" } });

    const result = await createTransferLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 100,
          transactionCost: 0,
          date: "2026-08-08",
          description: "",
          fromAccountName: "Cash",
          toAccountName: "Bank",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      },
      { waitForSync: false },
    );

    expect(result.localFeeTransaction).toBeNull();
    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(1);
  });

  it("optimistically expands a repeat series with a fee per occurrence", () => {
    const series = buildOptimisticSeriesTransfers({
      clientMutationId: "series-cid",
      today: "2026-08-08",
      amountCurrency: "PHP",
      data: {
        amount: 200,
        transactionCost: 15,
        date: "2026-08-01",
        description: "Transfer6",
        fromAccountName: "BDO CC - Ella",
        toAccountName: "EastWest",
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_week",
      },
    });

    expect(series.childTransfers.length).toBeGreaterThan(0);
    expect(series.childFees).toHaveLength(series.childTransfers.length);
    expect(series.allRows.filter((row) => row.type === CombinedTransactionTypeEnum.TRANSFER)).toHaveLength(
      series.childTransfers.length + 1,
    );
    expect(
      series.allRows.filter(
        (row) =>
          row.type === CombinedTransactionTypeEnum.EXPENSE &&
          row.categoryName === TRANSFER_FEE_CATEGORY_NAME,
      ),
    ).toHaveLength(series.childFees.length + 1);
    expect(series.childFees.every((fee) => fee.id.endsWith(":fee"))).toBe(true);
  });

  it("marks optimistic transfer rows calculated when date is on or before today", () => {
    const series = buildOptimisticSeriesTransfers({
      clientMutationId: "series-cid",
      today: "2026-08-08",
      amountCurrency: "PHP",
      data: {
        amount: 200,
        transactionCost: 15,
        date: "2026-08-01",
        description: "Transfer6",
        fromAccountName: "BDO CC - Ella",
        toAccountName: "EastWest",
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_week",
      },
    });

    const calculatedByDate = Object.fromEntries(
      series.allRows.map((row) => [row.date.slice(0, 10), row.calculated]),
    );

    expect(calculatedByDate["2026-08-01"]).toBe(true);
    expect(calculatedByDate["2026-08-08"]).toBe(true);
    expect(calculatedByDate["2026-08-15"]).toBe(false);
  });
});
