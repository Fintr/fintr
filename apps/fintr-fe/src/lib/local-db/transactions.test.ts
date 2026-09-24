import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";

import {
  countSpaceTransactions,
  getEarliestSpaceTransactionDate,
  listNewestSpaceTransactionsOnOrBefore,
  listRecurringSpaceTransactions,
  listSpaceTransactions,
  listSpaceTransactionsInDateRange,
  putSpaceTransactions,
} from "./transactions";
import { getLocalDb, resetLocalDbForTests } from "./db";

const sampleTransaction = (
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction =>
  ({
    id: "tx-1",
    date: "2026-08-12",
    description: "Coffee",
    amount: 150,
    categoryName: "Dine Out & Entertainment",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: false,
    hasImage: false,
    ...overrides,
  }) as IndexTransaction;

describe("local-db transactions index", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("stores and lists transactions for a workspace", async () => {
    await putSpaceTransactions("space-a", [
      sampleTransaction({ id: "tx-aug", date: "2026-08-12" }),
      sampleTransaction({ id: "tx-jul", date: "2026-07-08" }),
    ]);

    expect(await countSpaceTransactions("space-a")).toBe(2);
    expect(await listSpaceTransactions("space-a")).toHaveLength(2);
  });

  it("queries transactions by date range", async () => {
    await putSpaceTransactions("space-a", [
      sampleTransaction({ id: "tx-aug", date: "2026-08-12" }),
      sampleTransaction({ id: "tx-jul", date: "2026-07-08" }),
    ]);

    const augustOnly = await listSpaceTransactionsInDateRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );

    expect(augustOnly).toHaveLength(1);
    expect(augustOnly[0]?.id).toBe("tx-aug");
  });

  it("hydrates payload.type from the indexed type column", async () => {
    await putSpaceTransactions("space-a", [
      sampleTransaction({
        id: "tx-untyped",
        type: CombinedTransactionTypeEnum.INCOME,
      }),
    ]);

    const db = getLocalDb();
    const record = await db.transactions.get("space-a:tx-untyped");
    expect(record).toBeDefined();
    await db.transactions.put({
      ...record!,
      payload: {
        ...record!.payload,
        type: undefined as unknown as CombinedTransactionTypeEnum,
      },
    });

    const rows = await listSpaceTransactions("space-a");
    expect(rows[0]?.type).toBe(CombinedTransactionTypeEnum.INCOME);
  });

  it("lists only recurring and installment rows for a workspace", async () => {
    await putSpaceTransactions("space-a", [
      sampleTransaction({ id: "tx-coffee", date: "2026-08-12" }),
      sampleTransaction({
        id: "tx-rent",
        date: "2026-08-01",
        description: "Rent",
        inSeries: true,
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_month",
        rootParentId: "tx-rent",
      }),
    ]);

    const recurring = await listRecurringSpaceTransactions("space-a");

    expect(recurring).toHaveLength(1);
    expect(recurring[0]?.id).toBe("tx-rent");
    expect(await listSpaceTransactions("space-a")).toHaveLength(2);
  });

  it("returns only the newest rows on or before a date, capped by limit", async () => {
    await putSpaceTransactions("space-a", [
      sampleTransaction({ id: "old", date: "2024-01-01" }),
      sampleTransaction({ id: "mid", date: "2026-08-01" }),
      sampleTransaction({ id: "newest", date: "2026-09-22" }),
      sampleTransaction({ id: "future", date: "2027-01-01" }),
    ]);
    await putSpaceTransactions("space-b", [
      sampleTransaction({ id: "other-space", date: "2026-09-22" }),
    ]);

    const rows = await listNewestSpaceTransactionsOnOrBefore(
      "space-a",
      "2026-09-22",
      2,
    );

    expect(rows.map((row) => row.id)).toEqual(["newest", "mid"]);
  });

  it("returns no rows when the newest-on-or-before limit is empty", async () => {
    expect(
      await listNewestSpaceTransactionsOnOrBefore("space-a", "2026-09-22", 0),
    ).toEqual([]);
  });

  it("returns the earliest stored transaction date", async () => {
    await putSpaceTransactions("space-a", [
      sampleTransaction({ id: "tx-aug", date: "2026-08-12" }),
      sampleTransaction({ id: "tx-jan", date: "2025-01-10" }),
    ]);

    expect(await getEarliestSpaceTransactionDate("space-a")).toBe("2025-01-10");
  });
});
