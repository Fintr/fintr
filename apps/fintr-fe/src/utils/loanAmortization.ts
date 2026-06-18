import { Loan } from "@/services/loans/queries";

export interface PaymentScheduleItem {
  paymentDate: Date;
  beginningBalance: number;
  paymentAmount: number;
  principalPayment: number;
  interestPayment: number;
  endingBalance: number;
  isActual?: boolean;
}

export const getAmortizationSchedule = (loan: Loan): PaymentScheduleItem[] => {
  if (loan.amortizationSchedule && loan.amortizationSchedule.length > 0) {
    return loan.amortizationSchedule.map((item) => ({
      paymentDate: new Date(item.paymentDate),
      beginningBalance:
        typeof item.beginningBalance === "string"
          ? parseFloat(item.beginningBalance)
          : item.beginningBalance,
      paymentAmount:
        typeof item.paymentAmount === "string"
          ? parseFloat(item.paymentAmount)
          : item.paymentAmount,
      principalPayment:
        typeof item.principalPayment === "string"
          ? parseFloat(item.principalPayment)
          : item.principalPayment,
      interestPayment:
        typeof item.interestPayment === "string"
          ? parseFloat(item.interestPayment)
          : item.interestPayment,
      endingBalance:
        typeof item.endingBalance === "string"
          ? parseFloat(item.endingBalance)
          : item.endingBalance,
      isActual: item.isActual || false,
    }));
  }

  return calculateAmortizationSchedule(loan);
};

const calculateAmortizationSchedule = (loan: Loan): PaymentScheduleItem[] => {
  const schedule: PaymentScheduleItem[] = [];
  const startDate = new Date(loan.date);

  const principalAmount =
    typeof loan.principalAmount === "string"
      ? parseFloat(loan.principalAmount)
      : loan.principalAmount;
  const interestRate =
    typeof loan.interestRate === "string"
      ? parseFloat(loan.interestRate)
      : loan.interestRate;
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

  let remainingBalance = principalAmount;

  const firstPaymentDate = new Date(startDate);
  firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
  firstPaymentDate.setHours(0, 0, 0, 0);

  let currentPaymentDate = new Date(firstPaymentDate);
  const roundedFixedPayment = Math.round(fixedMonthlyPayment * 100) / 100;

  for (let paymentNum = 0; paymentNum < termMonths; paymentNum++) {
    const beginningBalance = Math.round(remainingBalance * 100) / 100;

    const previousPaymentDate =
      paymentNum === 0
        ? new Date(startDate)
        : (() => {
            const prev = new Date(currentPaymentDate);
            prev.setMonth(prev.getMonth() - 1);
            return prev;
          })();

    const daysBetween = Math.round(
      (currentPaymentDate.getTime() - previousPaymentDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const interestPaymentCalc = beginningBalance * dailyRate * daysBetween;
    const interestPayment = Math.round(interestPaymentCalc * 100) / 100;

    let principalPayment = 0;
    let actualPaymentAmount = 0;
    const isLastPayment = paymentNum === termMonths - 1;

    if (isLastPayment) {
      principalPayment = beginningBalance;
      actualPaymentAmount =
        Math.round((principalPayment + interestPayment) * 100) / 100;
    } else {
      actualPaymentAmount = roundedFixedPayment;
      principalPayment = actualPaymentAmount - interestPayment;
      principalPayment = Math.round(principalPayment * 100) / 100;

      if (principalPayment > beginningBalance) {
        principalPayment = beginningBalance;
        actualPaymentAmount =
          Math.round((principalPayment + interestPayment) * 100) / 100;
      }
    }

    const endingBalance = beginningBalance - principalPayment;
    const roundedEndingBalance = Math.max(
      0,
      Math.round(endingBalance * 100) / 100,
    );

    schedule.push({
      paymentDate: new Date(currentPaymentDate),
      beginningBalance,
      paymentAmount: actualPaymentAmount,
      principalPayment,
      interestPayment,
      endingBalance: roundedEndingBalance,
    });

    remainingBalance = roundedEndingBalance;
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);

    if (remainingBalance <= 0.01) {
      break;
    }
  }

  return schedule;
};
