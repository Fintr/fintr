export const PAYDOWN_MILESTONES = [25, 50, 75, 100] as const;

export type PaydownMilestone = (typeof PAYDOWN_MILESTONES)[number];

export type LoanPaydownStatus = "active" | "paid_off" | "defaulted";

export const parseLoanPrincipalAmount = (
  principalAmount: number | string,
): number => {
  if (typeof principalAmount === "string") {
    return parseFloat(principalAmount);
  }

  return principalAmount;
};

export const parseLoanOutstandingBalance = (
  outstandingBalance: number | string,
): number => {
  if (typeof outstandingBalance === "string") {
    return parseFloat(outstandingBalance);
  }

  return outstandingBalance;
};

export const getLoanPaydownPercent = (
  principalAmount: number,
  outstandingBalance: number,
  status: LoanPaydownStatus,
): number => {
  if (status === "paid_off") {
    return 100;
  }

  if (principalAmount <= 0) {
    return 0;
  }

  const principalPaid = Math.max(0, principalAmount - outstandingBalance);

  return Math.min(
    100,
    Math.round((principalPaid / principalAmount) * 100),
  );
};

export const getCrossedPaydownMilestone = (
  beforePercent: number,
  afterPercent: number,
): PaydownMilestone | null => {
  const milestones = [...PAYDOWN_MILESTONES].reverse();

  for (const milestone of milestones) {
    if (beforePercent < milestone && afterPercent >= milestone) {
      return milestone;
    }
  }

  return null;
};

export const getPaydownMilestoneMessage = (
  milestone: PaydownMilestone,
  formattedRemainingBalance?: string,
): string => {
  switch (milestone) {
    case 25:
      return "Quarter of the way there — keep it up!";
    case 50:
      return formattedRemainingBalance
        ? `Halfway there — ${formattedRemainingBalance} remaining`
        : "Halfway there — you're making great progress!";
    case 75:
      return "Almost done — 75% of principal is paid off";
    case 100:
      return "Loan paid off — well done!";
  }
};
