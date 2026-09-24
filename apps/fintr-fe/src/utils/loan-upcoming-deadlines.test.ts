import { describe, expect, it } from "vitest";
import { Loan } from "@/services/loans/queries";
import {
  compareActiveLoansByNextDueDate,
  excludeLoansById,
  formatLoanDueLabel,
  getFeaturedUpcomingLoanIds,
  getNextLoanPaymentDeadline,
  getUpcomingLoanDeadlines,
  partitionAndSortLoans,
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
  interestRate: 0,
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
      loanPayments: [
        {
          id: "payment-1",
          date: "2024-02-01",
          principalPayment: 1_000,
          interestPayment: 0,
          totalPayment: 1_000,
          currency: "PHP",
        },
      ],
    });

    const deadline = getNextLoanPaymentDeadline(loan);

    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2024-03-01");
    expect(deadline?.paymentAmount).toBe(1_000);
    expect(deadline?.interestPayment).toBe(0);
    expect(deadline?.principalPayment).toBe(1_000);
  });

  it("advances past a future installment after an early payment of that amount", () => {
    const loan = createLoan({
      entityName: "Bdo",
      date: "2026-08-11",
      maturityDate: "2027-08-11",
      outstandingBalance: 134.75,
      principalAmount: 147,
      loanPayments: [
        {
          id: "payment-1",
          date: "2026-08-14",
          principalPayment: 12.25,
          interestPayment: 0,
          totalPayment: 12.25,
          currency: "PLN",
        },
      ],
    });

    const deadline = getNextLoanPaymentDeadline(loan);

    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2026-10-11");
    expect(deadline?.paymentAmount).toBe(12.25);
  });

  it("advances past overdue projected installments after a catch-up payment", () => {
    const loan = createLoan({
      entityName: "Jerry Oquendo",
      date: "2026-06-18",
      maturityDate: "2027-06-18",
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
    });

    const deadline = getNextLoanPaymentDeadline(loan);

    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2026-08-18");
    expect(deadline?.paymentAmount).toBe(1_000);
  });

  it("keeps overdue installment visible when catch-up payment is partial", () => {
    const loan = createLoan({
      date: "2026-06-18",
      maturityDate: "2027-06-18",
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
    });

    const deadline = getNextLoanPaymentDeadline(loan);

    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2026-07-18");
    expect(deadline?.isOverdue).toBe(true);
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
        date: "2023-12-01",
        maturityDate: "2024-12-01",
      }),
      createLoan({
        id: "borrowed-future",
        loanType: "borrowed",
        entityName: "Future lender",
        date: "2029-12-01",
        maturityDate: "2030-12-01",
      }),
      createLoan({
        id: "lent-future",
        loanType: "lent",
        entityName: "Borrower",
        date: "2026-05-01",
        maturityDate: "2027-05-01",
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

  it("sorts active loans with overdue deadlines first", () => {
    const loans: Loan[] = [
      createLoan({
        id: "future-loan",
        entityName: "Future lender",
        date: "2029-12-01",
        maturityDate: "2030-12-01",
      }),
      createLoan({
        id: "overdue-loan",
        entityName: "Overdue lender",
        date: "2023-12-01",
        maturityDate: "2024-12-01",
      }),
    ];

    const sorted = [...loans].sort(compareActiveLoansByNextDueDate);

    expect(sorted.map((loan) => loan.id)).toEqual([
      "overdue-loan",
      "future-loan",
    ]);
  });

  it("partitions active and completed loans while sorting by next due date", () => {
    const loans: Loan[] = [
      createLoan({
        id: "completed-loan",
        status: "paid_off",
        outstandingBalance: 0,
      }),
      createLoan({
        id: "active-loan",
      }),
    ];

    const { activeLoans, completedLoans } = partitionAndSortLoans(loans);

    expect(activeLoans.map((loan) => loan.id)).toEqual(["active-loan"]);
    expect(completedLoans.map((loan) => loan.id)).toEqual(["completed-loan"]);
  });

  it("groups retired loans with completed loans", () => {
    const loans: Loan[] = [
      createLoan({ id: "active-loan", status: "active" }),
      createLoan({
        id: "retired-loan",
        status: "defaulted",
        outstandingBalance: 4_000,
      }),
    ];

    const { activeLoans, completedLoans } = partitionAndSortLoans(loans);

    expect(activeLoans.map((loan) => loan.id)).toEqual(["active-loan"]);
    expect(completedLoans.map((loan) => loan.id)).toEqual(["retired-loan"]);
  });

  it("collects loan ids shown in featured upcoming sections", () => {
    const loans: Loan[] = [
      createLoan({
        id: "borrowed-upcoming",
        loanType: "borrowed",
      }),
    ];

    const featuredIds = getFeaturedUpcomingLoanIds(loans, { loanType: "borrowed" });

    expect([...featuredIds]).toEqual(["borrowed-upcoming"]);
  });

  it("excludes featured upcoming loans from the all-loans list", () => {
    const loans: Loan[] = [
      createLoan({ id: "featured-loan" }),
      createLoan({ id: "other-loan" }),
    ];
    const featuredIds = new Set(["featured-loan"]);

    expect(excludeLoansById(loans, featuredIds).map((loan) => loan.id)).toEqual([
      "other-loan",
    ]);
  });
});
