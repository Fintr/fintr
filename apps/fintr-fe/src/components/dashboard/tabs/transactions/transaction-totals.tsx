"use client";

import { TransactionTotals } from "@/types/transactionTypes";
import { formatCurrency, cn, summaryAmountFractionDigits } from "@/lib/utils";
import { AnimatedCurrency } from "@/components/ui/animated-currency";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

const totalChipBaseClassName =
  "items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 rounded-lg flex-1 md:flex-none";
const totalChipClassName = cn("flex", totalChipBaseClassName);

type SummaryBoxConfig = {
  key: keyof TransactionTotals;
  label: string;
  icon: typeof ArrowUpRight;
  containerClassName: string;
  iconClassName: string;
  amountClassName: string;
};

const summaryBoxes: SummaryBoxConfig[] = [
  {
    key: "income",
    label: "Income",
    icon: ArrowUpRight,
    containerClassName: "bg-teal-50 dark:bg-teal-950/40",
    iconClassName: "text-teal-600",
    amountClassName: "text-teal-600",
  },
  {
    key: "expense",
    label: "Expenses",
    icon: ArrowDownLeft,
    containerClassName: "bg-red-50 dark:bg-red-950/40",
    iconClassName: "text-red-900 dark:text-red-700",
    amountClassName: "text-red-900 dark:text-red-700",
  },
  {
    key: "transfer",
    label: "Transfers",
    icon: ArrowLeftRight,
    containerClassName: "bg-blue-100/50 dark:bg-blue-950/40",
    iconClassName: "text-blue-900 dark:text-blue-400",
    amountClassName: "text-blue-900 dark:text-blue-400",
  },
];

interface TransactionTotalsDisplayProps {
  totals: TransactionTotals | null;
  isLoading?: boolean;
  /** Space currency — API totals are normalized to this currency. */
  spaceCurrency?: string;
  /** @deprecated Use spaceCurrency */
  totalsCurrency?: string;
  /** "default" for the transactions tab; "summary" for account/category detail pages. */
  variant?: "default" | "summary";
}

function SummaryTotals({
  totals,
  spaceCurrency,
}: {
  totals: TransactionTotals;
  spaceCurrency: string;
}) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {summaryBoxes.map((box) => {
        const Icon = box.icon;
        const amount = totals[box.key];
        const displayAmount = box.key === "income" ? amount : Math.abs(amount);

        return (
          <div
            key={box.key}
            className={cn(
              "flex flex-col gap-1 rounded-lg px-2 py-2.5 min-w-0",
              box.containerClassName,
            )}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Icon className={cn("h-3.5 w-3.5 shrink-0", box.iconClassName)} />
              <span className="text-xs font-medium text-muted-foreground truncate">
                {box.label}
              </span>
            </div>
            <AnimatedCurrency
              amount={displayAmount}
              currency={spaceCurrency}
              maximumFractionDigits={summaryAmountFractionDigits(displayAmount)}
              className={cn(
                "text-sm font-semibold truncate",
                box.amountClassName,
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

function SummaryTotalsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {summaryBoxes.map((box) => (
        <div
          key={box.key}
          className="flex flex-col gap-1 rounded-lg border border-gray-200 dark:border-border px-2 py-2.5 animate-pulse"
        >
          <div className="h-3 w-12 bg-gray-200 dark:bg-muted-foreground/20 rounded" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-muted-foreground/20 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TransactionTotalsDisplay({
  totals,
  isLoading,
  spaceCurrency: spaceCurrencyProp,
  totalsCurrency,
  variant = "default",
}: TransactionTotalsDisplayProps) {
  const spaceCurrency = spaceCurrencyProp ?? totalsCurrency ?? "PHP";

  if (variant === "summary") {
    if (isLoading) {
      return <SummaryTotalsSkeleton />;
    }

    if (!totals) {
      return null;
    }

    return (
      <SummaryTotals
        totals={totals}
        spaceCurrency={spaceCurrency}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="mb-4 w-full md:w-fit">
        <div className="flex flex-wrap gap-2 md:gap-3">
          <div
            className={cn(
              totalChipBaseClassName,
              "hidden md:flex bg-gray-100 dark:bg-muted animate-pulse",
            )}
          >
            <div className="h-4 w-24 bg-gray-200 dark:bg-muted-foreground/20 rounded" />
          </div>
          <div
            className={cn(
              totalChipBaseClassName,
              "hidden md:flex bg-gray-100 dark:bg-muted animate-pulse",
            )}
          >
            <div className="h-4 w-24 bg-gray-200 dark:bg-muted-foreground/20 rounded" />
          </div>
          <div
            className={cn(
              totalChipClassName,
              "bg-gray-100 dark:bg-muted animate-pulse w-full md:w-auto",
            )}
          >
            <div className="h-4 w-24 bg-gray-200 dark:bg-muted-foreground/20 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!totals) {
    return null;
  }

  const hasIncome = totals.income > 0;
  const hasExpense = Math.abs(totals.expense) > 0;
  const hasTransfer = Math.abs(totals.transfer) > 0;

  if (!hasIncome && !hasExpense && !hasTransfer) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-4 w-full md:w-fit",
        !hasTransfer && "hidden md:block",
      )}
    >
      <div className="flex flex-wrap gap-2 md:gap-3">
        {hasIncome && (
          <div
            className={cn(
              totalChipBaseClassName,
              "hidden md:flex bg-teal-50 dark:bg-teal-950/40",
            )}
          >
            <ArrowUpRight className="h-4 w-4 text-teal-600 dark:text-teal-500" />
            <span className="text-sm font-medium text-teal-600 dark:text-teal-500">
              Income: {formatCurrency(totals.income, spaceCurrency)}
            </span>
          </div>
        )}
        {hasExpense && (
          <div
            className={cn(
              totalChipBaseClassName,
              "hidden md:flex bg-red-50 dark:bg-red-950/40",
            )}
          >
            <ArrowDownLeft className="h-4 w-4 text-red-900 dark:text-red-700" />
            <span className="text-sm font-medium text-red-900 dark:text-red-700">
              Expenses: {formatCurrency(Math.abs(totals.expense), spaceCurrency)}
            </span>
          </div>
        )}
        {hasTransfer && (
          <div
            className={cn(
              totalChipClassName,
              "bg-blue-100/50 dark:bg-blue-950/40 w-full md:w-auto",
            )}
          >
            <ArrowLeftRight className="h-4 w-4 text-blue-900 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-400">
              Transfers: {formatCurrency(Math.abs(totals.transfer), spaceCurrency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
