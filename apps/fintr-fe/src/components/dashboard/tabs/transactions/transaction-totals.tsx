"use client";

import { TransactionTotals } from "@/types/transactionTypes";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

const totalChipClassName =
  "flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 rounded-lg shadow-sm flex-1 md:flex-none";

interface TransactionTotalsDisplayProps {
  totals: TransactionTotals | null;
  isLoading?: boolean;
  /** ISO code used to format totals (space currency, or a single loaded row currency when all match). */
  totalsCurrency?: string;
}

export function TransactionTotalsDisplay({
  totals,
  isLoading,
  totalsCurrency = "PHP",
}: TransactionTotalsDisplayProps) {
  if (isLoading) {
    return (
      <fieldset className="border border-gray-300 rounded-lg px-4 py-3 mb-4 w-full md:w-fit">
        <legend className="text-xs font-medium text-muted-foreground px-1">
          Totals (including future transactions)
        </legend>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg shadow-sm animate-pulse">
            <div className="w-20 h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </fieldset>
    );
  }

  if (!totals) {
    return null;
  }

  const hasIncome = totals.income > 0;
  // API may send expense totals as positive magnitudes; treat any non-zero as present.
  const hasExpense = Math.abs(totals.expense) > 0;
  const hasTransfer = Math.abs(totals.transfer) > 0;

  // Don't show if there are no totals
  if (!hasIncome && !hasExpense && !hasTransfer) {
    return null;
  }

  return (
    <fieldset className="border border-gray-300 rounded-lg px-4 py-3 mb-4 w-full md:w-fit">
      <legend className="text-xs font-medium text-muted-foreground px-1">
        Totals (including future transactions)
      </legend>
      <div className="flex flex-wrap gap-2 md:gap-3">
        {hasIncome && (
          <div className={cn(totalChipClassName, "bg-teal-50")}>
            <ArrowUpRight className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-600">
              {formatCurrency(totals.income, totalsCurrency)}
            </span>
          </div>
        )}
        
        {hasExpense && (
          <div className={cn(totalChipClassName, "bg-red-50")}>
            <ArrowDownLeft className="h-4 w-4 text-red-900" />
            <span className="text-sm font-medium text-red-900">
              {formatCurrency(Math.abs(totals.expense), totalsCurrency)}
            </span>
          </div>
        )}
        
        {hasTransfer && (
          <div className={cn(totalChipClassName, "bg-blue-100/50")}>
            <ArrowLeftRight className="h-4 w-4 text-blue-900" />
            <span className="text-sm font-medium text-blue-900">
              {formatCurrency(Math.abs(totals.transfer), totalsCurrency)}
            </span>
          </div>
        )}
      </div>
    </fieldset>
  );
}
