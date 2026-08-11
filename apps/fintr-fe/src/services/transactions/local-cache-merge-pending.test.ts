import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  mergePendingLocalIndexRowsIntoPage,
  upsertLocalIndexTransaction,
} from "./local-cache";

describe("mergePendingLocalIndexRowsIntoPage", () => {
  beforeEach(async () => {
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("re-attaches local transfer fee rows wiped by a network page", async () => {
    await upsertLocalIndexTransaction("space-a", {
      id: "local:cid:fee",
      date: "2026-08-08",
      description: "Transfer fee for: Note, amount: 100",
      amount: 5,
      amountCurrency: "PHP",
      categoryName: "Transfer Fee",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const merged = await mergePendingLocalIndexRowsIntoPage("space-a", {
      transactions: [
        {
          id: "server-xfer",
          date: "2026-08-08",
          description: "Note",
          amount: 100,
          amountCurrency: "PHP",
          categoryName: "Transfer",
          fromAccountName: "Cash",
          toAccountName: "Bank",
          type: CombinedTransactionTypeEnum.TRANSFER,
          inSeries: false,
          hasImage: false,
        },
      ],
      nextPage: null,
      totalPages: 1,
      totalCount: 1,
      totals: { income: 0, expense: 0, transfer: 100 },
    });

    expect(merged.transactions.map((row) => row.id).sort()).toEqual([
      "local:cid:fee",
      "server-xfer",
    ]);
  });
});
