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

type StatItemProps = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  labelExtra?: React.ReactNode;
};

function StatItem({
  label,
  value,
  valueClassName,
  labelExtra,
}: StatItemProps) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3.5 first:pl-4 last:pr-4">
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {labelExtra}
      </div>
      <div
        className={cn(
          "text-base font-bold tabular-nums md:text-lg",
          valueClassName,
        )}
      >
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <StatItem
          label="Principal"
          value={formatCurrency(totalPrincipal, loan.principalAmountCurrency)}
          valueClassName="text-foreground"
        />
        <StatItem
          label="Total interest"
          value={formatCurrency(totalInterest, loan.outstandingBalanceCurrency)}
          valueClassName={textColorClass}
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
                    Interest calculation
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="mb-1 font-medium text-foreground">
                        Formula (daily simple interest):
                      </div>
                      <div className="rounded-lg bg-muted p-2 font-mono text-xs text-muted-foreground">
                        Daily Rate = Annual Rate ÷ 365
                        <br />
                        Interest = Beginning Balance × Daily Rate × Days
                        <br />
                        Principal = Payment - Interest
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-foreground">
                        Your loan:
                      </div>
                      <div className="space-y-1 text-muted-foreground">
                        <div>Annual rate: {loan.interestRate}%</div>
                        <div>
                          Daily rate:{" "}
                          {(((loan.interestRate / 100) / 365) * 100).toFixed(6)}%
                        </div>
                        <div>Number of payments: {schedule.length}</div>
                        <div>
                          Principal:{" "}
                          {formatCurrency(
                            loan.principalAmount,
                            loan.principalAmountCurrency,
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2">
                      <div className="mb-1 font-medium text-foreground">
                        Method:
                      </div>
                      <div className="text-muted-foreground">
                        Daily simple interest accrues based on the actual number
                        of days between payments.
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          }
        />
        <StatItem
          label={isBorrowed ? "Net cost" : "Net gain"}
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
