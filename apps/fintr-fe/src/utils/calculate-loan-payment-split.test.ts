import { describe, expect, it } from "vitest";

import { calculateLoanPaymentSplit } from "@/utils/calculate-loan-payment-split";

describe("calculateLoanPaymentSplit", () => {
  const loan = {
    date: "2024-01-01",
    principalAmount: 100_000,
    interestRate: 10,
  };

  it("calculates first-payment interest using daily simple interest", () => {
    const split = calculateLoanPaymentSplit({
      loan,
      paymentDate: new Date("2024-02-01"),
      totalPayment: 8_791.59,
      existingPayments: [],
    });

    expect(split).not.toBeNull();
    expect(split?.interestPayment).toBeCloseTo(849.32, 2);
    expect(split?.principalPayment).toBeCloseTo(7_942.27, 2);
  });

  it("subtracts interest already paid on the same date", () => {
    const split = calculateLoanPaymentSplit({
      loan,
      paymentDate: new Date("2024-02-01"),
      totalPayment: 1_000,
      existingPayments: [
        {
          id: "payment-1",
          date: "2024-02-01",
          principalPayment: 100,
          interestPayment: 500,
        },
      ],
    });

    expect(split).not.toBeNull();
    expect(split?.interestPayment).toBeCloseTo(349.32, 2);
    expect(split?.principalPayment).toBeCloseTo(650.68, 2);
  });

  it("uses the last payment date as the interest period start", () => {
    const split = calculateLoanPaymentSplit({
      loan,
      paymentDate: new Date("2024-03-01"),
      totalPayment: 8_791.59,
      existingPayments: [
        {
          id: "payment-1",
          date: "2024-02-01",
          principalPayment: 7_942.27,
          interestPayment: 849.32,
        },
      ],
    });

    expect(split).not.toBeNull();
    expect(split?.interestPayment).toBeGreaterThan(0);
    expect(split?.interestPayment).toBeLessThan(849.32);
  });

  it("returns null for non-positive payment amounts", () => {
    expect(
      calculateLoanPaymentSplit({
        loan,
        paymentDate: new Date("2024-02-01"),
        totalPayment: 0,
        existingPayments: [],
      }),
    ).toBeNull();
  });
});
