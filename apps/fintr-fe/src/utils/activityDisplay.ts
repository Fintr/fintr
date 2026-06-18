import {
  ActivitiesTypeEnum,
  CombinedTransactionTypeEnum,
  IndexActivity,
} from "@/types/transactionTypes";

/** Whether a row should use income-style (teal) coloring vs expense-style (red). */
export const activityPresentsAsIncome = (
  activity: IndexActivity | { type: string; loanType?: "borrowed" | "lent" },
): boolean => {
  if (activity.type === ActivitiesTypeEnum.INCOME || activity.type === CombinedTransactionTypeEnum.INCOME) {
    return true;
  }

  if (activity.type === ActivitiesTypeEnum.EXPENSE || activity.type === CombinedTransactionTypeEnum.EXPENSE) {
    return false;
  }

  if (
    activity.type === ActivitiesTypeEnum.LOAN_DISBURSEMENT ||
    activity.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT
  ) {
    return activity.loanType === "borrowed";
  }

  if (
    activity.type === ActivitiesTypeEnum.LOAN_PAYMENT ||
    activity.type === CombinedTransactionTypeEnum.LOAN_PAYMENT
  ) {
    return activity.loanType === "lent";
  }

  return false;
};

export const activityPresentsAsTransfer = (
  activity: IndexActivity | { type: string },
): boolean =>
  activity.type === ActivitiesTypeEnum.TRANSFER ||
  activity.type === CombinedTransactionTypeEnum.TRANSFER;

export const activityRowIsEditable = (
  activity: IndexActivity | { hasLoanPayment?: boolean; isLoanActivity?: boolean },
): boolean =>
  !activity.hasLoanPayment && !activity.isLoanActivity;

export const activityRecordId = (activity: IndexActivity): string =>
  activity.activitableId ?? activity.id;

export const activityCategoryLine = (
  activity: IndexActivity | {
    isLoanActivity?: boolean;
    type: string;
    loanType?: "borrowed" | "lent";
    categoryName: string;
    subcategoryName?: string | null;
  },
): string => {
  if (activity.isLoanActivity) {
    if (
      activity.type === ActivitiesTypeEnum.LOAN_DISBURSEMENT ||
      activity.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT
    ) {
      return activity.loanType === "borrowed" ? "Loan received" : "Loan given";
    }
    return "Loan payment";
  }

  const subcategoryName = activity.subcategoryName?.trim();
  if (subcategoryName) {
    return `${activity.categoryName} › ${subcategoryName}`;
  }

  return activity.categoryName;
};
