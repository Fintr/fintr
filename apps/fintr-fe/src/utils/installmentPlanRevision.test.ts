import { describe, expect, it } from "vitest";

import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction, UpdateTransactionType } from "@/types/transactionTypes";
import {
  computeInstallmentRevisionSeriesContext,
  resolveInstallmentCommittedRowAmount,
  withInstallmentPlanRevisionSubmit,
} from "@/utils/installmentPlanRevision";

const baseRow = (
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction => ({
  id: "row-1",
  date: "2026-01-01",
  description: "INSTALL4",
  amount: 4166.67,
  amountCurrency: "PHP",
  categoryName: "Home",
  fromAccountName: "EastWest",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: true,
  hasImage: false,
  calculated: true,
  ...overrides,
});

describe("resolveInstallmentCommittedRowAmount", () => {
  it("uses booked amounts when they match the display currency", () => {
    expect(
      resolveInstallmentCommittedRowAmount(
        baseRow({
          bookedAmount: 1000,
          bookedAmountCurrency: "GBP",
        }),
        "GBP",
      ),
    ).toBe(1000);
  });

  it("uses conversion original amounts for foreign-currency display", () => {
    expect(
      resolveInstallmentCommittedRowAmount(
        baseRow({
          currencyConversion: {
            originalAmount: 1000,
            originalCurrency: "GBP",
            convertedAmount: 4166.67,
            convertedCurrency: "PHP",
            exchangeRate: 4.167,
            source: "manual",
          },
        }),
        "GBP",
      ),
    ).toBe(1000);
  });

  it("falls back to the series per-payment amount when list rows are space currency only", () => {
    expect(
      resolveInstallmentCommittedRowAmount(baseRow(), "GBP", 1000),
    ).toBe(1000);
  });
});

describe("computeInstallmentRevisionSeriesContext", () => {
  it("sums committed payments in the display currency", () => {
    const target = baseRow({
      id: "parent",
      calculated: false,
      bookedAmount: 1000,
      bookedAmountCurrency: "GBP",
    });
    const context = computeInstallmentRevisionSeriesContext(
      target,
      [
        target,
        baseRow({
          id: "child-1",
          calculated: true,
          parentId: "parent",
          rootParentId: "parent",
        }),
        baseRow({
          id: "child-2",
          calculated: true,
          parentId: "parent",
          rootParentId: "parent",
        }),
      ],
      {
        displayCurrency: "GBP",
        fallbackPerPayment: 1000,
      },
    );

    expect(context.committedMonthsCount).toBe(2);
    expect(context.paidSoFarCents).toBe(200_000);
    expect(context.defaultPerPaymentCents).toBe(100_000);
    expect(context.occurrenceCentsByDate["2026-01-01"]).toBe(100_000);
  });

  it("keeps the series default per payment when the edited row has a this-only bump", () => {
    const target = baseRow({
      id: "nov",
      date: "2027-11-01",
      calculated: false,
      parentId: "root",
      rootParentId: "root",
      bookedAmount: 200,
      bookedAmountCurrency: "GBP",
      amount: 20_000,
    });
    const context = computeInstallmentRevisionSeriesContext(
      target,
      [
        baseRow({
          id: "root",
          date: "2026-01-01",
          calculated: true,
          bookedAmount: 100,
          bookedAmountCurrency: "GBP",
          amount: 10_000,
        }),
        baseRow({
          id: "oct",
          date: "2027-10-01",
          calculated: false,
          parentId: "root",
          rootParentId: "root",
          bookedAmount: 100,
          bookedAmountCurrency: "GBP",
          amount: 10_000,
        }),
        target,
        baseRow({
          id: "dec",
          date: "2027-12-01",
          calculated: false,
          parentId: "root",
          rootParentId: "root",
          bookedAmount: 100,
          bookedAmountCurrency: "GBP",
          amount: 10_000,
        }),
      ],
      {
        displayCurrency: "GBP",
      },
    );

    expect(context.defaultPerPaymentCents).toBe(10_000);
    expect(context.occurrenceCentsByDate["2027-11-01"]).toBe(20_000);
    expect(context.occurrenceCentsByDate["2027-10-01"]).toBe(10_000);
  });
});

describe("withInstallmentPlanRevisionSubmit", () => {
  const original = {
    scheduleType: ScheduleTypeEnum.INSTALLMENT,
    installmentPeriod: 24,
    amount: 100,
  } as UpdateTransactionType;

  it("does not add a revision prompt for this-payment-only edits", () => {
    const next = {
      ...original,
      amount: 150,
      installmentTotal: 2500,
      updateScope: UpdateScopeEnum.THIS_ONLY,
    } as UpdateTransactionType & { installmentTotal: number };

    expect(
      withInstallmentPlanRevisionSubmit(
        original,
        next,
        UpdateScopeEnum.THIS_ONLY,
      ),
    ).toEqual(next);
  });

  it("keeps the form totals instead of asking keep-total vs keep-monthly", () => {
    const next = {
      ...original,
      amount: 150,
      installmentTotal: 2500,
      updateScope: UpdateScopeEnum.THIS_AND_FUTURE,
    } as UpdateTransactionType & { installmentTotal: number };

    expect(
      withInstallmentPlanRevisionSubmit(
        original,
        next,
        UpdateScopeEnum.THIS_AND_FUTURE,
      ),
    ).toEqual({
      ...next,
      installmentRevisionAnchor: "explicit",
    });
  });
});
