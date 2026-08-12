import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import { parseLoanPaymentAmount } from "@/utils/loan-payment-amounts";

export type LoanPaymentSplit = {
  interestPayment: number;
  principalPayment: number;
  totalPayment: number;
};

export type CalculateLoanPaymentSplitParams = {
  loan: Pick<Loan, "date" | "principalAmount" | "interestRate">;
  paymentDate: Date;
  totalPayment: number;
  existingPayments: Array<
    Pick<LoanPayment, "id" | "date" | "principalPayment" | "interestPayment">
  >;
  excludePaymentId?: string;
};

const parseAmount = (value: number | string): number => {
  if (typeof value === "string") {
    return parseFloat(value);
  }

  return value;
};

const startOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const daysBetween = (startDate: Date, endDate: Date): number => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const roundCents = (amount: number): number =>
  Math.round(amount * 100) / 100;

const paymentDateKey = (date: string | Date): string => {
  const normalized = typeof date === "string" ? new Date(date) : date;
  return startOfDay(normalized).toISOString().slice(0, 10);
};

const isBeforePaymentDate = (
  payment: Pick<LoanPayment, "date">,
  paymentDate: Date,
): boolean => paymentDateKey(payment.date) < paymentDateKey(paymentDate);

const isOnPaymentDate = (
  payment: Pick<LoanPayment, "date">,
  paymentDate: Date,
): boolean => paymentDateKey(payment.date) === paymentDateKey(paymentDate);

const filterPayments = (
  payments: CalculateLoanPaymentSplitParams["existingPayments"],
  paymentDate: Date,
  excludePaymentId: string | undefined,
  matcher: (payment: Pick<LoanPayment, "date">, date: Date) => boolean,
) =>
  payments.filter(
    (payment) =>
      (!excludePaymentId || payment.id !== excludePaymentId) &&
      matcher(payment, paymentDate),
  );

/**
 * Mirrors backend CalculateLoanPaymentInterest + principal split for UI preview.
 */
export const calculateLoanPaymentSplit = ({
  loan,
  paymentDate,
  totalPayment,
  existingPayments,
  excludePaymentId,
}: CalculateLoanPaymentSplitParams): LoanPaymentSplit | null => {
  if (!Number.isFinite(totalPayment) || totalPayment <= 0) {
    return null;
  }

  const principalAmount = parseAmount(loan.principalAmount);
  const interestRate = parseAmount(loan.interestRate);

  if (
    principalAmount <= 0 ||
    !Number.isFinite(interestRate) ||
    Number.isNaN(paymentDate.getTime())
  ) {
    return null;
  }

  const paymentsBeforeDate = filterPayments(
    existingPayments,
    paymentDate,
    excludePaymentId,
    isBeforePaymentDate,
  );

  const lastPaymentBeforeDate = [...paymentsBeforeDate].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();
    return rightTime - leftTime;
  })[0];

  const startDate = lastPaymentBeforeDate
    ? new Date(lastPaymentBeforeDate.date)
    : new Date(loan.date);

  const principalPaidBefore = paymentsBeforeDate.reduce(
    (sum, payment) => sum + parseLoanPaymentAmount(payment.principalPayment),
    0,
  );

  const balanceAtStart = Math.max(0, principalAmount - principalPaidBefore);
  const days = daysBetween(startDate, paymentDate);
  const dailyRate = interestRate / 100 / 365;
  const interestForPeriod = roundCents(balanceAtStart * dailyRate * days);

  const interestAlreadyPaid = filterPayments(
    existingPayments,
    paymentDate,
    excludePaymentId,
    isOnPaymentDate,
  ).reduce(
    (sum, payment) => sum + parseLoanPaymentAmount(payment.interestPayment),
    0,
  );

  const interestPayment = roundCents(
    Math.max(0, interestForPeriod - interestAlreadyPaid),
  );
  const principalPayment = roundCents(
    Math.max(0, totalPayment - interestPayment),
  );

  return {
    interestPayment,
    principalPayment,
    totalPayment: roundCents(totalPayment),
  };
};
