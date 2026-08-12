import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  getLocalDb,
  OUTBOX_COMMAND_TRANSACTION_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import {
  cacheMonthlyFinancialSummaries,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  updateTransaction: vi.fn(),
}));

import { updateTransaction } from "./mutation";
import {
  buildUpdatedIndexTransaction,
  updateTransactionLocalFirst,
} from "./update-local-first";

const seedIncome = async () => {
  await upsertLocalIndexTransaction("space-a", {
    id: "tx-income-1",
    date: "2026-08-11",
    description: "Loan repayment Cash",
    amount: 164.15,
    amountCurrency: "PHP",
    categoryName: "Freelance",
    fromAccountName: "",
    toAccountName: "Cash",
    type: CombinedTransactionTypeEnum.INCOME,
    inSeries: false,
    hasImage: false,
    tagIds: ["tag-japan"],
    tags: [{ id: "tag-japan", name: "Japan 2026", color: "#f472b6" }],
  });

  await cacheMonthlyFinancialSummaries("space-a", [
    {
      id: "sum-2026-08",
      year: 2026,
      month: 8,
      currency: "PHP",
      fxBased: false,
      calculatedAt: new Date().toISOString(),
      totalIncome: 24900,
      totalExpenses: 229000,
      netSavings: 24900 - 229000,
      savingsPercentage: -800,
      monthStartDate: "2026-08-01",
      monthEndDate: "2026-08-31",
    },
  ]);
};

describe("buildUpdatedIndexTransaction", () => {
  it("preserves tags and updates amount/type", () => {
    const previous = {
      id: "tx-1",
      date: "2026-08-11",
      description: "Old",
      amount: 164.15,
      amountCurrency: "PHP",
      categoryName: "Freelance",
      fromAccountName: "",
      toAccountName: "Cash",
      type: CombinedTransactionTypeEnum.INCOME,
      inSeries: false,
      hasImage: false,
      tagIds: ["tag-japan"],
      tags: [{ id: "tag-japan", name: "Japan 2026", color: "#f472b6" }],
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "tx-1",
        amount: 10_000_000,
        description: "Loan repayment Cash",
        transactionType: "income",
        categoryName: "Freelance",
        accountName: "Cash",
        date: "2026-08-11",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        tagIds: ["tag-japan"],
        tags: [{ id: "tag-japan", name: "Japan 2026", color: "#f472b6" }],
      },
      amountCurrency: "PHP",
    });

    expect(next.amount).toBe(10_000_000);
    expect(next.type).toBe(CombinedTransactionTypeEnum.INCOME);
    expect(next.tagIds).toEqual(["tag-japan"]);
    expect(next.tags?.[0]?.name).toBe("Japan 2026");
  });

  it("refreshes bookedAmount so offline dashboard totals use the edited value", () => {
    const previous = {
      id: "tx-1",
      date: "2026-08-11",
      description: "Loan repayment Cash",
      amount: 10_000_000,
      amountCurrency: "PHP",
      bookedAmount: 10_000_000,
      bookedAmountCurrency: "PHP",
      categoryName: "Freelance",
      fromAccountName: "",
      toAccountName: "Cash",
      type: CombinedTransactionTypeEnum.INCOME,
      inSeries: false,
      hasImage: false,
      currencyConversion: {
        originalAmount: 10_000_000,
        originalCurrency: "PHP",
        convertedAmount: 10_000_000,
        convertedCurrency: "PHP",
        exchangeRate: 1,
        source: "manual",
      },
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "tx-1",
        amount: 1,
        description: "Loan repayment Cash",
        transactionType: "income",
        categoryName: "Freelance",
        accountName: "Cash",
        date: "2026-08-11",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
      amountCurrency: "PHP",
    });

    expect(next.amount).toBe(1);
    expect(next.bookedAmount).toBe(1);
    expect(next.bookedAmountCurrency).toBe("PHP");
    expect(next.currencyConversion?.originalAmount).toBe(1);
    expect(next.currencyConversion?.convertedAmount).toBe(1);
  });

  it("recomputes converted amount and exchange rate when FX rate changes on edit", () => {
    const previous = {
      id: "tx-gbp",
      date: "2026-08-12",
      description: "EXTEST1",
      amount: 20_000,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      categoryName: "Medicine",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
      currencyConversion: {
        originalAmount: 200,
        originalCurrency: "GBP",
        convertedAmount: 20_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "tx-gbp",
        amount: 200,
        description: "EXTEST1",
        transactionType: "expense",
        categoryName: "Medicine",
        accountName: "SAMPLE BDO LONG ASS NAME",
        date: "2026-08-12",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        original_currency: "GBP",
        exchange_rate: 1000,
        exchange_rate_source: "manual",
      } as UpdateTransactionType & {
        original_currency: string;
        exchange_rate: number;
        exchange_rate_source: "manual";
      },
      amountCurrency: "PHP",
    });

    expect(next.amount).toBe(200_000);
    expect(next.bookedAmount).toBe(200);
    expect(next.bookedAmountCurrency).toBe("GBP");
    expect(next.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 200_000,
      convertedCurrency: "PHP",
      exchangeRate: 1000,
      source: "manual",
    });
  });
});

