import { describe, expect, it } from "vitest";
import { Loan } from "@/services/loans/queries";
import {
  formatLoanDueLabel,
  getNextLoanPaymentDeadline,
  getUpcomingLoanDeadlines,
} from "@/utils/loan-upcoming-deadlines";

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2024-01-01",
  description: null,
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2025-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 12,
  entityName: "Bank",
  accountName: "Checking",
  principalAmount: 12_000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 10_000,
  outstandingBalanceCurrency: "PHP",
  value: -12_000,
  income: 0,
  expense: 0,
  totalValue: 12_720,
  files: [],
  ...overrides,
});

describe("loan-upcoming-deadlines", () => {
  it("returns the earliest unpaid installment from the amortization schedule", () => {
    const loan = createLoan({
      amortizationSchedule: [
        {
          paymentDate: "2024-02-01",
          beginningBalance: 12_000,
          paymentAmount: 1_060,
          principalPayment: 940,
          interestPayment: 120,
          endingBalance: 11_060,
          isActual: true,
        },
        {
          paymentDate: "2024-03-01",
          beginningBalance: 11_060,
          paymentAmount: 1_060,
          principalPayment: 949,
          interestPayment: 111,
          endingBalance: 10_111,
          isActual: false,
        },
        {
          paymentDate: "2024-04-01",
          beginningBalance: 10_111,
          paymentAmount: 1_060,
          principalPayment: 958,
          interestPayment: 102,
          endingBalance: 9_153,
          isActual: false,
        },
      ],
    });

    const deadline = getNextLoanPaymentDeadline(loan);

    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2024-03-01");
    expect(deadline?.paymentAmount).toBe(1_060);
  });

  it("ignores paid-off and zero-balance loans", () => {
    const paidOff = createLoan({
      status: "paid_off",
      outstandingBalance: 0,
    });
    const zeroBalance = createLoan({
      outstandingBalance: 0,
    });

    expect(getNextLoanPaymentDeadline(paidOff)).toBeNull();
    expect(getNextLoanPaymentDeadline(zeroBalance)).toBeNull();
  });

  it("falls back to maturity date when schedule is empty", () => {
    const loan = createLoan({
      loanTermMonths: 0,
      maturityDate: "2025-06-15",
      amortizationSchedule: [],
    });

    const deadline = getNextLoanPaymentDeadline(loan);

    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2025-06-15");
    expect(deadline?.paymentAmount).toBe(10_000);
  });

  it("sorts borrowed and lent deadlines separately with overdue first", () => {
    const loans: Loan[] = [
      createLoan({
        id: "borrowed-overdue",
        loanType: "borrowed",
        entityName: "Overdue lender",
        amortizationSchedule: [
          {
            paymentDate: "2024-01-01",
            beginningBalance: 10_000,
            paymentAmount: 500,
            principalPayment: 400,
            interestPayment: 100,
            endingBalance: 9_600,
            isActual: false,
          },
        ],
      }),
      createLoan({
        id: "borrowed-future",
        loanType: "borrowed",
        entityName: "Future lender",
        amortizationSchedule: [
          {
            paymentDate: "2030-01-01",
            beginningBalance: 10_000,
            paymentAmount: 500,
            principalPayment: 400,
            interestPayment: 100,
            endingBalance: 9_600,
            isActual: false,
          },
        ],
      }),
      createLoan({
        id: "lent-future",
        loanType: "lent",
        entityName: "Borrower",
        amortizationSchedule: [
          {
            paymentDate: "2026-06-01",
            beginningBalance: 5_000,
            paymentAmount: 250,
            principalPayment: 200,
            interestPayment: 50,
            endingBalance: 4_800,
            isActual: false,
          },
        ],
      }),
    ];

    const borrowed = getUpcomingLoanDeadlines(loans, "borrowed");
    const lent = getUpcomingLoanDeadlines(loans, "lent");

    expect(borrowed.map((item) => item.loan.id)).toEqual([
      "borrowed-overdue",
      "borrowed-future",
    ]);
    expect(borrowed[0]?.isOverdue).toBe(true);
    expect(lent.map((item) => item.loan.id)).toEqual(["lent-future"]);
  });

  it("formats due labels relative to a reference date", () => {
    const referenceDate = new Date("2024-03-01T12:00:00");

    expect(
      formatLoanDueLabel(new Date("2024-03-01"), false, referenceDate),
    ).toBe("Due today");
    expect(
      formatLoanDueLabel(new Date("2024-03-02"), false, referenceDate),
    ).toBe("Due tomorrow");
    expect(
      formatLoanDueLabel(new Date("2024-02-28"), true, referenceDate),
    ).toBe("Overdue by 2 days");
  });
});
