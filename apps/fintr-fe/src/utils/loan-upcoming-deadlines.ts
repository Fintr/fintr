import { Loan } from "@/services/loans/queries";
import {
  getAmortizationSchedule,
  type PaymentScheduleItem,
} from "@/utils/loanAmortization";
import { parseLoanPaymentAmount } from "@/utils/loan-payment-amounts";

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

type ActualPaymentSnapshot = {
  date: Date;
  totalPayment: number;
};

const collectCoveringPayments = (
  loan: Loan,
  schedule: PaymentScheduleItem[],
): ActualPaymentSnapshot[] => {
  const actualScheduleDays = new Set(
    schedule
      .filter((item) => item.isActual)
      .map((item) => startOfDay(item.paymentDate).getTime()),
  );

  return (loan.loanPayments ?? [])
    .map((payment) => ({
      date: new Date(payment.date),
      totalPayment: parseLoanPaymentAmount(payment.totalPayment),
    }))
    .filter(
      (payment) => !actualScheduleDays.has(startOfDay(payment.date).getTime()),
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());
};

const findNextUnpaidInstallment = (
  schedule: PaymentScheduleItem[],
  coveringPayments: ActualPaymentSnapshot[],
): PaymentScheduleItem | null => {
  const unpaid = schedule
    .filter((item) => !item.isActual)
    .sort(
      (left, right) =>
        left.paymentDate.getTime() - right.paymentDate.getTime(),
    );

  if (unpaid.length === 0) {
    return null;
  }

  const remainingPayments = [...coveringPayments];

  for (const installment of unpaid) {
    const coveringIndex = remainingPayments.findIndex(
      (actual) => actual.totalPayment >= installment.paymentAmount - 0.02,
    );

    if (coveringIndex >= 0) {
      remainingPayments.splice(coveringIndex, 1);
      continue;
    }

    return installment;
  }

  return null;
};

export const getNextLoanPaymentDeadline = (
  loan: Loan,
): LoanUpcomingDeadline | null => {
  if (!isActiveLoanWithBalance(loan)) {
    return null;
  }

  const today = startOfDay(new Date());
  const schedule = getAmortizationSchedule(loan);
  const coveringPayments = collectCoveringPayments(loan, schedule);
  const nextInstallment = findNextUnpaidInstallment(schedule, coveringPayments);

  if (nextInstallment) {
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

export const getFeaturedUpcomingLoanIds = (
  loans: Loan[],
  options?: {
    loanType?: "borrowed" | "lent";
    limit?: number;
  },
): Set<string> => {
  const loanTypes =
    options?.loanType != null
      ? [options.loanType]
      : (["borrowed", "lent"] as const);
  const ids = new Set<string>();

  for (const loanType of loanTypes) {
    for (const deadline of getUpcomingLoanDeadlines(loans, loanType, {
      limit: options?.limit,
    })) {
      ids.add(deadline.loan.id);
    }
  }

  return ids;
};

export const excludeLoansById = (
  loans: Loan[],
  excludedLoanIds: Set<string>,
): Loan[] => {
  if (excludedLoanIds.size === 0) {
    return loans;
  }

  return loans.filter((loan) => !excludedLoanIds.has(loan.id));
};

export const compareActiveLoansByNextDueDate = (
  left: Loan,
  right: Loan,
): number => {
  if (left.status === "defaulted" && right.status !== "defaulted") {
    return -1;
  }

  if (right.status === "defaulted" && left.status !== "defaulted") {
    return 1;
  }

  const leftDeadline = getNextLoanPaymentDeadline(left);
  const rightDeadline = getNextLoanPaymentDeadline(right);

  if (!leftDeadline && !rightDeadline) {
    return new Date(right.date).getTime() - new Date(left.date).getTime();
  }

  if (!leftDeadline) {
    return 1;
  }

  if (!rightDeadline) {
    return -1;
  }

  if (leftDeadline.isOverdue !== rightDeadline.isOverdue) {
    return leftDeadline.isOverdue ? -1 : 1;
  }

  const dueDiff =
    leftDeadline.dueDate.getTime() - rightDeadline.dueDate.getTime();

  if (dueDiff !== 0) {
    return dueDiff;
  }

  return left.entityName.localeCompare(right.entityName);
};

const sortCompletedLoans = (left: Loan, right: Loan): number => {
  const leftDate = left.paidOffDate
    ? new Date(left.paidOffDate).getTime()
    : new Date(left.date).getTime();
  const rightDate = right.paidOffDate
    ? new Date(right.paidOffDate).getTime()
    : new Date(right.date).getTime();

  return rightDate - leftDate;
};

export const partitionAndSortLoans = (
  loans: Loan[],
  options?: {
    includeCompleted?: boolean;
    loanType?: "borrowed" | "lent";
  },
): { activeLoans: Loan[]; completedLoans: Loan[] } => {
  const includeCompleted = options?.includeCompleted ?? true;
  const active: Loan[] = [];
  const completed: Loan[] = [];

  for (const loan of loans) {
    if (options?.loanType && loan.loanType !== options.loanType) {
      continue;
    }

    if (loan.status === "paid_off") {
      completed.push(loan);
      continue;
    }

    active.push(loan);
  }

  active.sort(compareActiveLoansByNextDueDate);
  completed.sort(sortCompletedLoans);

  return {
    activeLoans: active,
    completedLoans: includeCompleted ? completed : [],
  };
};
