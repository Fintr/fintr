import { describe, expect, it } from "vitest";
import type { Loan } from "@/services/loans/queries";
import { getAmortizationSchedule } from "@/utils/loanAmortization";

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2026-06-18",
  description: "LOAN FOR CAR",
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-06-18",
  status: "active",
  paidOffDate: null,
  interestRate: 0,
  entityName: "Lender",
  accountName: "Cash",
  principalAmount: 12_000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 11_000,
  outstandingBalanceCurrency: "PHP",
  value: -12_000,
  income: 0,
  expense: 0,
  totalValue: 12_000,
  files: [],
  ...overrides,
});

describe("getAmortizationSchedule", () => {
  it("keeps the first contractual due date when there are no payments", () => {
    const schedule = getAmortizationSchedule(createLoan({ loanPayments: [] }));

    expect(toLocalDateString(schedule[0]!.paymentDate)).toBe("2026-07-18");
    expect(schedule[0]?.isActual).toBe(false);
  });

  it("keeps the next due date on the original cadence after a late payment", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        date: "2026-07-08",
        maturityDate: "2027-07-08",
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-08-10",
            principalPayment: 1_000,
            interestPayment: 0,
            totalPayment: 1_000,
            currency: "PHP",
          },
        ],
      }),
    );

    expect(toLocalDateString(schedule[0]!.paymentDate)).toBe("2026-08-08");
    expect(schedule[0]?.isActual).toBe(true);
    expect(toLocalDateString(schedule[0]!.paidOnDate!)).toBe("2026-08-10");
    expect(toLocalDateString(schedule[1]!.paymentDate)).toBe("2026-09-08");
    expect(schedule[1]?.isActual).toBe(false);
    expect(schedule[1]?.paymentAmount).toBe(1_000);
  });

  it("keeps the immediately following due date unpaid after a double payment", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        date: "2026-07-08",
        maturityDate: "2027-07-08",
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-08-08",
            principalPayment: 2_000,
            interestPayment: 0,
            totalPayment: 2_000,
            currency: "PHP",
          },
        ],
      }),
    );

    expect(toLocalDateString(schedule[0]!.paymentDate)).toBe("2026-08-08");
    expect(schedule[0]?.isActual).toBe(true);
    expect(toLocalDateString(schedule[1]!.paymentDate)).toBe("2026-09-08");
    expect(schedule[1]?.isActual).toBe(false);
    expect(schedule[1]?.paymentAmount).toBe(1_000);
    expect(schedule[1]!.beginningBalance).toBeLessThan(
      schedule[0]!.beginningBalance,
    );
  });

  it("keeps the original installment after overpay and shortens remaining dates", () => {
    const withoutOverpay = getAmortizationSchedule(
      createLoan({ loanPayments: [] }),
    );
    const withOverpay = getAmortizationSchedule(
      createLoan({
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-07-18",
            principalPayment: 3_000,
            interestPayment: 0,
            totalPayment: 3_000,
            currency: "PHP",
          },
        ],
      }),
    );

    expect(withOverpay[0]?.isActual).toBe(true);
    expect(withOverpay[1]?.isActual).toBe(false);
    expect(withOverpay[1]?.paymentAmount).toBe(1_000);
    expect(withOverpay.length).toBeLessThan(withoutOverpay.length);
  });

  it("marks the original first due date as paid after a late payment", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        amortizationSchedule: [
          {
            paymentDate: "2026-07-18",
            beginningBalance: 12_000,
            paymentAmount: 1_000,
            principalPayment: 1_000,
            interestPayment: 0,
            endingBalance: 11_000,
            isActual: false,
          },
          {
            paymentDate: "2026-08-11",
            beginningBalance: 11_000,
            paymentAmount: 1_000,
            principalPayment: 1_000,
            interestPayment: 0,
            endingBalance: 10_000,
            isActual: true,
          },
        ],
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-08-11",
            principalPayment: 1_000,
            interestPayment: 0,
            totalPayment: 1_000,
            currency: "PHP",
          },
        ],
      }),
    );

    const first = schedule[0]!;
    const second = schedule[1]!;

    expect(toLocalDateString(first.paymentDate)).toBe("2026-07-18");
    expect(first.isActual).toBe(true);
    expect(first.paymentAmount).toBe(1_000);
    expect(toLocalDateString(second.paymentDate)).toBe("2026-08-18");
    expect(second.isActual).toBe(false);
  });

  it("allocates later payments to the next original due dates in order", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-08-11",
            principalPayment: 1_000,
            interestPayment: 0,
            totalPayment: 1_000,
            currency: "PHP",
          },
          {
            id: "payment-2",
            date: "2026-08-14",
            principalPayment: 1_000,
            interestPayment: 0,
            totalPayment: 1_000,
            currency: "PHP",
          },
        ],
      }),
    );

    expect(toLocalDateString(schedule[0]!.paymentDate)).toBe("2026-07-18");
    expect(schedule[0]?.isActual).toBe(true);
    expect(toLocalDateString(schedule[1]!.paymentDate)).toBe("2026-08-18");
    expect(schedule[1]?.isActual).toBe(true);
    expect(toLocalDateString(schedule[2]!.paymentDate)).toBe("2026-09-18");
    expect(schedule[2]?.isActual).toBe(false);
  });

  it("does not mark the first due date paid when the catch-up payment is partial", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-08-11",
            principalPayment: 200,
            interestPayment: 0,
            totalPayment: 200,
            currency: "PHP",
          },
        ],
      }),
    );

    expect(toLocalDateString(schedule[0]!.paymentDate)).toBe("2026-07-18");
    expect(schedule[0]?.isActual).toBe(false);
  });

  it("uses the provided payments instead of stale payments embedded on the loan", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        date: "2026-07-08",
        maturityDate: "2027-07-08",
        loanPayments: [
          {
            id: "stale-1",
            date: "2026-08-08",
            principalPayment: 1_000,
            interestPayment: 0,
            totalPayment: 1_000,
            currency: "PHP",
          },
          {
            id: "stale-2",
            date: "2026-08-11",
            principalPayment: 1_000,
            interestPayment: 0,
            totalPayment: 1_000,
            currency: "PHP",
          },
        ],
      }),
      [
        {
          id: "payment-1",
          date: "2026-08-14",
          principalPayment: 1_000,
          interestPayment: 0,
          totalPayment: 1_000,
          currency: "PHP",
        },
        {
          id: "payment-2",
          date: "2026-08-17",
          principalPayment: 1_000,
          interestPayment: 0,
          totalPayment: 1_000,
          currency: "PHP",
        },
      ],
    );

    const paid = schedule.filter((item) => item.isActual);

    expect(paid).toHaveLength(2);
    expect(toLocalDateString(paid[0]!.paidOnDate!)).toBe("2026-08-14");
    expect(toLocalDateString(paid[1]!.paidOnDate!)).toBe("2026-08-17");
    expect(schedule[2]?.isActual).toBe(false);
  });

  it("prices the next unpaid row with daily interest from the last payment date", () => {
    const schedule = getAmortizationSchedule(
      createLoan({
        date: "2026-07-08",
        maturityDate: "2027-07-08",
        interestRate: 12,
        principalAmount: 12_000,
        outstandingBalance: 11_000,
        loanPayments: [
          {
            id: "payment-1",
            date: "2026-08-10",
            principalPayment: 1_000,
            interestPayment: 118.36,
            totalPayment: 1_066.19,
            currency: "PHP",
          },
        ],
      }),
    );

    const originalPmt = schedule[0]!.paymentAmount;
    const next = schedule[1]!;
    const days = Math.round(
      (next.paymentDate.getTime() - schedule[0]!.paymentDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const expectedInterest = Math.round(
      next.beginningBalance * (0.12 / 365) * days * 100,
    ) / 100;

    expect(toLocalDateString(next.paymentDate)).toBe("2026-09-08");
    expect(next.isActual).toBe(false);
    expect(next.paymentAmount).toBe(originalPmt);
    expect(next.interestPayment).toBe(expectedInterest);
    expect(next.principalPayment).toBe(
      Math.round((originalPmt - expectedInterest) * 100) / 100,
    );
    expect(next.beginningBalance).toBeGreaterThan(schedule[2]!.beginningBalance);
  });
});
