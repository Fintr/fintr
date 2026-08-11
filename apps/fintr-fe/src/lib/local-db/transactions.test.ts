import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  countSpaceTransactions,
  listSpaceTransactions,
  listSpaceTransactionsInDateRange,
  putSpaceTransactions,
} from "./transactions";
import { resetLocalDbForTests } from "./db";

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
});
