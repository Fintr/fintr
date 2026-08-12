import type { LoanListFilter } from "@/components/dashboard/tabs/loans/loan-list-filter";

type AllLoansSectionCopy = {
  title: string;
  description: string;
  emptyMessage?: string;
};

export const getAllLoansSectionCopy = (
  loanFilter: LoanListFilter,
  options: {
    hasFeaturedUpcoming: boolean;
    hasRemainingLoans: boolean;
  },
): AllLoansSectionCopy => {
  const title =
    loanFilter === "borrowed"
      ? "All borrowed loans"
      : loanFilter === "lent"
        ? "All lent loans"
        : "All loans";

  if (options.hasFeaturedUpcoming && !options.hasRemainingLoans) {
    return {
      title,
      description: "Due-soon loans appear above",
      emptyMessage: "All active loans are listed above.",
    };
  }

  if (options.hasFeaturedUpcoming) {
    return {
      title: options.hasRemainingLoans ? "Other loans" : title,
      description:
        loanFilter === "borrowed"
          ? "Active loans you owe that are not shown in due soon above"
          : loanFilter === "lent"
            ? "Active loans owed to you that are not shown in due soon above"
            : "Active loans not shown in due soon above",
    };
  }

  return {
    title,
    description:
      loanFilter === "borrowed"
        ? "Every active loan you owe"
        : loanFilter === "lent"
          ? "Every active loan owed to you"
          : "Every active loan in this space",
  };
};
