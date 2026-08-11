import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import {
  applyLocalTransactionToMonthlySummaries,
  loadCachedMonthlyFinancialSummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import { loadLocalIndexTransactionById } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { applyRealtimeTransactionUpdated } from "./apply-realtime-update";

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

describe("applyRealtimeTransactionUpdated", () => {
  beforeEach(async () => {
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("patches the list row and adjusts monthly totals when amount changes", async () => {
    const queryClient = new QueryClient();
    const previous = {
      id: "tx-1",
      date: "2026-08-08",
      createdAt: "2026-08-08T10:00:00.000Z",
      description: "Lunch",
      amount: 50,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };
    const next = {
      ...previous,
      description: "Dinner",
      amount: 80,
    };

    await applyLocalTransactionToMonthlySummaries({
      spaceCode: "space-a",
      date: previous.date,
      amount: previous.amount,
      type: "expense",
      mode: "add",
      currency: "PHP",
    });

    const { upsertLocalIndexTransaction } = await import(
      "@/services/transactions/local-cache"
    );
    await upsertLocalIndexTransaction("space-a", previous);

    queryClient.setQueryData(listQueryKey, {
      pages: [
        {
          transactions: [previous],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 50, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    const summaries = await loadCachedMonthlyFinancialSummaries("space-a");
    if (summaries) {
      setMonthlyFinancialSummariesQueryData(queryClient, "space-a", summaries);
    }

    await applyRealtimeTransactionUpdated({
      spaceId: "space-a",
      client: queryClient,
      row: next,
      targetSpace: "space-a",
    });

    const cached = queryClient.getQueryData<{
      pages: Array<{
        transactions: Array<{ id: string; description: string; amount: number }>;
        totals: { expense: number };
      }>;
    }>(listQueryKey);

    expect(cached?.pages[0]?.transactions[0]).toMatchObject({
      id: "tx-1",
      description: "Dinner",
      amount: 80,
    });
    expect(cached?.pages[0]?.totals.expense).toBe(80);

    const local = await loadLocalIndexTransactionById("space-a", "tx-1");
    expect(local?.description).toBe("Dinner");
    expect(local?.amount).toBe(80);

    const nextSummaries = await loadCachedMonthlyFinancialSummaries("space-a");
    const august = nextSummaries?.find((row) => row.year === 2026 && row.month === 8);
    expect(august?.totalExpenses).toBe(80);
  });
});
