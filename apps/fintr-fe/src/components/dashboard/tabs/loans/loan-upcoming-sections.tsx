import React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Loan } from "@/services/loans/queries";
import { formatCurrency } from "@/lib/utils";
import {
  formatLoanDueLabel,
  getUpcomingLoanDeadlines,
  LoanUpcomingDeadline,
} from "@/utils/loan-upcoming-deadlines";

type LoanUpcomingSectionsProps = {
  loans: Loan[];
};

type DeadlineSectionProps = {
  title: string;
  description: string;
  deadlines: LoanUpcomingDeadline[];
  accentClass: string;
  textClass: string;
  onOpenLoan: (loanId: string) => void;
};

const formatDueDate = (dueDate: Date): string => {
  return dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const DeadlineSection = ({
  title,
  description,
  deadlines,
  accentClass,
  textClass,
  onOpenLoan,
}: DeadlineSectionProps) => {
  if (deadlines.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="space-y-2">
        {deadlines.map((deadline) => (
          <button
            key={deadline.loan.id}
            type="button"
            onClick={() => onOpenLoan(deadline.loan.id)}
            className="flex w-full min-h-[72px] items-center justify-between rounded bg-white p-3 text-left transition-colors hover:bg-gray-100 dark:bg-card dark:hover:bg-accent/50"
          >
            <div
              className={`mr-3 w-1 flex-shrink-0 self-stretch rounded ${accentClass}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-medium text-primary">
                  {deadline.loan.entityName}
                </h4>
                <span className={`flex-shrink-0 text-sm font-semibold ${textClass}`}>
                  {formatCurrency(
                    deadline.paymentAmount,
                    deadline.loan.outstandingBalanceCurrency,
                  )}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {formatDueDate(deadline.dueDate)}
                </span>
                <span
                  className={
                    deadline.isOverdue
                      ? "inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400"
                      : "font-medium text-gray-700 dark:text-foreground"
                  }
                >
                  {deadline.isOverdue ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : null}
                  {formatLoanDueLabel(deadline.dueDate, deadline.isOverdue)}
                </span>
                <span className="text-gray-500 dark:text-muted-foreground">
                  Balance:{" "}
                  {formatCurrency(
                    deadline.loan.outstandingBalance,
                    deadline.loan.outstandingBalanceCurrency,
                  )}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export const LoanUpcomingSections = ({ loans }: LoanUpcomingSectionsProps) => {
  const router = useRouter();

  const upcomingPayments = React.useMemo(
    () => getUpcomingLoanDeadlines(loans, "borrowed"),
    [loans],
  );

  const upcomingReceivables = React.useMemo(
    () => getUpcomingLoanDeadlines(loans, "lent"),
    [loans],
  );

  if (upcomingPayments.length === 0 && upcomingReceivables.length === 0) {
    return null;
  }

  const openLoan = (loanId: string) => {
    router.push(`/dashboard/loans/detail?loanId=${loanId}`);
  };

  return (
    <div className="mb-2">
      <DeadlineSection
        title="Next loans to pay"
        description="Upcoming payments on money you borrowed"
        deadlines={upcomingPayments}
        accentClass="bg-red-900"
        textClass="text-red-900 dark:text-red-700"
        onOpenLoan={openLoan}
      />
      <DeadlineSection
        title="Payments due to you"
        description="When others should pay back loans you lent"
        deadlines={upcomingReceivables}
        accentClass="bg-teal-600"
        textClass="text-teal-600 dark:text-teal-500"
        onOpenLoan={openLoan}
      />
    </div>
  );
};
