import { describe, expect, it } from "vitest";

import {
  adjustInstallmentThisPaymentForPlanTotalChange,
  adjustInstallmentTotalForSinglePaymentChange,
  computeInstallmentTotalFromMonthly,
  installmentRemainingPaymentsLabel,
  resolveInstallmentDisplayedPlanTotal,
  resolveInstallmentFormInitialAmounts,
  resolveInstallmentStoredPlanTotal,
  resolveInstallmentSubmitAmount,
  roundInstallmentPerPayment,
  syncInstallmentAmounts,
  syncInstallmentRevisionAmounts,
} from "@/utils/installmentFormAmounts";

const INSTALL5_CALCULATED_DATES = [
  "2026-01-01",
  "2026-02-01",
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
];

describe("installmentFormAmounts", () => {
  it("names the remaining suffix of an installment series", () => {
    expect(installmentRemainingPaymentsLabel(1)).toBe("the last payment");
    expect(installmentRemainingPaymentsLabel(2)).toBe("the last 2 payments");
  });

  it("does not treat a per-payment amount as the plan total", () => {
    expect(
      resolveInstallmentDisplayedPlanTotal({
        enteredAmount: 100,
        planTotal: 2400,
        perPaymentAmount: 100,
      }),
    ).toBe(2400);

    expect(
      resolveInstallmentStoredPlanTotal({
        installmentTotal: 100,
        perPaymentAmount: 100,
        periodMonths: 24,
      }),
    ).toBe(2400);
  });

  it("rounds per-payment amounts half-up to two decimals", () => {
    expect(roundInstallmentPerPayment(1200, 12)).toBe(100);
    expect(roundInstallmentPerPayment(1000, 3)).toBe(333.33);
  });

  it("derives total from monthly and term", () => {
    expect(computeInstallmentTotalFromMonthly(100, 12)).toBe(1200);
    expect(computeInstallmentTotalFromMonthly(333.33, 3)).toBe(999.99);
  });

  it("syncs from total anchor", () => {
    expect(
      syncInstallmentAmounts({
        anchor: "total",
        total: 1200,
        monthly: 0,
        periodMonths: 12,
      }),
    ).toEqual({ total: 1200, monthly: 100 });
  });

  it("syncs from monthly anchor", () => {
    expect(
      syncInstallmentAmounts({
        anchor: "monthly",
        total: 0,
        monthly: 100,
        periodMonths: 12,
      }),
    ).toEqual({ total: 1200, monthly: 100 });
  });

  it("prefers stored installment total when currencies match", () => {
    expect(
      resolveInstallmentFormInitialAmounts({
        installmentTotal: 24000,
        perPaymentAmount: 1000,
        periodMonths: 24,
        useStoredTotal: true,
      }),
    ).toEqual({ total: 24000, monthly: 1000 });
  });

  it("derives total from monthly when stored total is unavailable", () => {
    expect(
      resolveInstallmentFormInitialAmounts({
        installmentTotal: null,
        perPaymentAmount: 1000,
        periodMonths: 24,
        useStoredTotal: false,
      }),
    ).toEqual({ total: 24000, monthly: 1000 });
  });

  it("submits total on create and monthly on edit", () => {
    expect(
      resolveInstallmentSubmitAmount({
        isEditMode: false,
        totalAmount: "24000",
        monthlyAmount: "1000",
        periodMonths: 24,
      }),
    ).toBe("24000");

    expect(
      resolveInstallmentSubmitAmount({
        isEditMode: true,
        totalAmount: "24000",
        monthlyAmount: "1000",
        periodMonths: 24,
      }),
    ).toBe("1000");
  });

  it("submits the single payment amount in this-only installment edits", () => {
    expect(
      resolveInstallmentSubmitAmount({
        isEditMode: true,
        totalAmount: "500",
        monthlyAmount: "1000",
        periodMonths: 24,
        singlePaymentMode: true,
      }),
    ).toBe("500");
  });

  it("adjusts plan total by the payment delta for this-only edits", () => {
    expect(
      adjustInstallmentTotalForSinglePaymentChange({
        planTotal: 24000,
        originalPaymentAmount: 1000,
        nextPaymentAmount: 500,
      }),
    ).toBe(23500);
  });

  it("redistributes remaining balance when committed payments exist", () => {
    expect(
      syncInstallmentAmounts({
        anchor: "total",
        total: 24000,
        monthly: 1000,
        periodMonths: 24,
        paidSoFar: 6000,
        committedMonthsCount: 6,
      }),
    ).toEqual({ total: 24000, monthly: 1000 });

    expect(
      syncInstallmentAmounts({
        anchor: "total",
        total: 30000,
        monthly: 1000,
        periodMonths: 24,
        paidSoFar: 6000,
        committedMonthsCount: 6,
      }),
    ).toEqual({ total: 30000, monthly: 1333.33 });
  });

  it("raises plan total when monthly changes and payments are already committed", () => {
    expect(
      syncInstallmentAmounts({
        anchor: "monthly",
        total: 24000,
        monthly: 800,
        periodMonths: 24,
        paidSoFar: 6000,
        committedMonthsCount: 6,
      }),
    ).toEqual({ total: 20400, monthly: 800 });
  });

  it("redistributes remaining balance using occurrence dates for this-and-future edits (INSTALL5)", () => {
    // £2400 plan, 24 months at £100, 8 calculated payments, edit the 2nd-to-last
    // payment and raise total to £2500. Earlier unpaid months stay at £100;
    // only the last 2 payments share the extra £100 → £150 each.
    const revisionContext = {
      parentDate: "2026-01-01",
      effectiveDate: "2027-11-01",
      periodMonths: 24,
      paidSoFarCents: 80_000,
      calculatedDates: INSTALL5_CALCULATED_DATES,
      priorPerPaymentCents: 10_000,
    };

    const synced = syncInstallmentRevisionAmounts({
      anchor: "total",
      total: 2500,
      monthly: 100,
      ...revisionContext,
    });

    expect(synced.monthly).not.toBe(104.17);
    expect(synced.monthly).toBe(150);
    expect(synced.total).toBe(2500);

    expect(
      resolveInstallmentFormInitialAmounts({
        installmentTotal: 2500,
        perPaymentAmount: 100,
        periodMonths: 24,
        useStoredTotal: true,
        paidSoFar: 800,
        committedMonthsCount: 8,
        parentDate: revisionContext.parentDate,
        effectiveDate: revisionContext.effectiveDate,
        calculatedDates: revisionContext.calculatedDates,
        priorPerPaymentCents: 10_000,
      }),
    ).toEqual({ total: 2500, monthly: 150 });
  });

  it("spreads a new total across 18 remaining payments from a July reference (INSTALL5)", () => {
    expect(
      syncInstallmentRevisionAmounts({
        anchor: "total",
        total: 2500,
        monthly: 100,
        parentDate: "2026-01-01",
        effectiveDate: "2026-07-01",
        periodMonths: 24,
        paidSoFarCents: 0,
        calculatedDates: INSTALL5_CALCULATED_DATES,
        priorPerPaymentCents: 10_000,
      }),
    ).toEqual({ total: 2500, monthly: 105.56 });
  });

  it("spreads a new total across 23 remaining payments from the 2nd payment (INSTALL5)", () => {
    expect(
      syncInstallmentRevisionAmounts({
        anchor: "total",
        total: 2500,
        monthly: 100,
        parentDate: "2026-01-01",
        effectiveDate: "2026-02-01",
        periodMonths: 24,
        paidSoFarCents: 0,
        calculatedDates: INSTALL5_CALCULATED_DATES,
        priorPerPaymentCents: 10_000,
      }),
    ).toEqual({ total: 2500, monthly: 104.35 });
  });

  it("releases a this-only 200 bump so 2500→2600 becomes 200 for the last 2 payments", () => {
    const occurrenceCentsByDate: Record<string, number> = {};
    for (let index = 0; index < 24; index += 1) {
      const year = 2026 + Math.floor(index / 12);
      const month = (index % 12) + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-01`;
      occurrenceCentsByDate[date] = date === "2027-11-01" ? 20_000 : 10_000;
    }

    // Without the occurrence map, prior=200 would blank the monthly field
    // (22 × 200 locked > 2600 remaining).
    expect(
      syncInstallmentRevisionAmounts({
        anchor: "total",
        total: 2600,
        monthly: 200,
        parentDate: "2026-01-01",
        effectiveDate: "2027-11-01",
        periodMonths: 24,
        paidSoFarCents: 80_000,
        calculatedDates: INSTALL5_CALCULATED_DATES,
        priorPerPaymentCents: 20_000,
      }).monthly,
    ).toBeLessThanOrEqual(0);

    expect(
      syncInstallmentRevisionAmounts({
        anchor: "total",
        total: 2600,
        monthly: 200,
        parentDate: "2026-01-01",
        effectiveDate: "2027-11-01",
        periodMonths: 24,
        paidSoFarCents: 80_000,
        calculatedDates: INSTALL5_CALCULATED_DATES,
        priorPerPaymentCents: 20_000,
        occurrenceCentsByDate,
      }),
    ).toEqual({ total: 2600, monthly: 200 });

    expect(
      resolveInstallmentFormInitialAmounts({
        installmentTotal: 2600,
        perPaymentAmount: 200,
        periodMonths: 24,
        useStoredTotal: true,
        paidSoFar: 800,
        committedMonthsCount: 8,
        parentDate: "2026-01-01",
        effectiveDate: "2027-11-01",
        calculatedDates: INSTALL5_CALCULATED_DATES,
        priorPerPaymentCents: 10_000,
        occurrenceCentsByDate,
      }),
    ).toEqual({ total: 2600, monthly: 200 });
  });

  it("uses ledger math for INSTALL8 this-and-future revision after a 300 GBP bump", () => {
    const occurrenceCentsByDate: Record<string, number> = {};
    for (let index = 0; index < 24; index += 1) {
      const date = new Date(Date.UTC(2026, 7 + index, 22));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-22`;
      occurrenceCentsByDate[key] = key === "2028-06-22" ? 30_000 : 10_000;
    }

    expect(
      syncInstallmentRevisionAmounts({
        anchor: "total",
        total: 2700,
        monthly: 100,
        parentDate: "2026-08-22",
        effectiveDate: "2028-05-22",
        periodMonths: 24,
        paidSoFarCents: 0,
        priorPerPaymentCents: 10_000,
        occurrenceCentsByDate,
        exchangeRate: 100,
        ledgerCurrency: "PHP",
        displayCurrency: "GBP",
      }),
    ).toEqual({ total: 2700, monthly: 200 });
  });

  it("puts a plan-total increase onto this payment only", () => {
    expect(
      adjustInstallmentThisPaymentForPlanTotalChange({
        originalPlanTotal: 2400,
        originalPaymentAmount: 100,
        nextPlanTotal: 2500,
      }),
    ).toBe(200);
  });

  it("does not treat a this-only extra payment as the monthly rate", () => {
    expect(
      resolveInstallmentStoredPlanTotal({
        installmentTotal: 2500,
        perPaymentAmount: 200,
        periodMonths: 24,
      }),
    ).toBe(2500);
  });

  it("converts a space-currency plan total into the form currency", () => {
    expect(
      resolveInstallmentStoredPlanTotal({
        installmentTotal: 250_000,
        perPaymentAmount: 200,
        periodMonths: 24,
        convertedPerPaymentAmount: 20_000,
      }),
    ).toBe(2500);
  });

  it("converts a PHP installment total using the assigned exchange rate (INSTALL7)", () => {
    expect(
      resolveInstallmentStoredPlanTotal({
        installmentTotal: 240_000,
        perPaymentAmount: 100,
        periodMonths: 24,
        exchangeRate: 100,
      }),
    ).toBe(2400);
  });

  it("converts a PHP installment total using the payment ratio when rate is missing", () => {
    expect(
      resolveInstallmentStoredPlanTotal({
        installmentTotal: 240_000,
        perPaymentAmount: 100,
        periodMonths: 24,
      }),
    ).toBe(2400);
  });
});
