import { describe, expect, it } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum, type IndexTransaction } from "@/types/transactionTypes";

import {
  backfillIndexRowForOffline,
  backfillIndexRowsForOffline,
  indexRowHasStoredFx,
  indexRowNeedsFxDetailPrefetch,
} from "./offline-fx-backfill";

const gbpInstallmentRow = (): IndexTransaction => ({
  id: "tx-install8",
  date: "2027-12-01",
  description: "INSTALL8",
  amount: 10_000,
  amountCurrency: "PHP",
  bookedAmount: 100,
  bookedAmountCurrency: "GBP",
  categoryName: "Home",
  fromAccountName: "GCash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: true,
  parentId: "tx-install8-root",
  scheduleType: ScheduleTypeEnum.INSTALLMENT,
  installmentPeriod: 24,
  installmentTotal: 240_000,
  hasImage: false,
});

describe("offline-fx-backfill", () => {
  it("reconciles a this-only GBP bump when booked and converted legs both read 200", () => {
    const row = backfillIndexRowForOffline({
      ...gbpInstallmentRow(),
      amount: 200,
      bookedAmount: 200,
      currencyConversion: {
        originalAmount: 200,
        originalCurrency: "GBP",
        convertedAmount: 200,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "manual",
      },
    });

    expect(row.currencyConversion).toMatchObject({
      originalAmount: 200,
      originalCurrency: "GBP",
      convertedAmount: 20_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
    });
  });

  it("adds currencyConversion from booked legs on the index row", () => {
    const row = backfillIndexRowForOffline(gbpInstallmentRow());

    expect(indexRowHasStoredFx(row)).toBe(true);
    expect(row.currencyConversion).toMatchObject({
      originalAmount: 100,
      originalCurrency: "GBP",
      convertedAmount: 10_000,
      convertedCurrency: "PHP",
      exchangeRate: 100,
    });
  });

  it("backfills bootstrap transaction arrays in one pass", () => {
    const rows = backfillIndexRowsForOffline([
      gbpInstallmentRow(),
      {
        ...gbpInstallmentRow(),
        id: "tx-php-only",
        bookedAmount: undefined,
        bookedAmountCurrency: undefined,
      },
    ]);

    expect(rows[0]?.currencyConversion?.exchangeRate).toBe(100);
    expect(rows[1]?.currencyConversion).toBeUndefined();
  });

  it("flags installment rows that still need an API detail prefetch", () => {
    expect(indexRowNeedsFxDetailPrefetch(gbpInstallmentRow())).toBe(false);

    expect(
      indexRowNeedsFxDetailPrefetch({
        ...gbpInstallmentRow(),
        bookedAmount: undefined,
        bookedAmountCurrency: undefined,
        currencyConversion: undefined,
      }),
    ).toBe(true);
  });
});