describe("updateTransactionLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("patches IndexedDB and monthly summaries when the server succeeds", async () => {
    await seedIncome();
    vi.mocked(updateTransaction).mockResolvedValue({ success: true });

    const queryClient = new QueryClient();
    const result = await updateTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        previous: (await loadLocalIndexTransactionById(
          "space-a",
          "tx-income-1",
        ))!,
        amountCurrency: "PHP",
        data: {
          id: "tx-income-1",
          amount: 10_000_000,
          description: "Loan repayment Cash",
          transactionType: "income",
          categoryName: "Freelance",
          accountName: "Cash",
          date: "2026-08-11",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          tagIds: ["tag-japan"],
        },
      },
      { queryClient, waitForSync: true },
    );

    expect(result.pendingSync).toBe(false);
    expect(result.localTransaction.amount).toBe(10_000_000);

    const stored = await loadLocalIndexTransactionById("space-a", "tx-income-1");
    expect(stored?.amount).toBe(10_000_000);

    const summaries = await loadCachedMonthlyFinancialSummaries("space-a");
    const august = summaries?.find((row) => row.year === 2026 && row.month === 8);
    expect(august?.totalIncome).toBeCloseTo(24900 - 164.15 + 10_000_000);

    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("keeps local amount and a pending outbox when the network fails", async () => {
    await seedIncome();
    vi.mocked(updateTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );

    const result = await updateTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        amountCurrency: "PHP",
        data: {
          id: "tx-income-1",
          amount: 10_000_000,
          description: "Loan repayment Cash",
          transactionType: "income",
          categoryName: "Freelance",
          accountName: "Cash",
          date: "2026-08-11",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);

    const stored = await loadLocalIndexTransactionById("space-a", "tx-income-1");
    expect(stored?.amount).toBe(10_000_000);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_TRANSACTION_UPDATE);
    expect(outbox[0]?.status).toBe("pending");
  });

  it("rolls back local rows when the server rejects the update", async () => {
    await seedIncome();
    vi.mocked(updateTransaction).mockRejectedValue({
      success: false,
      details: { amount: ["is invalid"] },
    });

    await expect(
      updateTransactionLocalFirst(
        {} as never,
        {
          spaceId: "space-a",
          amountCurrency: "PHP",
          data: {
            id: "tx-income-1",
            amount: 10_000_000,
            description: "Loan repayment Cash",
            transactionType: "income",
            categoryName: "Freelance",
            accountName: "Cash",
            date: "2026-08-11",
            scheduleType: ScheduleTypeEnum.ONE_TIME,
          },
        },
        { waitForSync: true },
      ),
    ).rejects.toMatchObject({ success: false });

    const stored = await loadLocalIndexTransactionById("space-a", "tx-income-1");
    expect(stored?.amount).toBe(164.15);

    const summaries = await loadCachedMonthlyFinancialSummaries("space-a");
    const august = summaries?.find((row) => row.year === 2026 && row.month === 8);
    expect(august?.totalIncome).toBeCloseTo(24900);

    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});
