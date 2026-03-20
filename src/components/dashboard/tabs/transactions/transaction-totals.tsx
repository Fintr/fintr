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
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg animate-pulse">
          <div className="w-20 h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
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
    <div className="flex flex-wrap gap-3 mb-4">
      {hasIncome && (
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
          <ArrowUpRight className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-medium text-teal-600">
            Income: {formatCurrency(totals.income)}
          </span>
        </div>
      )}
      
      {hasExpense && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <ArrowDownLeft className="h-4 w-4 text-red-900" />
          <span className="text-sm font-medium text-red-900">
            Expense: {formatCurrency(totals.expense)}
          </span>
        </div>
      )}
      
      {hasTransfer && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-100/50 border border-blue-200 rounded-lg">
          <ArrowLeftRight className="h-4 w-4 text-blue-900" />
          <span className="text-sm font-medium text-blue-900">
            Transfer: {formatCurrency(totals.transfer)}
          </span>
        </div>
      )}
    </div>
  );
}
