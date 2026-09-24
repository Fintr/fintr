import { describe, expect, it } from "vitest";

import {
  normalizeLoanPayment,
  parseLoanPaymentAmount,
  sumActualLoanInterestPaid,
} from "./loan-payment-amounts";

describe("parseLoanPaymentAmount", () => {
  it("returns 0 for nullish and invalid values", () => {
    expect(parseLoanPaymentAmount(undefined)).toBe(0);
    expect(parseLoanPaymentAmount(null)).toBe(0);
    expect(parseLoanPaymentAmount("")).toBe(0);
    expect(parseLoanPaymentAmount("not-a-number")).toBe(0);
    expect(parseLoanPaymentAmount(Number.NaN)).toBe(0);
  });

  it("parses numbers and numeric strings", () => {
    expect(parseLoanPaymentAmount(12.5)).toBe(12.5);
    expect(parseLoanPaymentAmount("12.5")).toBe(12.5);
  });
});

describe("normalizeLoanPayment", () => {
  it("accepts snake_case API fields", () => {
    expect(
      normalizeLoanPayment({
        id: "pay-1",
        date: "2024-02-01",
        account_name: "Cash",
        principal_payment: "1000",
        interest_payment: "0",
        total_payment: "1000",
        currency: "PLN",
      }),
    ).toEqual({
      id: "pay-1",
      loanId: "",
      accountId: "",
      accountName: "Cash",
      date: "2024-02-01",
      principalPayment: 1000,
      interestPayment: 0,
      totalPayment: 1000,
      currency: "PLN",
      notes: undefined,
      adjustsAccountBalance: true,
    });
  });
});

describe("sumActualLoanInterestPaid", () => {
  it("returns 0 when there are no payments", () => {
    expect(sumActualLoanInterestPaid([])).toBe(0);
  });

  it("does not produce NaN when interest is missing on a payment", () => {
    expect(
      sumActualLoanInterestPaid([
        {
          principalPayment: 1000,
          totalPayment: 1000,
        },
      ]),
    ).toBe(0);
  });

  it("sums interest across payments", () => {
    expect(
      sumActualLoanInterestPaid([
        { interestPayment: 10 },
        { interest_payment: "5.5" },
      ]),
    ).toBe(15.5);
  });
});
