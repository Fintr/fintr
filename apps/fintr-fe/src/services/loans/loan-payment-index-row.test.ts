import { describe, expect, it } from "vitest";

import type { LoanPayment } from "@/services/loans/payments";
import {
  loanPaymentToIndexRow,
  optimisticLoanPaymentIndexMoney,
} from "@/services/loans/loan-payment-index-row";

describe("optimisticLoanPaymentIndexMoney", () => {
  it("maps cross-currency loan payments to converted space money with booked leg", () => {
    const payment: LoanPayment = {
      id: "pay-1",
      loanId: "loan-1",
      accountId: "",
      accountName: "Cash - Ella",
      date: "2026-08-11",
      principalPayment: 200,
      interestPayment: 0,
      totalPayment: 200,
      currency: "PLN",
      currencyConversion: {
        originalAmount: 200,
        originalCurrency: "PLN",
        convertedAmount: 28,
        convertedCurrency: "PHP",
        exchangeRate: 0.14,
        source: "manual",
      },
    };

    const result = optimisticLoanPaymentIndexMoney({
      payment,
      spaceCurrency: "PHP",
    });

    expect(result).toEqual({
      amount: 28,
      amountCurrency: "PHP",
      bookedAmount: 200,
      bookedAmountCurrency: "PLN",
    });
  });

  it("derives converted amount from create FX payload when conversion is not stored yet", () => {
    const payment: LoanPayment = {
      id: "pay-1",
      loanId: "loan-1",
      accountId: "",
      accountName: "Cash - Ella",
      date: "2026-08-11",
      principalPayment: 200,
      interestPayment: 0,
      totalPayment: 200,
      currency: "PLN",
    };

    const result = optimisticLoanPaymentIndexMoney({
      payment,
      spaceCurrency: "PHP",
      createData: {
        originalCurrency: "PLN",
        exchangeRate: 0.14,
      },
    });

    expect(result.amount).toBe(28);
    expect(result.amountCurrency).toBe("PHP");
    expect(result.bookedAmount).toBe(200);
    expect(result.bookedAmountCurrency).toBe("PLN");
  });
});

describe("loanPaymentToIndexRow", () => {
  it("does not label a PLN payment as PHP when currencies match the loan", () => {
    const row = loanPaymentToIndexRow(
      {
        id: "pay-1",
        loanId: "loan-1",
        accountId: "",
        accountName: "Cash - Ella",
        date: "2026-08-11",
        principalPayment: 200,
        interestPayment: 0,
        totalPayment: 200,
        currency: "PLN",
      },
      "loan-1",
      {
        spaceCurrency: "PHP",
        createData: {
          originalCurrency: "PLN",
          exchangeRate: 0.14,
        },
      },
    );

    expect(row.amount).toBe(28);
    expect(row.amountCurrency).toBe("PHP");
    expect(row.bookedAmount).toBe(200);
    expect(row.bookedAmountCurrency).toBe("PLN");
  });
});
