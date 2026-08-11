"use client";

import React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatCurrency } from "@/lib/utils";
import { Loan } from "@/services/loans/queries";
import { getAmortizationSchedule } from "@/utils/loanAmortization";
import { parseLoanPaymentAmount } from "@/utils/loan-payment-amounts";

type LoanSummaryStatsProps = {
  loan: Loan;
  isBorrowed: boolean;
  textColorClass: string;
};

type StatCellProps = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  labelExtra?: React.ReactNode;
  className?: string;
};

function StatCell({
  label,
  value,
  valueClassName,
  labelExtra,
  className,
}: StatCellProps) {
  return (
    <div
      className={cn(
        "min-w-[9.5rem] flex-1 px-4 py-3 first:pl-4 last:pr-4",
        "sm:min-w-0",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1 text-xs font-medium capitalize text-muted-foreground">
        {label}
        {labelExtra}
      </div>
      <div className={cn("text-base font-semibold md:text-lg", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

export function LoanSummaryStats({
  loan,
  isBorrowed,
  textColorClass,
}: LoanSummaryStatsProps) {
  const schedule = React.useMemo(() => getAmortizationSchedule(loan), [loan]);

  const totalInterest = React.useMemo(() => {
    const sum = schedule.reduce(
      (acc, payment) => acc + parseLoanPaymentAmount(payment.interestPayment),
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [schedule]);

  const totalPrincipal = React.useMemo(() => {
    const principalAmount =
      typeof loan.principalAmount === "string"
        ? parseFloat(loan.principalAmount)
        : loan.principalAmount;
    return Math.round(principalAmount * 100) / 100;
  }, [loan]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-card">
      <div className="flex overflow-x-auto sm:overflow-visible">
        <StatCell
          label="Total principal"
          value={formatCurrency(totalPrincipal, loan.principalAmountCurrency)}
          valueClassName="text-primary"
          className="border-r border-gray-200 dark:border-border"
        />
        <StatCell
          label="Total interest"
          value={formatCurrency(totalInterest, loan.outstandingBalanceCurrency)}
          valueClassName={textColorClass}
          className="border-r border-gray-200 dark:border-border"
          labelExtra={
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="How total interest is calculated"
                >
                  <Info className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-3">
                  <h4 className="mb-2 text-sm font-semibold text-primary">
                    Interest Calculation
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="mb-1 font-medium text-gray-700 dark:text-foreground">
                        Formula (Daily Simple Interest):
                      </div>
                      <div className="rounded bg-gray-50 p-2 font-mono text-xs text-gray-600 dark:bg-muted dark:text-muted-foreground">
                        Daily Rate = Annual Rate ÷ 365
                        <br />
                        Interest = Beginning Balance × Daily Rate × Days
                        <br />
                        Principal = Payment - Interest
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-gray-700 dark:text-foreground">
                        Your Loan:
                      </div>
                      <div className="space-y-1 text-gray-600 dark:text-muted-foreground">
                        <div>Annual Rate: {loan.interestRate}%</div>
                        <div>
                          Daily Rate:{" "}
                          {(((loan.interestRate / 100) / 365) * 100).toFixed(6)}%
                        </div>
                        <div>Number of Payments: {schedule.length}</div>
                        <div>
                          Principal:{" "}
                          {formatCurrency(
                            loan.principalAmount,
                            loan.principalAmountCurrency,
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="border-t pt-2 dark:border-border">
                      <div className="mb-1 font-medium text-gray-700 dark:text-foreground">
                        Calculation Method:
                      </div>
                      <div className="text-gray-600 dark:text-muted-foreground">
                        Daily simple interest: Interest accrues daily based on the
                        actual number of days between payments.
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          }
        />
        <StatCell
          label="Total value"
          value={
            isBorrowed
              ? `-${formatCurrency(loan.totalValue, loan.outstandingBalanceCurrency)}`
              : `+${formatCurrency(loan.totalValue, loan.outstandingBalanceCurrency)}`
          }
          valueClassName={textColorClass}
        />
      </div>
    </section>
  );
}
