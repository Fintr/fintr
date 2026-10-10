import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { resetLocalDbForTests } from "@/lib/local-db";
import {
  cacheMonthlyFinancialSummaries,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("@/services/transactions/mutation", () => ({
  deleteTransaction: vi.fn().mockResolvedValue({ success: true }),
}));

import { deleteTransactionLocalFirst } from "@/services/transactions/delete-local-first";

import { applyTransactionDeleted } from "./apply-transaction-change";

const spaceId = "SPACE_DELETE_ECHO";

type Row = {
  id: string;
  amount: number;
  type: CombinedTransactionTypeEnum;
};

const indexRow = (row: Row) => ({
  id: row.id,
  date: "2026-10-10",
  description: row.id,
  amount: row.amount,
  amountCurrency: "PHP",
  bookedAmount: row.amount,
  bookedAmountCurrency: "PHP",
  categoryName: "Food",
  fromAccountName:
    row.type === CombinedTransactionTypeEnum.EXPENSE ? "Cash" : "",
  toAccountName:
    row.type === CombinedTransactionTypeEnum.INCOME ? "Cash" : "",
  type: row.type,
  inSeries: false,
  hasImage: false,
});

const seed = async (params: {
  rows: Row[];
  totalIncome: number;
  totalExpenses: number;
}) => {
  for (const row of params.rows) {
    await upsertLocalIndexTransaction(spaceId, indexRow(row));
  }

  await cacheMonthlyFinancialSummaries(spaceId, [
    {
      id: "sum-2026-10",
      year: 2026,
      month: 10,
      currency: "PHP",
      fxBased: true,
      calculatedAt: "2026-10-10T00:00:00.000Z",
      totalIncome: params.totalIncome,
      totalExpenses: params.totalExpenses,
      netSavings: params.totalIncome - params.totalExpenses,
      savingsPercentage: 0,
      monthStartDate: "2026-10-01",
      monthEndDate: "2026-10-31",
    },
  ]);
};

const deletedEcho = (row: Row) => ({
  seq: 0,
  op: "transaction.deleted" as const,
  occurredAt: "2026-10-10T10:00:00.000Z",
  payload: { transactions: [indexRow(row)] },
});

const octoberTotals = async () => {
  const summaries = (await loadCachedMonthlyFinancialSummaries(spaceId)) ?? [];
  const october = summaries.find(
    (summary) => summary.year === 2026 && summary.month === 10,
  );

  return {
    totalIncome: Number(october?.totalIncome ?? 0),
    totalExpenses: Number(october?.totalExpenses ?? 0),
    netSavings: Number(october?.netSavings ?? 0),
  };
};

const deleteLocallyThenReceiveEcho = async (row: Row) => {
  const queryClient = new QueryClient();

  await deleteTransactionLocalFirst(
    {} as never,
    {
      spaceId,
      transactionId: row.id,
      deleteScope: DeleteScopeEnum.THIS_ONLY,
    },
    { queryClient },
  );

  await applyTransactionDeleted({
    spaceId,
    queryClient,
    change: deletedEcho(row),
  });
};

describe("applyTransactionDeleted — monthly summary", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("returns to zero after deleting the only negative expense", async () => {
    const negativeExpense = {
      id: "neg-expense",
      amount: -40,
      type: CombinedTransactionTypeEnum.EXPENSE,
    };
    await seed({
      rows: [negativeExpense],
      totalIncome: 0,
      totalExpenses: -40,
    });

    await deleteLocallyThenReceiveEcho(negativeExpense);

    expect(await octoberTotals()).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
    });
  });

  it("returns to zero after deleting the only positive expense", async () => {
    const expense = {
      id: "pos-expense",
      amount: 40,
      type: CombinedTransactionTypeEnum.EXPENSE,
    };
    await seed({
      rows: [expense],
      totalIncome: 0,
      totalExpenses: 40,
    });

    await deleteLocallyThenReceiveEcho(expense);

    expect(await octoberTotals()).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
    });
  });

  it("returns to zero after deleting the only negative income", async () => {
    const negativeIncome = {
      id: "neg-income",
      amount: -40,
      type: CombinedTransactionTypeEnum.INCOME,
    };
    await seed({
      rows: [negativeIncome],
      totalIncome: -40,
      totalExpenses: 0,
    });

    await deleteLocallyThenReceiveEcho(negativeIncome);

    expect(await octoberTotals()).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netSavings: 0,
    });
  });

  it("keeps other transactions intact when a negative expense is deleted", async () => {
    const negativeExpense = {
      id: "neg-expense",
      amount: -40,
      type: CombinedTransactionTypeEnum.EXPENSE,
    };
    await seed({
      rows: [
        negativeExpense,
        {
          id: "salary",
          amount: 500,
          type: CombinedTransactionTypeEnum.INCOME,
        },
        {
          id: "groceries",
          amount: 100,
          type: CombinedTransactionTypeEnum.EXPENSE,
        },
      ],
      totalIncome: 500,
      totalExpenses: 60,
    });

    await deleteLocallyThenReceiveEcho(negativeExpense);

    expect(await octoberTotals()).toEqual({
      totalIncome: 500,
      totalExpenses: 100,
      netSavings: 400,
    });
  });

  it("applies a delete from another device exactly once", async () => {
    const negativeExpense = {
      id: "neg-expense",
      amount: -40,
      type: CombinedTransactionTypeEnum.EXPENSE,
    };
    await seed({
      rows: [
        negativeExpense,
        {
          id: "groceries",
          amount: 100,
          type: CombinedTransactionTypeEnum.EXPENSE,
        },
      ],
      totalIncome: 0,
      totalExpenses: 60,
    });
    const queryClient = new QueryClient();

    await applyTransactionDeleted({
      spaceId,
      queryClient,
      change: deletedEcho(negativeExpense),
    });
    await applyTransactionDeleted({
      spaceId,
      queryClient,
      change: deletedEcho(negativeExpense),
    });

    expect(await octoberTotals()).toEqual({
      totalIncome: 0,
      totalExpenses: 100,
      netSavings: -100,
    });
  });
});
