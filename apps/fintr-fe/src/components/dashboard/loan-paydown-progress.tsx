"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  getLoanPaydownPercent,
  type LoanPaydownStatus,
} from "@/utils/loan-paydown";

type LoanPaydownProgressProps = {
  principalAmount: number;
  outstandingBalance: number;
  isBorrowed: boolean;
  status: LoanPaydownStatus;
  className?: string;
  variant?: "default" | "compact";
};

export function LoanPaydownProgress({
  principalAmount,
  outstandingBalance,
  isBorrowed,
  status,
  className,
  variant = "default",
}: LoanPaydownProgressProps) {
  const percentPaid = getLoanPaydownPercent(
    principalAmount,
    outstandingBalance,
    status,
  );

  const fillClass =
    status === "paid_off"
      ? "bg-green-500"
      : isBorrowed
        ? "bg-primary-dark-mode"
        : "bg-teal-500";

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percentPaid}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percentPaid}% of principal paid`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              fillClass,
            )}
            style={{ width: `${percentPaid}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {percentPaid}% paid
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          Principal paid
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {percentPaid}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percentPaid}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percentPaid}% of principal paid`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            fillClass,
          )}
          style={{ width: `${percentPaid}%` }}
        />
      </div>
    </div>
  );
}
