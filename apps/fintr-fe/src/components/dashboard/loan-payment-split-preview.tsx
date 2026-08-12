"use client";

import React from "react";

import { cn, formatCurrency } from "@/lib/utils";
import type { LoanPaymentSplit } from "@/utils/calculate-loan-payment-split";

type LoanPaymentSplitPreviewProps = {
  split: LoanPaymentSplit | null;
  currency: string;
  textColorClass?: string;
  className?: string;
};

export function LoanPaymentSplitPreview({
  split,
  currency,
  textColorClass,
  className,
}: LoanPaymentSplitPreviewProps) {
  if (!split) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-3 py-2.5",
        className,
      )}
      aria-live="polite"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Payment breakdown
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[10px] text-muted-foreground">Principal</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(split.principalPayment, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Interest</dt>
          <dd
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              textColorClass ?? "text-foreground",
            )}
          >
            {formatCurrency(split.interestPayment, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Total</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(split.totalPayment, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
