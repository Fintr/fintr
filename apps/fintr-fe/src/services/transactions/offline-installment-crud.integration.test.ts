import "fake-indexeddb/auto";

import { QueryClient, onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DeleteScopeEnum,
  ScheduleTypeEnum,
  UpdateScopeEnum,
} from "@/constants/transactionConstants";
import { resetLocalDbForTests } from "@/lib/local-db";
import { listSpaceTransactions } from "@/lib/local-db/transactions";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { buildRecurringSeriesSummaries } from "@/utils/recurringSchedule";

vi.mock("./mutation", () => ({
  createTransaction: vi.fn(() => new Promise(() => {})),
  updateTransaction: vi.fn(() => new Promise(() => {})),
  deleteTransaction: vi.fn(() => new Promise(() => {})),
}));

import { createTransactionLocalFirst } from "./create-local-first";
import { deleteTransactionLocalFirst } from "./delete-local-first";
import {
  loadAllTransactionsFromLocalIndex,
  upsertLocalIndexTransaction,
} from "./local-cache";
import { updateTransactionLocalFirst } from "./update-local-first";

const SPACE = "space-install-offline";
const ROOT_ID = "install9-root";

const neverResolves = () => new Promise(() => {});

const installmentRow = (
  index: number,
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction => {
  const date = new Date(Date.UTC(2026, index, 1));
  const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return {
    id: index === 0 ? ROOT_ID : `install9-${index}`,
    date: dateKey,
    seriesParentDate: "2026-01-01",
    description: "INSTALL9",
    amount: 10_000,
    amountCurrency: "PHP",
    bookedAmount: 100,
    bookedAmountCurrency: "GBP",
    categoryName: "Home",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: true,
    hasImage: false,
    calculated: index < 9,
    scheduleType: ScheduleTypeEnum.INSTALLMENT,
    installmentPeriod: 24,
    installmentTotal: 240_000,
    parentId: index === 0 ? undefined : ROOT_ID,
    rootParentId: ROOT_ID,
    currencyConversion: {
      originalAmount: 100,
      originalCurrency: "GBP",
      convertedAmount: 10_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
      source: "manual",
    },
    ...overrides,
  };
};

const seedInstallmentSeries = async (): Promise<IndexTransaction[]> => {
  const rows = Array.from({ length: 24 }, (_, index) => installmentRow(index));
  for (const row of rows) {
    await upsertLocalIndexTransaction(SPACE, row);
  }
  return rows;
};

const seriesFromIdb = async () => {
  const rows = await loadAllTransactionsFromLocalIndex(SPACE);
  return buildRecurringSeriesSummaries(rows).find(
    (entry) => entry.rootParentId === ROOT_ID,
  );
};

const recurringSeriesKey = ["recurringSeries", SPACE] as const;

describe("offline installment CRUD", () => {
  const originalOnline = onlineManager.isOnline();

  beforeEach(async () => {
    await resetLocalDbForTests();
    onlineManager.setOnline(false);
  });

  afterEach(async () => {
    onlineManager.setOnline(originalOnline);
    await resetLocalDbForTests();
  });

  it("creates a GBP installment plan locally without waiting for the API", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(recurringSeriesKey, []);

    const result = await createTransactionLocalFirst(
      {} as never,
      {
        spaceId: SPACE,
        entryCurrency: "GBP",
        spaceCurrency: "PHP",
        data: {
          amount: 2400,
          description: "INSTALL9",
          transactionType: "expense",
          categoryName: "Home",
          accountName: "Cash",
          date: "2026-01-01",
          scheduleType: ScheduleTypeEnum.INSTALLMENT,
          installmentPeriod: 24,
          installmentTotal: 2400,
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
      },
      { queryClient, waitForSync: false, today: "2026-08-24" },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.localSeriesTransactions).toHaveLength(24);
    for (const row of result.localSeriesTransactions) {
      expect(row.amount).toBe(10_000);
      expect(row.amountCurrency).toBe("PHP");
      expect(row.bookedAmount).toBe(100);
      expect(row.bookedAmountCurrency).toBe("GBP");
    }

    const stored = await listSpaceTransactions(SPACE);
    expect(stored).toHaveLength(24);

    const cached = queryClient.getQueryData<IndexTransaction[]>(recurringSeriesKey);
    expect(cached).toHaveLength(24);
    expect(cached?.every((row) => row.amount === 10_000)).toBe(true);
  });

  it("updates only the edited payment when scope is this_only", async () => {
    const rows = await seedInstallmentSeries();
    const target = rows[8]!;
    const queryClient = new QueryClient();
    queryClient.setQueryData(recurringSeriesKey, rows);

    await updateTransactionLocalFirst(
      { put: neverResolves } as never,
      {
        spaceId: SPACE,
        previous: target,
        amountCurrency: "PHP",
        data: {
          id: target.id,
          amount: 200,
          description: "INSTALL9",
          transactionType: "expense",
          categoryName: "Home",
          accountName: "Cash",
          date: target.date,
          scheduleType: ScheduleTypeEnum.INSTALLMENT,
          installmentPeriod: 24,
          installmentTotal: 2500,
          updateScope: UpdateScopeEnum.THIS_ONLY,
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        } as never,
      },
      { queryClient, waitForSync: false },
    );

    const stored = await loadAllTransactionsFromLocalIndex(SPACE);
    const edited = stored.find((row) => row.id === target.id);
    const untouched = stored.find((row) => row.id === rows[9]!.id);
    expect(edited?.amount).toBe(20_000);
    expect(edited?.bookedAmount).toBe(200);
    expect(untouched?.amount).toBe(10_000);
    expect(untouched?.bookedAmount).toBe(100);
    expect(stored.every((row) => row.installmentTotal === 250_000)).toBe(true);

    const series = await seriesFromIdb();
    expect(series?.installmentTotal).toBe(250_000);
  });

  it("revises this and future payments when scope is this_and_future", async () => {
    const rows = await seedInstallmentSeries();
    const mayRow = rows[4]!;
    const queryClient = new QueryClient();
    queryClient.setQueryData(recurringSeriesKey, rows);

    await updateTransactionLocalFirst(
      { put: neverResolves } as never,
      {
        spaceId: SPACE,
        previous: mayRow,
        amountCurrency: "PHP",
        data: {
          id: mayRow.id,
          amount: 100,
          description: "INSTALL9",
          transactionType: "expense",
          categoryName: "Home",
          accountName: "Cash",
          date: mayRow.date,
          scheduleType: ScheduleTypeEnum.INSTALLMENT,
          installmentPeriod: 24,
          installmentTotal: 2700,
          updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        } as never,
      },
      { queryClient, waitForSync: false },
    );

    const stored = await loadAllTransactionsFromLocalIndex(SPACE);
    const april = stored.find((row) => row.date === "2026-04-01");
    const may = stored.find((row) => row.date === "2026-05-01");
    const december = stored.find((row) => row.date === "2026-12-01");
    expect(april?.amount).toBe(10_000);
    expect(april?.bookedAmount).toBe(100);
    expect(may?.amount).toBeGreaterThan(10_000);
    expect(december?.amount).toBe(may?.amount);
    expect(stored.every((row) => row.installmentTotal === 270_000)).toBe(true);
  });

  it("rewrites every payment to GBP 125 when all-in-series total becomes 3000", async () => {
    const rows = await seedInstallmentSeries();
    const queryClient = new QueryClient();
    queryClient.setQueryData(recurringSeriesKey, rows);

    await updateTransactionLocalFirst(
      { put: neverResolves } as never,
      {
        spaceId: SPACE,
        previous: rows[0]!,
        amountCurrency: "PHP",
        data: {
          id: ROOT_ID,
          amount: 125,
          description: "INSTALL9",
          transactionType: "expense",
          categoryName: "Home",
          accountName: "Cash",
          date: rows[0]!.date,
          scheduleType: ScheduleTypeEnum.INSTALLMENT,
          installmentPeriod: 24,
          installmentTotal: 3000,
          updateScope: UpdateScopeEnum.ALL_IN_SERIES,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        } as never,
      },
      { queryClient, waitForSync: false },
    );

    const stored = await loadAllTransactionsFromLocalIndex(SPACE);
    expect(stored).toHaveLength(24);
    for (const row of stored) {
      expect(row.amount).toBe(12_500);
      expect(row.bookedAmount).toBe(125);
      expect(row.amountCurrency).toBe("PHP");
      expect(row.installmentTotal).toBe(300_000);
    }

    const series = await seriesFromIdb();
    expect(series?.amount).toBe(12_500);
    expect(series?.installmentTotal).toBe(300_000);

    const cached = queryClient.getQueryData<IndexTransaction[]>(recurringSeriesKey);
    expect(cached).toHaveLength(24);
    expect(cached?.every((row) => row.amount === 12_500)).toBe(true);
    expect(cached?.every((row) => row.installmentTotal === 300_000)).toBe(true);
  });

  it("deletes this payment only, this and future, and the whole series while offline", async () => {
    const queryClient = new QueryClient();

    const thisOnlyRows = await seedInstallmentSeries();
    queryClient.setQueryData(recurringSeriesKey, thisOnlyRows);
    await deleteTransactionLocalFirst(
      { delete: neverResolves } as never,
      {
        spaceId: SPACE,
        transactionId: thisOnlyRows[8]!.id,
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        listRow: thisOnlyRows[8]!,
      },
      { queryClient, waitForSync: false },
    );
    expect(
      (await loadAllTransactionsFromLocalIndex(SPACE)).map((row) => row.id),
    ).not.toContain(thisOnlyRows[8]!.id);
    expect(await loadAllTransactionsFromLocalIndex(SPACE)).toHaveLength(23);

    await resetLocalDbForTests();
    const futureRows = await seedInstallmentSeries();
    queryClient.setQueryData(recurringSeriesKey, futureRows);
    await deleteTransactionLocalFirst(
      { delete: neverResolves } as never,
      {
        spaceId: SPACE,
        transactionId: futureRows[8]!.id,
        deleteScope: DeleteScopeEnum.THIS_AND_FUTURE,
        listRow: futureRows[8]!,
      },
      { queryClient, waitForSync: false },
    );
    const afterFuture = await loadAllTransactionsFromLocalIndex(SPACE);
    expect(afterFuture).toHaveLength(8);
    expect(afterFuture.every((row) => row.date < "2026-09-01")).toBe(true);

    await resetLocalDbForTests();
    const allRows = await seedInstallmentSeries();
    queryClient.setQueryData(recurringSeriesKey, allRows);
    await deleteTransactionLocalFirst(
      { delete: neverResolves } as never,
      {
        spaceId: SPACE,
        transactionId: ROOT_ID,
        deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
        listRow: allRows[0]!,
      },
      { queryClient, waitForSync: false },
    );
    expect(await loadAllTransactionsFromLocalIndex(SPACE)).toHaveLength(0);
    expect(queryClient.getQueryData<IndexTransaction[]>(recurringSeriesKey)).toEqual(
      [],
    );
  });
});
