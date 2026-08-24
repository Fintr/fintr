import { Loan } from "@/services/loans/queries";
import { parseLoanPaymentAmount } from "@/utils/loan-payment-amounts";

export interface PaymentScheduleItem {
  paymentDate: Date;
  beginningBalance: number;
  paymentAmount: number;
  principalPayment: number;
  interestPayment: number;
  endingBalance: number;
  isActual?: boolean;
  paidOnDate?: Date;
}

const roundCents = (amount: number): number =>
  Math.round(amount * 100) / 100;

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

const addMonths = (date: Date, months: number): Date => {
  const next = startOfDay(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const daysBetween = (startDate: Date, endDate: Date): number => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const sortedLoanPayments = (loan: Loan) =>
  [...(loan.loanPayments ?? [])].sort((left, right) => {
    const dateDiff =
      startOfDay(new Date(left.date)).getTime() -
      startOfDay(new Date(right.date)).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.id.localeCompare(right.id);
  });

export const getAmortizationSchedule = (
  loan: Loan,
  payments: Loan["loanPayments"] = loan.loanPayments,
): PaymentScheduleItem[] => {
  return calculateAmortizationSchedule({
    ...loan,
    loanPayments: payments,
  });
};

const calculateAmortizationSchedule = (loan: Loan): PaymentScheduleItem[] => {
  const schedule: PaymentScheduleItem[] = [];
  const startDate = startOfDay(new Date(loan.date));

  const principalAmount = parseAmount(loan.principalAmount);
  const interestRate = parseAmount(loan.interestRate);
  const termMonths =
    typeof loan.loanTermMonths === "string"
      ? parseInt(loan.loanTermMonths, 10)
      : loan.loanTermMonths;

  const annualRate = interestRate / 100;
  const monthlyRate = annualRate / 12;
  const dailyRate = annualRate / 365;

  if (
    principalAmount <= 0 ||
    termMonths <= 0 ||
    isNaN(principalAmount) ||
    isNaN(interestRate) ||
    isNaN(termMonths)
  ) {
    return schedule;
  }

  let fixedMonthlyPayment = 0;
  if (monthlyRate > 0) {
    const r = monthlyRate;
    const n = termMonths;
    const P = principalAmount;
    const numerator = r * Math.pow(1 + r, n);
    const denominator = Math.pow(1 + r, n) - 1;
    fixedMonthlyPayment = P * (numerator / denominator);
  } else {
    fixedMonthlyPayment = principalAmount / termMonths;
  }

  const roundedFixedPayment = roundCents(fixedMonthlyPayment);
  const remainingPayments = sortedLoanPayments(loan);
  let remainingBalance = principalAmount;
  let lastInterestDate = startDate;

  for (let paymentNum = 0; paymentNum < termMonths; paymentNum++) {
    if (remainingBalance <= 0.01) {
      break;
    }

    const paymentDate = addMonths(startDate, paymentNum + 1);
    const beginningBalance = roundCents(remainingBalance);
    const days = daysBetween(lastInterestDate, paymentDate);
    const projectedInterest = roundCents(beginningBalance * dailyRate * days);
    const installmentTarget = roundCents(
      Math.min(
        roundedFixedPayment,
        beginningBalance + projectedInterest,
      ),
    );
    const projectedPrincipal = roundCents(
      Math.max(0, installmentTarget - projectedInterest),
    );

    const coveringIndex = remainingPayments.findIndex(
      (payment) =>
        roundCents(parseLoanPaymentAmount(payment.totalPayment)) >=
        installmentTarget - 0.02,
    );

    if (coveringIndex >= 0) {
      const payment = remainingPayments.splice(coveringIndex, 1)[0]!;
      const principalPayment = roundCents(
        parseLoanPaymentAmount(payment.principalPayment),
      );
      const interestPayment = roundCents(
        parseLoanPaymentAmount(payment.interestPayment),
      );
      const paymentAmount = roundCents(
        parseLoanPaymentAmount(payment.totalPayment),
      );
      const endingBalance = roundCents(
        Math.max(0, beginningBalance - principalPayment),
      );

      schedule.push({
        paymentDate,
        beginningBalance,
        paymentAmount,
        principalPayment,
        interestPayment,
        endingBalance,
        isActual: true,
        paidOnDate: startOfDay(new Date(payment.date)),
      });

      remainingBalance = endingBalance;
      lastInterestDate = paymentDate;
      continue;
    }

    const endingBalance = roundCents(
      Math.max(0, beginningBalance - projectedPrincipal),
    );

    schedule.push({
      paymentDate,
      beginningBalance,
      paymentAmount: installmentTarget,
      principalPayment: projectedPrincipal,
      interestPayment: projectedInterest,
      endingBalance,
      isActual: false,
    });

    remainingBalance = endingBalance;
    lastInterestDate = paymentDate;
  }

  return schedule;
};
