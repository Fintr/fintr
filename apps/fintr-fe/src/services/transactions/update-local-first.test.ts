import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
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

  it("raises installment plan total when this payment only changes", () => {
    const previous = {
      id: "install5-nov",
      date: "2027-11-01",
      description: "INSTALL5",
      amount: 10000,
      amountCurrency: "PHP",
      categoryName: "Home",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240000,
      parentId: "install5-root",
      rootParentId: "install5-root",
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "install5-nov",
        amount: 20000,
        description: "INSTALL5",
        transactionType: "expense",
        categoryName: "Home",
        accountName: "Cash",
        date: "2027-11-01",
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
        installmentPeriod: 24,
        installmentTotal: 240000,
        updateScope: UpdateScopeEnum.THIS_ONLY,
      },
      amountCurrency: "PHP",
    });

    expect(next.amount).toBe(20000);
    expect(next.installmentTotal).toBe(250000);
  });

  it("stores converted PHP and GBP booked legs for a this-only FX installment bump", () => {
    const previous = {
      id: "install8-nov",
      date: "2027-11-01",
      description: "INSTALL8",
      amount: 10_000,
      amountCurrency: "PHP",
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      parentId: "install8-root",
      rootParentId: "install8-root",
      currencyConversion: {
        originalAmount: 100,
        originalCurrency: "GBP",
        convertedAmount: 10_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "install8-nov",
        amount: 200,
        description: "INSTALL8",
        transactionType: "expense",
        categoryName: "Home",
        accountName: "SAMPLE BDO LONG ASS NAME",
        date: "2027-11-01",
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
        installmentPeriod: 24,
        installmentTotal: 2500,
        updateScope: UpdateScopeEnum.THIS_ONLY,
        original_currency: "GBP",
        exchange_rate: 100,
        exchange_rate_source: "manual",
      } as UpdateTransactionType & {
        original_currency: string;
        exchange_rate: number;
        exchange_rate_source: "manual";
      },
      amountCurrency: "PHP",
    });

    expect(next.amount).toBe(20_000);
    expect(next.bookedAmount).toBe(200);
    expect(next.bookedAmountCurrency).toBe("GBP");
    expect(next.installmentTotal).toBe(250_000);
    expect(next.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
      source: "manual",
    });
  });

  it("stores 250000 PHP plan total when prior index amount leaked GBP magnitudes", () => {
    const previous = {
      id: "install8-jun",
      date: "2028-06-22",
      description: "INSTALL8",
      amount: 100,
      amountCurrency: "PHP",
      bookedAmount: 100,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
      scheduleType: ScheduleTypeEnum.INSTALLMENT,
      installmentPeriod: 24,
      installmentTotal: 240_000,
      parentId: "install8-root",
      rootParentId: "install8-root",
      currencyConversion: {
        originalAmount: 100,
        originalCurrency: "GBP",
        convertedAmount: 100,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "install8-jun",
        amount: 200,
        description: "INSTALL8",
        transactionType: "expense",
        categoryName: "Home",
        accountName: "SAMPLE BDO LONG ASS NAME",
        date: "2028-06-22",
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
        installmentPeriod: 24,
        installmentTotal: 2500,
        updateScope: UpdateScopeEnum.THIS_ONLY,
        original_currency: "GBP",
        exchange_rate: 100,
        exchange_rate_source: "manual",
      } as UpdateTransactionType & {
        original_currency: string;
        exchange_rate: number;
        exchange_rate_source: "manual";
      },
      amountCurrency: "PHP",
    });

    expect(next.amount).toBe(20_000);
    expect(next.installmentTotal).toBe(250_000);
  });

  it("stamps account and merchant ids onto the updated local row", () => {
    const previous = {
      id: "tx-1",
      date: "2026-08-11",
      description: "Old",
      amount: 20,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
      accountId: "acc-cash",
      fromAccountId: "acc-cash",
      entityId: "ent-old",
      entityName: "Old merchant",
    };

    const next = buildUpdatedIndexTransaction({
      previous,
      data: {
        id: "tx-1",
        amount: 20,
        description: "Lunch",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Bank",
        accountId: "acc-bank",
        entityName: "Jollibee",
        entityId: "ent-jollibee",
        date: "2026-08-11",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
      amountCurrency: "PHP",
    });

    expect(next.accountId).toBe("acc-bank");
    expect(next.fromAccountId).toBe("acc-bank");
    expect(next.entityId).toBe("ent-jollibee");
    expect(next.entityName).toBe("Jollibee");
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

  it("stores a new receipt in IndexedDB and keeps File out of the outbox", async () => {
    await seedIncome();
    vi.mocked(updateTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );

    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

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
          file,
        },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.localTransaction.hasImage).toBe(true);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.payload).not.toHaveProperty("file");
    expect(outbox[0]?.payload).toEqual(
      expect.objectContaining({
        attachmentLocalKeys: expect.arrayContaining([expect.any(String)]),
      }),
    );

    const stored = await getLocalDb().attachments.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.filename).toBe("receipt.jpg");
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

  it("invalidates the recurring series query so the installment detail page refreshes", async () => {
    await seedIncome();
    vi.mocked(updateTransaction).mockResolvedValue({ success: true });

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await updateTransactionLocalFirst(
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
          amount: 500,
          description: "Loan repayment Cash",
          transactionType: "income",
          categoryName: "Freelance",
          accountName: "Cash",
          date: "2026-08-11",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
      },
      { queryClient, waitForSync: false },
    );

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["recurringSeries", "space-a"],
        refetchType: "active",
      }),
    );
  });

  it("rewrites the opened GBP balloon to PHP 12500 on apply-all", async () => {
    const rootId = "install9-root";
    const rows = Array.from({ length: 24 }, (_, index) => {
      const date = new Date(Date.UTC(2026, index, 1));
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const isLast = index === 23;

      return {
        id: index === 0 ? rootId : `install9-${index}`,
        date: dateKey,
        seriesParentDate: "2026-01-01",
        description: "INSTALL9",
        amount: isLast ? 300 : 10_000,
        amountCurrency: isLast ? "GBP" : "PHP",
        bookedAmount: isLast ? 300 : 100,
        bookedAmountCurrency: "GBP",
        categoryName: "Home",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: true,
        hasImage: false,
        calculated: false,
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
        installmentPeriod: 24,
        installmentTotal: 260_000,
        parentId: index === 0 ? undefined : rootId,
        rootParentId: rootId,
        currencyConversion: {
          originalAmount: isLast ? 300 : 100,
          originalCurrency: "GBP",
          convertedAmount: isLast ? 300 : 10_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "manual",
        },
      };
    });

    for (const row of rows) {
      await upsertLocalIndexTransaction("space-a", row);
    }

    const balloon = rows[23]!;
    await upsertLocalIndexTransaction("space-a", {
      ...balloon,
      id: "install9-dec-php-twin",
      amount: 30_000,
      amountCurrency: "PHP",
      bookedAmount: 300,
      bookedAmountCurrency: "GBP",
      currencyConversion: {
        originalAmount: 300,
        originalCurrency: "GBP",
        convertedAmount: 30_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    });

    vi.mocked(updateTransaction).mockResolvedValue({ success: true });

    const result = await updateTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        previous: balloon,
        amountCurrency: "GBP",
        data: {
          id: balloon.id,
          amount: 300,
          description: "INSTALL9",
          transactionType: "expense",
          categoryName: "Home",
          accountName: "Cash",
          date: balloon.date,
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
      { waitForSync: false },
    );

    expect(result.localTransaction.amount).toBe(12_500);
    expect(result.localTransaction.bookedAmount).toBe(125);
    expect(result.localTransaction.amountCurrency).toBe("PHP");

    const stored = await loadLocalIndexTransactionById("space-a", balloon.id);
    expect(stored?.amount).toBe(12_500);
    expect(stored?.bookedAmount).toBe(125);
    expect(stored?.amountCurrency).toBe("PHP");
  });

  it("sends all-in-series when apply-all is used after payments are recorded", async () => {
    const rootId = "install9-root";
    const rows = Array.from({ length: 24 }, (_, index) => {
      const date = new Date(Date.UTC(2026, index, 1));
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;

      return {
        id: index === 0 ? rootId : `install9-${index}`,
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
        installmentTotal: 260_000,
        parentId: index === 0 ? undefined : rootId,
        rootParentId: rootId,
      };
    });

    for (const row of rows) {
      await upsertLocalIndexTransaction("space-a", row);
    }

    vi.mocked(updateTransaction).mockResolvedValue({ success: true });

    await updateTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        previous: rows[23]!,
        amountCurrency: "GBP",
        data: {
          id: rows[23]!.id,
          amount: 300,
          description: "INSTALL9",
          transactionType: "expense",
          categoryName: "Home",
          accountName: "Cash",
          date: rows[23]!.date,
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
      { waitForSync: true },
    );

    expect(updateTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        updateScope: UpdateScopeEnum.ALL_IN_SERIES,
      }),
    );
  });

  it("restores every series row when the server rejects an installment revision", async () => {
    const rootId = "install9-root";
    const rows = Array.from({ length: 24 }, (_, index) => {
      const date = new Date(Date.UTC(2026, index, 1));
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const isLast = index === 23;

      return {
        id: index === 0 ? rootId : `install9-${index}`,
        date: dateKey,
        seriesParentDate: "2026-01-01",
        description: "INSTALL9",
        amount: isLast ? 300 : 10_000,
        amountCurrency: isLast ? "GBP" : "PHP",
        bookedAmount: isLast ? 300 : 100,
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
        installmentTotal: 260_000,
        parentId: index === 0 ? undefined : rootId,
        rootParentId: rootId,
      };
    });

    for (const row of rows) {
      await upsertLocalIndexTransaction("space-a", row);
    }

    vi.mocked(updateTransaction).mockRejectedValue({
      success: false,
      details: {
        installment_total: "could not be resolved",
      },
    });

    await expect(
      updateTransactionLocalFirst(
        {} as never,
        {
          spaceId: "space-a",
          previous: rows[9]!,
          amountCurrency: "GBP",
          data: {
            id: rows[9]!.id,
            amount: 100,
            description: "INSTALL9",
            transactionType: "expense",
            categoryName: "Home",
            accountName: "Cash",
            date: rows[9]!.date,
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
        { waitForSync: true },
      ),
    ).rejects.toMatchObject({ success: false });

    const january = await loadLocalIndexTransactionById("space-a", "install9-12");
    expect(january?.amount).toBe(10_000);
    expect(january?.amountCurrency).toBe("PHP");

    const balloon = await loadLocalIndexTransactionById("space-a", rows[23]!.id);
    expect(balloon?.amount).toBe(300);
    expect(balloon?.amountCurrency).toBe("GBP");
  });
});
