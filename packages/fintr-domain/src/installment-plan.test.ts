import { describe, expect, it } from "vitest";

import {
  applyInstallmentThisOnlyTotalDeltaCents,
  computeInstallmentCommitmentTotalCents,
  computeInstallmentPlanRevision,
  installmentOccurrenceDates,
  toLedgerCents,
} from "./installment-plan";

describe("computeInstallmentPlanRevision", () => {
  it("keeps total when extending the term with no payments recorded", () => {
    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 120_000,
      currency: "PHP",
      newPeriod: 14,
      parentDate: "2026-01-01",
      effectiveDate: "2026-01-01",
      anchor: "total",
      paidSoFarCents: 0,
    });

    expect(result.installmentTotalCents).toBe(120_000);
    expect(result.perPayment).toBe(85.71);
    expect(result.remainingCount).toBe(14);
  });

  it("keeps monthly when extending the term with no payments recorded", () => {
    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 120_000,
      currency: "PHP",
      newPeriod: 14,
      parentDate: "2026-01-01",
      effectiveDate: "2026-01-01",
      anchor: "monthly",
      paidSoFarCents: 0,
      newMonthlyCents: 10_000,
    });

    expect(result.installmentTotalCents).toBe(140_000);
    expect(result.perPayment).toBe(100);
    expect(result.remainingCount).toBe(14);
  });

  it("keeps monthly including payments already committed", () => {
    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 10_000_008,
      currency: "PHP",
      newPeriod: 23,
      parentDate: "2026-01-01",
      effectiveDate: "2026-08-01",
      anchor: "monthly",
      paidSoFarCents: 3_333_336,
      newMonthlyCents: 416_667,
      priorPerPaymentCents: 416_667,
      calculatedDates: [
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
      ],
    });

    expect(result.remainingCount).toBe(16);
    expect(result.installmentTotalCents).toBe(9_583_341);
  });

  it("keeps total from a July reference payment for the remaining 18 months (INSTALL5)", () => {
    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 250_000,
      currency: "GBP",
      newPeriod: 24,
      parentDate: "2026-01-01",
      effectiveDate: "2026-07-01",
      anchor: "total",
      paidSoFarCents: 0,
      priorPerPaymentCents: 10_000,
      calculatedDates: [
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
      ],
    });

    expect(result.remainingCount).toBe(18);
    expect(result.perPayment).toBe(105.56);
  });

  it("keeps total from the 2nd payment for the remaining 23 months (INSTALL5)", () => {
    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 250_000,
      currency: "GBP",
      newPeriod: 24,
      parentDate: "2026-01-01",
      effectiveDate: "2026-02-01",
      anchor: "total",
      paidSoFarCents: 0,
      priorPerPaymentCents: 10_000,
      calculatedDates: ["2026-01-01", "2026-02-01"],
    });

    expect(result.remainingCount).toBe(23);
    expect(result.perPayment).toBe(104.35);
  });

  it("keeps total for this-and-future revision with committed GBP payments (INSTALL5)", () => {
    const calculatedDates = [
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ];

    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 250_000,
      currency: "GBP",
      newPeriod: 24,
      parentDate: "2026-01-01",
      effectiveDate: "2027-11-01",
      anchor: "total",
      paidSoFarCents: 80_000,
      priorPerPaymentCents: 10_000,
      calculatedDates,
    });

    expect(result.remainingCount).toBe(2);
    expect(result.perPayment).toBe(150);
    expect(result.perPayment).not.toBe(104.17);
  });

  it("releases a this-only bump and splits 2600 across the last 2 payments as 200 each", () => {
    // Plan was 2400 @ 100/mo. This-only on Nov raised that payment to 200 → total 2500.
    // Revising this-and-future from Nov with total 2600 must release the 200 bump,
    // lock earlier months at 100, and set the last 2 payments to 200 each.
    const occurrenceCentsByDate: Record<string, number> = {};
    for (let index = 0; index < 24; index += 1) {
      const year = 2026 + Math.floor(index / 12);
      const month = (index % 12) + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-01`;
      occurrenceCentsByDate[date] = date === "2027-11-01" ? 20_000 : 10_000;
    }

    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 260_000,
      currency: "GBP",
      newPeriod: 24,
      parentDate: "2026-01-01",
      effectiveDate: "2027-11-01",
      anchor: "total",
      paidSoFarCents: 80_000,
      // Wrong if used alone (the bumped Nov payment) — occurrence map must win.
      priorPerPaymentCents: 20_000,
      occurrenceCentsByDate,
      calculatedDates: [
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
      ],
    });

    expect(result.remainingCount).toBe(2);
    expect(result.perPayment).toBe(200);
    expect(result.installmentTotalCents).toBe(260_000);
  });

  it("splits 2700 across the last 3 payments as 200 each after a 300 bump on the 2nd-to-last", () => {
    const occurrenceCentsByDate: Record<string, number> = {};
    for (let index = 0; index < 24; index += 1) {
      const date = new Date(Date.UTC(2026, 7 + index, 22));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-22`;
      occurrenceCentsByDate[key] =
        key === "2028-06-22" ? 3_000_000 : 1_000_000;
    }

    const result = computeInstallmentPlanRevision({
      installmentTotalCents: 27_000_000,
      currency: "PHP",
      newPeriod: 24,
      parentDate: "2026-08-22",
      effectiveDate: "2028-05-22",
      anchor: "explicit",
      paidSoFarCents: 0,
      priorPerPaymentCents: 1_000_000,
      occurrenceCentsByDate,
    });

    expect(result.remainingCount).toBe(3);
    expect(result.perPayment).toBe(20_000);
    expect(result.installmentTotalCents).toBe(27_000_000);
  });

  it("converts a display-currency plan total into ledger cents", () => {
    expect(
      toLedgerCents({
        amount: 2700,
        fromCurrency: "GBP",
        ledgerCurrency: "PHP",
        exchangeRate: 100,
      }),
    ).toBe(27_000_000);
  });

  it("parses ISO datetime strings for occurrence dates", () => {
    const dates = installmentOccurrenceDates({
      parentDate: "2026-01-01T00:00:00.000Z",
      period: 2,
    });

      expect(dates).toEqual(["2026-01-01", "2026-02-01"]);
  });
});

describe("computeInstallmentCommitmentTotalCents", () => {
  it("uses actual occurrence amounts instead of monthly times term", () => {
    expect(
      computeInstallmentCommitmentTotalCents({
        parentDate: "2026-01-01",
        period: 24,
        defaultPerPaymentCents: 1_000_000,
        occurrenceCentsByDate: {
          "2026-07-01": 5_000_000,
          "2027-11-01": 2_000_000,
        },
      }),
    ).toBe(29_000_000);
  });
});

describe("applyInstallmentThisOnlyTotalDeltaCents", () => {
  it("raises a stale stored total by the extra this-payment amount", () => {
    expect(
      applyInstallmentThisOnlyTotalDeltaCents({
        storedTotalCents: 24_000_000,
        period: 24,
        previousAmountCents: 1_000_000,
        nextAmountCents: 2_000_000,
      }),
    ).toBe(25_000_000);
  });
});
