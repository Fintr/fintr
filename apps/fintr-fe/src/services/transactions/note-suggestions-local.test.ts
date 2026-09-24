import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { loadCachedNoteSuggestions } from "./note-suggestions-local";

describe("loadCachedNoteSuggestions", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("returns distinct descriptions filtered by category and type", async () => {
    const spaceId = "space-notes";

    const { listSpaceTransactions } = await import("@/lib/local-db/transactions");
    const { putSpaceTransactions } = await import("@/lib/local-db/transactions");

    await putSpaceTransactions(spaceId, [
      {
        id: "expense-1",
        date: "2026-01-10",
        description: "Coffee shop",
        amount: 5,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "expense-2",
        date: "2026-01-09",
        description: "Coffee shop",
        amount: 6,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "income-1",
        date: "2026-01-08",
        description: "Salary",
        amount: 100,
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
    ]);

    const suggestions = await loadCachedNoteSuggestions(spaceId, {
      categoryName: "Food",
      transactionType: "expense",
      limit: 5,
    });

    expect(suggestions).toEqual(["Coffee shop"]);

    const rows = await listSpaceTransactions(spaceId);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
