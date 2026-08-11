"use client";

import React from "react";
import { useAtomValue } from "jotai";
import { ArrowLeftRight, Landmark } from "lucide-react";
import {
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import {
  ActivitiesTypeEnum,
  CombinedTransactionTypeEnum,
  IndexActivity,
  IndexTransaction,
} from "@/types/transactionTypes";
import { findCategoryTreeOptionForTransaction } from "@/types/categoryTreeTypes";
import {
  activityPresentsAsIncome,
  activityPresentsAsTransfer,
} from "@/utils/activityDisplay";
import {
  getCategoryLucideIcon,
  resolveCategoryAppearance,
} from "@/utils/categoryAppearance";
import { cn } from "@/lib/utils";

const LOAN_ICON_COLOR = "#3949AB";

const SIZE_CLASSES = {
  md: {
    box: "h-[30px] w-[30px] rounded-md",
    icon: "h-[17.5px] w-[17.5px]",
  },
  sm: {
    box: "h-5 w-5 rounded",
    icon: "h-3 w-3",
  },
} as const;

type TransactionRowTypeIconProps = {
  row: IndexTransaction | IndexActivity;
  className?: string;
  size?: keyof typeof SIZE_CLASSES;
};

const isLoanRow = (row: IndexTransaction | IndexActivity): boolean => {
  if ("isLoanActivity" in row && row.isLoanActivity) {
    return true;
  }

  return (
    row.type === ActivitiesTypeEnum.LOAN_DISBURSEMENT ||
    row.type === ActivitiesTypeEnum.LOAN_PAYMENT ||
    row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT ||
    row.type === CombinedTransactionTypeEnum.LOAN_PAYMENT
  );
};

export const TransactionRowTypeIcon: React.FC<TransactionRowTypeIconProps> = ({
  row,
  className,
  size = "md",
}) => {
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  const sizeClasses = SIZE_CLASSES[size];

  if (activityPresentsAsTransfer(row)) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          sizeClasses.box,
          "bg-blue-100/50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-400",
          className,
        )}
        aria-hidden
      >
        <ArrowLeftRight className={sizeClasses.icon} />
      </span>
    );
  }

  if (isLoanRow(row)) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          sizeClasses.box,
          className,
        )}
        style={{
          backgroundColor: `${LOAN_ICON_COLOR}20`,
          color: LOAN_ICON_COLOR,
        }}
        aria-hidden
      >
        <Landmark className={sizeClasses.icon} />
      </span>
    );
  }

  const matchedCategory = findCategoryTreeOptionForTransaction(
    {
      categoryName: row.categoryName,
      subcategoryName: row.subcategoryName,
    },
    expenseCategoryOptions,
    incomeCategoryOptions,
  );

  const appearance = resolveCategoryAppearance({
    name: row.categoryName,
    categoryType: activityPresentsAsIncome(row) ? "income" : "expense",
    icon: matchedCategory?.icon,
    color: matchedCategory?.color,
  });

  const Icon = getCategoryLucideIcon(appearance.icon);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizeClasses.box,
        className,
      )}
      style={{
        backgroundColor: `${appearance.color}20`,
        color: appearance.color,
      }}
      aria-hidden
    >
      <Icon className={sizeClasses.icon} />
    </span>
  );
};
