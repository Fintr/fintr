import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import { parseLoanPaymentAmount } from "@/utils/loan-payment-amounts";

const parseAmount = (value: number | string): number => {
  if (typeof value === "string") {
    return parseFloat(value);
  }

  return value;
};

const toEmbeddedLoanPayment = (
  payment: LoanPayment,
): NonNullable<Loan["loanPayments"]>[number] => ({
  id: payment.id,
  date: payment.date,
  principalPayment: payment.principalPayment,
  interestPayment: payment.interestPayment,
  totalPayment: payment.totalPayment,
  currency: payment.currency,
  adjustsAccountBalance: payment.adjustsAccountBalance,
});

/**
 * Derives outstanding balance and embedded payments on a loan snapshot after
 * payments change locally, before the server broadcasts loan.updated.
 */
export const patchLoanFromPayments = (
  loan: Loan,
  payments: LoanPayment[],
): Loan => {
  const principalAmount = parseAmount(loan.principalAmount);
  const principalPaid = payments.reduce(
    (sum, payment) =>
      sum + parseLoanPaymentAmount(payment.principalPayment),
    0,
  );
  const outstandingBalance =
    Math.round(Math.max(0, principalAmount - principalPaid) * 100) / 100;

  const nextStatus =
    outstandingBalance <= 0.01 && loan.status === "active"
      ? "paid_off"
      : loan.status;

  return {
    ...loan,
    outstandingBalance,
    status: nextStatus,
    paidOffDate:
      nextStatus === "paid_off" ? loan.paidOffDate ?? new Date().toISOString().slice(0, 10) : loan.paidOffDate,
    loanPayments: payments.map(toEmbeddedLoanPayment),
  };
};
