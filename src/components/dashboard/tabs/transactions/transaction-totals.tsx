"use client";

import { TransactionTotals } from "@/types/transactionTypes";
import { formatCurrency } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

interface TransactionTotalsDisplayProps {
  totals: TransactionTotals | null;
  isLoading?: boolean;
}

export function TransactionTotalsDisplay({ totals, isLoading }: TransactionTotalsDisplayProps) {
  if (isLoading) {
    return (
      <fieldset className="border border-primary rounded-lg px-4 py-3 mb-4 w-full md:w-fit">
        <legend className="text-xs font-medium text-muted-foreground px-1">
          Totals (including future transactions)
        </legend>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg animate-pulse">
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
  const hasExpense = totals.expense > 0;
  const hasTransfer = totals.transfer > 0;

  // Don't show if there are no totals
  if (!hasIncome && !hasExpense && !hasTransfer) {
    return null;
  }

  return (
    <fieldset className="border border-primary rounded-lg px-4 py-3 mb-4 w-full md:w-fit">
      <legend className="text-xs font-medium text-muted-foreground px-1">
        Totals (including future transactions)
      </legend>
      <div className="flex flex-wrap gap-2 md:gap-3">
        {hasIncome && (
          <div className="flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 bg-teal-50 rounded-lg flex-1 md:flex-none">
            <ArrowUpRight className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-600">
              {formatCurrency(totals.income)}
            </span>
          </div>
        )}
        
        {hasExpense && (
          <div className="flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 bg-red-50 rounded-lg flex-1 md:flex-none">
            <ArrowDownLeft className="h-4 w-4 text-red-900" />
            <span className="text-sm font-medium text-red-900">
              {formatCurrency(totals.expense)}
            </span>
          </div>
        )}
        
        {hasTransfer && (
          <div className="flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 bg-blue-100/50 rounded-lg flex-1 md:flex-none">
            <ArrowLeftRight className="h-4 w-4 text-blue-900" />
            <span className="text-sm font-medium text-blue-900">
              {formatCurrency(totals.transfer)}
            </span>
          </div>
        )}
      </div>
    </fieldset>
  );
}
