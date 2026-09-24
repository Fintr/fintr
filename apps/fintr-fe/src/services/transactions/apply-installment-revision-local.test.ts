import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
import type { IndexTransaction } from "@/types/transactionTypes";

const {
  seriesRows,
  upsertLocalIndexTransaction,
  removeLocalIndexTransactionsByIds,
  removeIndexTransactionsFromQueryCaches,
} = vi.hoisted(() => {
  const rootId = "install8-root";
  const rows = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7 + index, 22));
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-22`;
    const isJune = dateKey === "2028-06-22";
    const amount = isJune ? 30_000 : 10_000;
    const bookedAmount = isJune ? 300 : 100;

    return {
      id: index === 0 ? rootId : `install8-${index}`,
      date: dateKey,
      seriesParentDate: "2026-08-22",
      description: "INSTALL8",
      amount,
      amountCurrency: "PHP",
      bookedAmount,
      bookedAmountCurrency: "GBP",
      categoryName: "Home",
      fromAccountName: "SAMPLE BDO LONG ASS NAME",
      toAccountName: "",
      type: "expense",
      inSeries: true,
      hasImage: false,
      scheduleType: "installment",
      installmentPeriod: 24,
      installmentTotal: 260_000,
      parentId: index === 0 ? undefined : rootId,
      rootParentId: rootId,
      currencyConversion: {
        originalAmount: bookedAmount,
        originalCurrency: "GBP",
        convertedAmount: amount,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    };
  });

  return {
    seriesRows: rows,
    upsertLocalIndexTransaction: vi.fn(async () => undefined),
    removeLocalIndexTransactionsByIds: vi.fn(async () => []),
    removeIndexTransactionsFromQueryCaches: vi.fn(),
  };
});

vi.mock("./local-cache", () => ({
  loadAllTransactionsFromLocalIndex: vi.fn(async () => seriesRows),
  upsertLocalIndexTransaction,
  removeLocalIndexTransactionsByIds,
}));

import { loadAllTransactionsFromLocalIndex } from "./local-cache";

vi.mock("./remove-from-query-caches", () => ({
  removeIndexTransactionsFromQueryCaches,
}));

import {
  applyInstallmentPlanRevisionLocal,
  computeLocalInstallmentPlanRevision,
} from "./apply-installment-revision-local";

describe("computeLocalInstallmentPlanRevision", () => {
  it("sets the last 3 payments to 200 GBP after revising from the 3rd-to-last payment", () => {
    const mayRow = seriesRows.find((row) => row.date === "2028-05-22")!;

    const revision = computeLocalInstallmentPlanRevision({
      target: mayRow as IndexTransaction,
      seriesRows,
      data: {
        id: mayRow.id,
        installmentPeriod: 24,
        installmentTotal: 2700,
        updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
        installmentRevisionAnchor: "explicit",
        original_currency: "GBP",
        exchange_rate: 100,
      },
      spaceCurrency: "PHP",
    });

    expect(revision?.remainingCount).toBe(3);
    expect(revision?.perPayment).toBe(20_000);
  });

  it("uses the stored GBP→PHP rate when apply-all omits exchange_rate", () => {
    const root = seriesRows[0] as IndexTransaction;

    const revision = computeLocalInstallmentPlanRevision({
      target: root,
      seriesRows,
      data: {
        id: root.id,
        installmentPeriod: 24,
        installmentTotal: 3000,
        updateScope: UpdateScopeEnum.ALL_IN_SERIES,
        installmentRevisionAnchor: "explicit",
        original_currency: "GBP",
      },
      spaceCurrency: "PHP",
    });

    expect(revision?.remainingCount).toBe(24);
    expect(revision?.installmentTotalCents).toBe(30_000_000);
    expect(revision?.perPayment).toBe(12_500);
  });
});

describe("applyInstallmentPlanRevisionLocal", () => {
  beforeEach(() => {
    upsertLocalIndexTransaction.mockClear();
    removeLocalIndexTransactionsByIds.mockClear();
    removeIndexTransactionsFromQueryCaches.mockClear();
  });

  it("updates May through July to 200 GBP after a this-and-future revision to 2700", async () => {
    const mayRow = seriesRows.find((row) => row.date === "2028-05-22")!;

    const updatedRows = await applyInstallmentPlanRevisionLocal({
      spaceId: "space-a",
      target: mayRow as IndexTransaction,
      data: {
        id: mayRow.id,
        installmentPeriod: 24,
        installmentTotal: 2700,
        updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
        installmentRevisionAnchor: "explicit",
        original_currency: "GBP",
        exchange_rate: 100,
        exchange_rate_source: "manual",
      },
      spaceCurrency: "PHP",
    });

    for (const date of ["2028-05-22", "2028-06-22", "2028-07-22"]) {
      const row = updatedRows.find((entry) => entry.date === date);
      expect(row?.amount).toBe(20_000);
      expect(row?.bookedAmount).toBe(200);
      expect(row?.installmentTotal).toBe(270_000);
    }

    const aprilRow = updatedRows.find((entry) => entry.date === "2028-04-22");
    expect(aprilRow?.amount).toBe(10_000);
    expect(aprilRow?.installmentTotal).toBe(270_000);
  });

  it("rewrites a leftover 2nd-to-last row parented to the edited payment", async () => {
    const mayRow = seriesRows.find((row) => row.date === "2028-05-22")!;
    const juneRow = seriesRows.find((row) => row.date === "2028-06-22")!;
    const originalJune = { ...juneRow };
    Object.assign(juneRow, {
      parentId: mayRow.id,
      rootParentId: mayRow.id,
      amount: -691,
      amountCurrency: "GBP",
      bookedAmount: -691,
      bookedAmountCurrency: "GBP",
    });

    try {
      const updatedRows = await applyInstallmentPlanRevisionLocal({
        spaceId: "space-a",
        target: mayRow as IndexTransaction,
        data: {
          id: mayRow.id,
          installmentPeriod: 24,
          installmentTotal: 2700,
          updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        spaceCurrency: "PHP",
      });

      const updatedJune = updatedRows.find((entry) => entry.date === "2028-06-22");
      expect(updatedJune?.amount).toBe(20_000);
      expect(updatedJune?.bookedAmount).toBe(200);
      expect(updatedJune?.amountCurrency).toBe("PHP");
    } finally {
      Object.assign(juneRow, originalJune);
    }
  });

  it("rewrites a leftover last payment parented to the leftover 2nd-to-last payment", async () => {
    const mayRow = seriesRows.find((row) => row.date === "2028-05-22")!;
    const juneRow = seriesRows.find((row) => row.date === "2028-06-22")!;
    const julyRow = seriesRows.find((row) => row.date === "2028-07-22")!;
    const originalJune = { ...juneRow };
    const originalJuly = { ...julyRow };
    Object.assign(juneRow, {
      parentId: mayRow.id,
      rootParentId: mayRow.id,
      amount: -691,
      amountCurrency: "GBP",
      bookedAmount: -691,
      bookedAmountCurrency: "GBP",
    });
    Object.assign(julyRow, {
      parentId: juneRow.id,
      rootParentId: juneRow.id,
      amount: -691,
      amountCurrency: "GBP",
      bookedAmount: -691,
      bookedAmountCurrency: "GBP",
    });

    try {
      const updatedRows = await applyInstallmentPlanRevisionLocal({
        spaceId: "space-a",
        target: mayRow as IndexTransaction,
        data: {
          id: mayRow.id,
          installmentPeriod: 24,
          installmentTotal: 2700,
          updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        spaceCurrency: "PHP",
      });

      const updatedJuly = updatedRows.find((entry) => entry.date === "2028-07-22");
      expect(updatedJuly?.amount).toBe(20_000);
      expect(updatedJuly?.bookedAmount).toBe(200);
      expect(updatedJuly?.amountCurrency).toBe("PHP");
    } finally {
      Object.assign(juneRow, originalJune);
      Object.assign(julyRow, originalJuly);
    }
  });

  it("deletes a leftover FX row when a rewritten payment already exists on that date", async () => {
    const mayRow = seriesRows.find((row) => row.date === "2028-05-22")!;
    const leftoverJune = {
      ...seriesRows.find((row) => row.date === "2028-06-22")!,
      id: "install8-june-leftover",
      parentId: mayRow.id,
      rootParentId: mayRow.id,
      amount: -691,
      amountCurrency: "GBP",
      bookedAmount: -691,
      bookedAmountCurrency: "GBP",
    };
    seriesRows.push(leftoverJune);

    try {
      const queryClient = new QueryClient();
      await applyInstallmentPlanRevisionLocal({
        spaceId: "space-a",
        target: mayRow as IndexTransaction,
        data: {
          id: mayRow.id,
          installmentPeriod: 24,
          installmentTotal: 2700,
          updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        spaceCurrency: "PHP",
        queryClient,
      });

      expect(removeLocalIndexTransactionsByIds).toHaveBeenCalledWith(
        "space-a",
        expect.arrayContaining(["install8-june-leftover"]),
      );
      expect(removeIndexTransactionsFromQueryCaches).toHaveBeenCalledWith(
        queryClient,
        expect.objectContaining({
          spaceId: "space-a",
          removedIds: expect.arrayContaining(["install8-june-leftover"]),
        }),
      );
    } finally {
      const leftoverIndex = seriesRows.findIndex(
        (row) => row.id === "install8-june-leftover",
      );
      if (leftoverIndex >= 0) {
        seriesRows.splice(leftoverIndex, 1);
      }
    }
  });

  it("rewrites the leftover GBP balloon that was opened for apply-all, not the PHP twin", async () => {
    const juneRow = seriesRows.find((row) => row.date === "2028-06-22")!;
    const originalJune = { ...juneRow };
    Object.assign(juneRow, {
      amount: 300,
      amountCurrency: "GBP",
      bookedAmount: 300,
      bookedAmountCurrency: "GBP",
    });
    const phpTwin = {
      ...originalJune,
      id: "install8-june-php-twin",
    };
    seriesRows.push(phpTwin);

    try {
      const updatedRows = await applyInstallmentPlanRevisionLocal({
        spaceId: "space-a",
        target: juneRow as IndexTransaction,
        data: {
          id: juneRow.id,
          installmentPeriod: 24,
          installmentTotal: 3000,
          updateScope: UpdateScopeEnum.ALL_IN_SERIES,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        spaceCurrency: "GBP",
      });

      const updatedJune = updatedRows.find((row) => row.id === juneRow.id);
      expect(updatedJune?.amount).toBe(12_500);
      expect(updatedJune?.bookedAmount).toBe(125);
      expect(updatedJune?.amountCurrency).toBe("PHP");
      expect(updatedRows.some((row) => row.id === phpTwin.id)).toBe(false);
      expect(removeLocalIndexTransactionsByIds).toHaveBeenCalledWith(
        "space-a",
        expect.arrayContaining([phpTwin.id]),
      );
    } finally {
      Object.assign(juneRow, originalJune);
      const twinIndex = seriesRows.findIndex((row) => row.id === phpTwin.id);
      if (twinIndex >= 0) {
        seriesRows.splice(twinIndex, 1);
      }
    }
  });

  it("spreads GBP 3000 across every payment on apply-all using stored FX", async () => {
    const root = seriesRows[0] as IndexTransaction;

    const updatedRows = await applyInstallmentPlanRevisionLocal({
      spaceId: "space-a",
      target: root,
      data: {
        id: root.id,
        installmentPeriod: 24,
        installmentTotal: 3000,
        updateScope: UpdateScopeEnum.ALL_IN_SERIES,
        installmentRevisionAnchor: "explicit",
        original_currency: "GBP",
        exchange_rate_source: "manual",
      },
      spaceCurrency: "PHP",
    });

    expect(updatedRows).toHaveLength(24);
    for (const row of updatedRows) {
      expect(row.amount).toBe(12_500);
      expect(row.bookedAmount).toBe(125);
      expect(row.amountCurrency).toBe("PHP");
      expect(row.installmentTotal).toBe(300_000);
    }

    const lastBalloon = updatedRows.find((row) => row.date === "2028-06-22");
    expect(lastBalloon?.bookedAmount).toBe(125);
    expect(lastBalloon?.amount).not.toBe(30_000);
  });

  it("keeps PHP ledger math when apply-all is called with leftover GBP amountCurrency", async () => {
    const originals = seriesRows.map((row) => ({ ...row }));
    seriesRows.forEach((row) => {
      Object.assign(row, {
        amount: row.date === "2028-06-22" ? 300 : 100,
        amountCurrency: "GBP",
        bookedAmount: row.date === "2028-06-22" ? 300 : 100,
        bookedAmountCurrency: "GBP",
      });
    });

    try {
      const root = seriesRows[0] as IndexTransaction;
      const updatedRows = await applyInstallmentPlanRevisionLocal({
        spaceId: "space-a",
        target: root,
        data: {
          id: root.id,
          installmentPeriod: 24,
          installmentTotal: 3000,
          updateScope: UpdateScopeEnum.ALL_IN_SERIES,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        spaceCurrency: "GBP",
      });

      for (const row of updatedRows) {
        expect(row.amount).toBe(12_500);
        expect(row.bookedAmount).toBe(125);
        expect(row.amountCurrency).toBe("PHP");
        expect(row.amount).not.toBe(1.25);
      }
    } finally {
      seriesRows.forEach((row, index) => {
        Object.assign(row, originals[index]);
      });
    }
  });

  it("rewrites leftover FX legs to the submitted rate on apply-all", async () => {
    const originals = seriesRows.map((row) => ({
      ...row,
      currencyConversion: row.currencyConversion
        ? { ...row.currencyConversion }
        : undefined,
    }));
    seriesRows.forEach((row) => {
      Object.assign(row, {
        currencyConversion: {
          originalAmount: 64,
          originalCurrency: "GBP",
          convertedAmount: 12_500,
          convertedCurrency: "PHP",
          exchangeRate: 195.313,
          source: "manual",
        },
      });
    });

    try {
      const root = seriesRows[0] as IndexTransaction;
      const updatedRows = await applyInstallmentPlanRevisionLocal({
        spaceId: "space-a",
        target: root,
        data: {
          id: root.id,
          installmentPeriod: 24,
          installmentTotal: 3000,
          updateScope: UpdateScopeEnum.ALL_IN_SERIES,
          installmentRevisionAnchor: "explicit",
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        spaceCurrency: "PHP",
      });

      expect(updatedRows).toHaveLength(24);
      for (const row of updatedRows) {
        expect(row.currencyConversion?.exchangeRate).toBe(100);
        expect(row.currencyConversion?.originalAmount).toBe(125);
        expect(row.currencyConversion?.convertedAmount).toBe(12_500);
        expect(row.bookedAmount).toBe(125);
        expect(row.amount).toBe(12_500);
      }
    } finally {
      seriesRows.forEach((row, index) => {
        Object.assign(row, originals[index]);
      });
    }
  });

  it("creates missing installment children so every term date has a row", async () => {
    const sparseRows = seriesRows.filter((row) =>
      ["2026-08-22", "2026-09-22", "2026-10-22"].includes(row.date),
    );
    vi.mocked(loadAllTransactionsFromLocalIndex).mockResolvedValueOnce(
      sparseRows as IndexTransaction[],
    );

    const updatedRows = await applyInstallmentPlanRevisionLocal({
      spaceId: "space-a",
      target: sparseRows[0] as IndexTransaction,
      data: {
        id: sparseRows[0]!.id,
        installmentPeriod: 24,
        installmentTotal: 3000,
        updateScope: UpdateScopeEnum.ALL_IN_SERIES,
        installmentRevisionAnchor: "explicit",
        original_currency: "GBP",
        exchange_rate: 100,
        exchange_rate_source: "manual",
      },
      spaceCurrency: "PHP",
    });

    const dates = updatedRows.map((row) => row.date).sort();
    expect(dates).toHaveLength(24);
    expect(dates[0]).toBe("2026-08-22");
    expect(dates.at(-1)).toBe("2028-07-22");
    expect(upsertLocalIndexTransaction).toHaveBeenCalledTimes(24);
  });
});
