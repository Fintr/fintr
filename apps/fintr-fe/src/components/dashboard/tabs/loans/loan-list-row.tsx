"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

import EditLoanModal from "@/components/dashboard/forms/EditLoanModal";
import DeleteLoanModal from "@/components/dashboard/forms/DeleteLoanModal";
import { LoanPaydownProgress } from "@/components/dashboard/loan-paydown-progress";
import { Loan } from "@/services/loans/queries";
import { cn, formatCurrency } from "@/lib/utils";
import { formatLoanTerm } from "@/utils/formatLoanTerm";
import {
  parseLoanPrincipalAmount,
  parseLoanOutstandingBalance,
} from "@/utils/loan-paydown";

type LoanListRowProps = {
  loan: Loan;
  variant?: "active" | "completed";
  onOpen: (loanId: string) => void;
  onDelete: (loanId: string) => Promise<{ success: boolean; pendingSync?: boolean } | void>;
};

const loanStatusClassName = (status: string) => {
  if (status === "paid_off") {
    return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400";
  }

  if (status === "defaulted") {
    return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-700";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400";
};

const formatDisplayDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function LoanListRow({
  loan,
  variant = "active",
  onOpen,
  onDelete,
}: LoanListRowProps) {
  const isCompleted = variant === "completed";
  const isBorrowed = loan.loanType === "borrowed";
  const colorClass = isCompleted
    ? "bg-green-600"
    : isBorrowed
      ? "bg-red-900"
      : "bg-teal-600";
  const textColorClass = isCompleted
    ? "text-muted-foreground"
    : isBorrowed
      ? "text-red-900 dark:text-red-700"
      : "text-teal-600 dark:text-teal-500";
  const statusColorClass = loanStatusClassName(loan.status);
  const principalAmount = parseLoanPrincipalAmount(loan.principalAmount);
  const outstandingBalance = parseLoanOutstandingBalance(loan.outstandingBalance);
  const showPaydown =
    !isCompleted && loan.status === "active" && principalAmount > 0;

  return (
    <div
      className={cn(
        "flex min-h-[64px] cursor-pointer items-stretch rounded p-3 transition-colors",
        isCompleted
          ? "border border-border/60 bg-muted/20 hover:bg-muted/30"
          : "bg-white hover:bg-gray-100 dark:bg-card dark:hover:bg-accent/50",
      )}
      onClick={() => onOpen(loan.id)}
    >
      <div
        className={cn(
          "mr-3 w-1 flex-shrink-0 self-stretch rounded",
          colorClass,
          isCompleted && "opacity-70",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {isCompleted ? (
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                aria-hidden
              />
            ) : null}
            <h4
              className={cn(
                "truncate text-sm font-medium",
                isCompleted ? "text-muted-foreground" : "text-primary",
              )}
            >
              {loan.entityName}
            </h4>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                statusColorClass,
              )}
            >
              {loan.status.replace("_", " ")}
            </span>
          </div>
          <div
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              textColorClass,
            )}
          >
            {isCompleted
              ? "Paid off"
              : formatCurrency(
                  loan.outstandingBalance,
                  loan.outstandingBalanceCurrency,
                )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            <span className={cn("font-medium", textColorClass)}>
              {isBorrowed ? "Borrowed" : "Lent"}
            </span>
            <span aria-hidden="true"> · </span>
            {loan.interestRate}%
            <span aria-hidden="true"> · </span>
            {formatLoanTerm(loan.loanTermMonths)}
            {isCompleted && loan.paidOffDate ? (
              <>
                <span aria-hidden="true"> · </span>
                Paid off {formatDisplayDate(loan.paidOffDate)}
              </>
            ) : (
              <>
                <span aria-hidden="true"> · </span>
                Matures {formatDisplayDate(loan.maturityDate)}
              </>
            )}
          </p>
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <EditLoanModal loan={loan} />
            <DeleteLoanModal loan={loan} onDelete={onDelete} />
          </div>
        </div>

        {showPaydown ? (
          <LoanPaydownProgress
            principalAmount={principalAmount}
            outstandingBalance={outstandingBalance}
            isBorrowed={isBorrowed}
            status={loan.status}
            variant="compact"
          />
        ) : null}

        {loan.description ? (
          <p className="truncate text-xs text-muted-foreground">
            {loan.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
