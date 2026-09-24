import type { Loan } from "@/services/loans/queries";

export const formatLoanStatusLabel = (status: Loan["status"]): string => {
  if (status === "defaulted") {
    return "Retired";
  }

  if (status === "paid_off") {
    return "Paid off";
  }

  return "Active";
};

export const canRecordLoanPayment = (status: Loan["status"]): boolean =>
  status === "active";

export const isRetiredLoan = (status: Loan["status"]): boolean =>
  status === "defaulted";

export const isCompletedLoanStatus = (status: Loan["status"]): boolean =>
  status === "paid_off" || status === "defaulted";
