import { Loan } from "@/services/loans/queries";
import { getAmortizationSchedule } from "@/utils/loanAmortization";

export type LoanUpcomingDeadline = {
  loan: Loan;
  dueDate: Date;
  paymentAmount: number;
  isOverdue: boolean;
};

const startOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const parseAmount = (value: number | string): number => {
  if (typeof value === "string") {
    return parseFloat(value);
  }

  return value;
};

export const isActiveLoanWithBalance = (loan: Loan): boolean => {
  if (loan.status !== "active") {
    return false;
  }

  return parseAmount(loan.outstandingBalance) > 0.01;
};

export const formatLoanDueLabel = (
  dueDate: Date,
  isOverdue: boolean,
  referenceDate: Date = new Date(),
): string => {
  const today = startOfDay(referenceDate);
  const due = startOfDay(dueDate);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return "Due today";
  }

  if (diffDays === 1) {
    return "Due tomorrow";
  }

  if (isOverdue) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays === 1
      ? "Overdue by 1 day"
      : `Overdue by ${overdueDays} days`;
  }

  return diffDays === 1 ? "Due in 1 day" : `Due in ${diffDays} days`;
};

export const getNextLoanPaymentDeadline = (
  loan: Loan,
): LoanUpcomingDeadline | null => {
  if (!isActiveLoanWithBalance(loan)) {
    return null;
  }

  const today = startOfDay(new Date());
  const schedule = getAmortizationSchedule(loan);
  const unpaidInstallments = schedule
    .filter((item) => !item.isActual)
    .sort(
      (left, right) =>
        left.paymentDate.getTime() - right.paymentDate.getTime(),
    );

  if (unpaidInstallments.length > 0) {
    const nextInstallment = unpaidInstallments[0];
    const dueDate = startOfDay(nextInstallment.paymentDate);

    return {
      loan,
      dueDate,
      paymentAmount: nextInstallment.paymentAmount,
      isOverdue: dueDate < today,
    };
  }

  if (schedule.length === 0) {
    const maturityDate = startOfDay(new Date(loan.maturityDate));
    if (Number.isNaN(maturityDate.getTime())) {
      return null;
    }

    return {
      loan,
      dueDate: maturityDate,
      paymentAmount: parseAmount(loan.outstandingBalance),
      isOverdue: maturityDate < today,
    };
  }

  const maturityDate = startOfDay(new Date(loan.maturityDate));
  const outstandingBalance = parseAmount(loan.outstandingBalance);

  if (outstandingBalance <= 0.01 || Number.isNaN(maturityDate.getTime())) {
    return null;
  }

  return {
    loan,
    dueDate: maturityDate,
    paymentAmount: outstandingBalance,
    isOverdue: maturityDate < today,
  };
};

export const getUpcomingLoanDeadlines = (
  loans: Loan[],
  loanType: "borrowed" | "lent",
  options?: { limit?: number },
): LoanUpcomingDeadline[] => {
  const limit = options?.limit ?? 5;

  return loans
    .filter((loan) => loan.loanType === loanType)
    .map((loan) => getNextLoanPaymentDeadline(loan))
    .filter((deadline): deadline is LoanUpcomingDeadline => deadline !== null)
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1;
      }

      return left.dueDate.getTime() - right.dueDate.getTime();
    })
    .slice(0, limit);
};
