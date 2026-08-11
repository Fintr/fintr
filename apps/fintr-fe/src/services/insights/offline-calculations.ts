import { getColorByIndex } from "@/lib/utils";
import { monthRangesInclusive } from "@/lib/local-sync/offline-bootstrap-dates";
import { loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";
import { loadCachedMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import type { Budget } from "@/types/budgetTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import {
  filterTransactionsByInsightsCategory,
  type InsightsCategoryFilter,
} from "@/utils/transactionListFilter";

import {
  formatCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import {
  isExpenseCategoryFilterValue,
  isIncomeCategoryFilterValue,
} from "@/utils/categoryFilterOptions";

import {
  financialTrendsDateRange,
  insightsSummaryHybrid,
  monthlySpendingFromBuckets,
  monthlySpendingFromTransactions,
  summaryFromTransactions,
  type MonthlySpendingSeriesMode,
} from "./from-monthly-buckets";
import { transformHealthScores } from "./transforms";
import type {
  ExpenseBreakdown,
  FinancialHealthScore,
  InsightsSummary,
  MonthlySpending,
  WeeklySpending,
} from "./types";

export const resolveCategoryTrendsSeriesMode = (params: {
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryOptions?: InsightsCategoryFilter["categoryOptions"];
}): MonthlySpendingSeriesMode | null => {
  const { categoryName, categoryId, subcategoryId, categoryOptions } = params;
  const categoryFiltered = Boolean(
    categoryId
    || subcategoryId
    || (categoryName && categoryName.length > 0),
  );

  if (!categoryFiltered) {
    return null;
  }

  if (!categoryOptions || !categoryId) {
    return "expense";
  }

  const pickerValue = formatCategoryPickerValue({
    categoryId,
    subcategoryId: subcategoryId ?? null,
  });

  if (isIncomeCategoryFilterValue(pickerValue, categoryOptions.income)) {
    return "income";
  }

  if (isExpenseCategoryFilterValue(pickerValue, categoryOptions.expense)) {
    return "expense";
  }

  // Name/id matched a filter but tree side is unclear — treat as expense series.
  return "expense";
};

const toAmount = (value: IndexTransaction["amount"] | number | string): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPercentage = (value: number): string => `${value.toFixed(2)}%`;

const dayKey = (isoDate: string): string => isoDate.slice(0, 10);

const periodDaysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return 30;
  }
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
};

const isExpense = (tx: IndexTransaction): boolean =>
  tx.type === CombinedTransactionTypeEnum.EXPENSE;

const filterByTagIds = (
  transactions: IndexTransaction[],
  tagIds: string[],
): IndexTransaction[] => {
  if (tagIds.length === 0) {
    return transactions;
  }

  const allowed = new Set(tagIds);
  return transactions.filter((tx) => {
    const transactionTagIds =
      tx.tagIds ?? tx.tags?.map((tag) => tag.id) ?? [];
    return transactionTagIds.some((tagId) => allowed.has(tagId));
  });
};

/** Mirrors Insights::MonthlyDebtPayments.estimate_monthly_payment */
export const estimateMonthlyLoanPayment = (loan: Loan): number => {
  const principal = toAmount(loan.outstandingBalance);
  const termMonths = loan.loanTermMonths;
  if (principal <= 0 || !termMonths || termMonths <= 0) {
    return 0;
  }

  const monthlyRate = toAmount(loan.interestRate) / 100 / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }

  const onePlusRate = 1 + monthlyRate;
  const powerResult = onePlusRate ** termMonths;
  const denominator = powerResult - 1;
  if (denominator <= 0) {
    return 0;
  }

  return principal * ((monthlyRate * powerResult) / denominator);
};

export const totalMonthlyDebtFromLoans = (loans: Loan[]): number =>
  loans
    .filter((loan) => loan.loanType === "borrowed" && loan.status === "active")
    .reduce((sum, loan) => sum + estimateMonthlyLoanPayment(loan), 0);

const savingsScore = (percentage: number): number => {
  if (percentage >= 20) return 100;
  if (percentage >= 15) return 90;
  if (percentage >= 10) return 75;
  if (percentage >= 5) return 50;
  if (percentage >= 1) return 25;
  return 0;
};

const debtToIncomeScore = (percentage: number): number => {
  if (percentage < 20) return 100;
  if (percentage < 30) return 80;
  if (percentage < 40) return 60;
  if (percentage < 50) return 40;
  return 20;
};

const budgetUsageScore = (percentage: number): number => {
  if (percentage <= 100) return 100;
  if (percentage < 110) return 90;
  if (percentage < 120) return 80;
  if (percentage < 130) return 70;
  if (percentage < 140) return 60;
  if (percentage < 150) return 50;
  if (percentage < 160) return 40;
  if (percentage < 170) return 30;
  if (percentage < 180) return 20;
  if (percentage < 190) return 10;
  return 0;
};

export const loadLocalBudgetsForRange = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<Budget[]> => {
  const months = monthRangesInclusive(startDate, endDate);
  const pages = await Promise.all(
    months.map((month) =>
      loadCachedBudgetsResponse(spaceCode, month.startDate, month.endDate),
    ),
  );

  return pages.flatMap((page) => page?.budgets ?? []);
};

export const expenseBreakdownFromTransactions = (
  transactions: IndexTransaction[],
): ExpenseBreakdown[] => {
  const expenses = transactions.filter(isExpense);
  if (expenses.length === 0) {
    return [];
  }

  const total = expenses.reduce(
    (sum, tx) => sum + Math.abs(toAmount(tx.amount)),
    0,
  );
  if (total <= 0) {
    return [];
  }

  const byCategory = new Map<string, number>();
  for (const tx of expenses) {
    const name = tx.categoryName || "Uncategorized";
    byCategory.set(
      name,
      (byCategory.get(name) ?? 0) + Math.abs(toAmount(tx.amount)),
    );
  }

  return Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: getColorByIndex(index),
      percentage: formatPercentage((value / total) * 100),
    }));
};

export const UNASSIGNED_MERCHANT_LABEL = "Unassigned";
export const UNASSIGNED_SUBCATEGORY_LABEL = "Unassigned";

const expenseBreakdownByLabel = (
  transactions: IndexTransaction[],
  labelFor: (tx: IndexTransaction) => string,
): ExpenseBreakdown[] => {
  const expenses = transactions.filter(isExpense);
  if (expenses.length === 0) {
    return [];
  }

  const total = expenses.reduce(
    (sum, tx) => sum + Math.abs(toAmount(tx.amount)),
    0,
  );
  if (total <= 0) {
    return [];
  }

  const byLabel = new Map<string, number>();
  for (const tx of expenses) {
    const name = labelFor(tx);
    byLabel.set(
      name,
      (byLabel.get(name) ?? 0) + Math.abs(toAmount(tx.amount)),
    );
  }

  return Array.from(byLabel.entries())
    .sort((a, b) => {
      if (a[0] === UNASSIGNED_MERCHANT_LABEL || a[0] === UNASSIGNED_SUBCATEGORY_LABEL) {
        return 1;
      }
      if (b[0] === UNASSIGNED_MERCHANT_LABEL || b[0] === UNASSIGNED_SUBCATEGORY_LABEL) {
        return -1;
      }
      return b[1] - a[1];
    })
    .map(([name, value], index) => ({
      name,
      value,
      color: getColorByIndex(index),
      percentage: formatPercentage((value / total) * 100),
    }));
};

/** Groups expense amounts by merchant (`entityName`); blank merchants → Unassigned. */
export const merchantBreakdownFromTransactions = (
  transactions: IndexTransaction[],
): ExpenseBreakdown[] =>
  expenseBreakdownByLabel(transactions, (tx) => {
    const trimmed = tx.entityName?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : UNASSIGNED_MERCHANT_LABEL;
  });

/** Groups expense amounts by subcategory; blank subcategory → Unassigned. */
export const subcategoryBreakdownFromTransactions = (
  transactions: IndexTransaction[],
): ExpenseBreakdown[] =>
  expenseBreakdownByLabel(transactions, (tx) => {
    const trimmed = tx.subcategoryName?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : UNASSIGNED_SUBCATEGORY_LABEL;
  });

/**
 * Mirrors CreateWeeklySpending: last 7 calendar days ending today.
 * Amounts are returned in the API shape expected by aggregateWeeklySpending.
 */
export const weeklySpendingFromTransactions = (
  transactions: IndexTransaction[],
  today: Date = new Date(),
): WeeklySpending[] => {
  const end = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);

  const expenses = transactions.filter(
    (tx) =>
      isExpense(tx) &&
      dayKey(tx.date) >= startKey &&
      dayKey(tx.date) <= endKey,
  );

  const byDate = new Map<string, number>();
  for (const tx of expenses) {
    const key = dayKey(tx.date);
    byDate.set(key, (byDate.get(key) ?? 0) + Math.abs(toAmount(tx.amount)));
  }

  const ordered: WeeklySpending[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const amount = byDate.get(key) ?? 0;
    const day = date.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    ordered.push({ day, amount });
  }

  return ordered;
};

export const healthScoresFromLocalData = (input: {
  summary: InsightsSummary;
  periodDays: number;
  totalBudget: number;
  monthlyDebt: number;
}): FinancialHealthScore => {
  const { summary, periodDays, totalBudget, monthlyDebt } = input;
  const totalIncome = summary.totalIncome;
  const totalExpenses = summary.totalExpenses;
  const netSavings = summary.netSavings;

  const savingsRate =
    totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const savingsScoreValue = totalIncome > 0 ? savingsScore(savingsRate) : 0;

  const months = Math.max(periodDays / 30, 1);
  const monthlyIncome = totalIncome / months;
  const debtRatio =
    monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;
  const debtScoreValue =
    monthlyIncome === 0 ? 100 : debtToIncomeScore(debtRatio);

  const usagePercentage =
    totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
  const budgetScoreValue =
    totalBudget > 0 ? budgetUsageScore(usagePercentage) : 0;

  const weighted =
    savingsScoreValue * 0.5 + budgetScoreValue * 0.3 + debtScoreValue * 0.2;

  return transformHealthScores({
    financialHealthScore: formatPercentage(weighted),
    savingsPercentage: {
      percentage: formatPercentage(savingsRate),
      score: savingsScoreValue,
    },
    debtToIncomeRatio: {
      percentage: formatPercentage(debtRatio),
      score: debtScoreValue,
      monthlyDebt: String(Number(monthlyDebt.toFixed(2))),
    },
    budgetUsage: {
      percentage: formatPercentage(usagePercentage),
      score: budgetScoreValue,
    },
  });
};

export type OfflineInsightsBundle = {
  summary: InsightsSummary;
  expenseBreakdown: ExpenseBreakdown[];
  merchantBreakdown: ExpenseBreakdown[];
  subcategoryBreakdown: ExpenseBreakdown[];
  weeklySpending: WeeklySpending[];
  monthlySpending: MonthlySpending[];
  healthScores: FinancialHealthScore;
};

export const buildOfflineInsightsBundle = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagIds?: string[];
  categoryOptions?: InsightsCategoryFilter["categoryOptions"];
}): Promise<OfflineInsightsBundle> => {
  const {
    spaceCode,
    startDate,
    endDate,
    categoryName,
    categoryId,
    subcategoryId,
    tagIds = [],
    categoryOptions,
  } = params;

  const categoryFilter: InsightsCategoryFilter = {
    categoryName,
    categoryId,
    subcategoryId,
    categoryOptions,
  };

  const categoryFiltered = Boolean(
    categoryId
    || subcategoryId
    || (categoryName && categoryName.length > 0),
  );
  const tagFiltered = tagIds.length > 0;
  const useTransactionSummary = categoryFiltered || tagFiltered;

  // Trends are anchored to the filtered month, not "today".
  const trendsRange = financialTrendsDateRange(endDate);
  const txLoadStart =
    categoryFiltered && trendsRange.startDate < startDate
      ? trendsRange.startDate
      : startDate;
  const txLoadEnd =
    categoryFiltered && trendsRange.endDate > endDate
      ? trendsRange.endDate
      : endDate;

  const [summaries, transactions, budgets, loansData] = await Promise.all([
    loadCachedMonthlyFinancialSummaries(spaceCode),
    loadCachedTransactionsInRange(spaceCode, txLoadStart, txLoadEnd),
    loadLocalBudgetsForRange(spaceCode, startDate, endDate),
    loadCachedLoansInfiniteData(spaceCode),
  ]);

  const categoryFilteredTransactions = filterTransactionsByInsightsCategory(
    transactions,
    categoryFilter,
  );
  const filteredTransactions = filterByTagIds(
    categoryFilteredTransactions,
    tagIds,
  );
  const periodFilteredTransactions = filteredTransactions.filter(
    (tx) => dayKey(tx.date) >= startDate && dayKey(tx.date) <= endDate,
  );

  if (
    process.env.NODE_ENV === "development"
    && (categoryName || categoryId || subcategoryId)
  ) {
    console.debug("[insights:category-filter]", {
      startDate,
      endDate,
      categoryName: categoryName ?? "",
      categoryId: categoryId ?? "",
      subcategoryId: subcategoryId ?? "",
      loadedTransactions: transactions.length,
      matchedTransactions: categoryFilteredTransactions.length,
      sampleCategoryNames: [
        ...new Set(
          transactions
            .slice(0, 50)
            .map((tx) => tx.categoryName)
            .filter(Boolean),
        ),
      ],
      sampleCategoryIds: [
        ...new Set(
          transactions
            .slice(0, 50)
            .map((tx) => (tx as IndexTransaction & { categoryId?: string }).categoryId)
            .filter(Boolean),
        ),
      ],
    });
  }

  const summary = useTransactionSummary
    ? summaryFromTransactions(periodFilteredTransactions)
    : insightsSummaryHybrid({
        summaries: summaries ?? [],
        transactions: periodFilteredTransactions,
        startDate,
        endDate,
      });

  const trendsSeriesMode = resolveCategoryTrendsSeriesMode({
    categoryName,
    categoryId,
    subcategoryId,
    categoryOptions,
  });

  const monthlySpending = (
    trendsSeriesMode
      ? monthlySpendingFromTransactions(
          filteredTransactions,
          trendsRange.startDate,
          trendsRange.endDate,
          trendsSeriesMode,
        )
      : monthlySpendingFromBuckets(
          summaries ?? [],
          trendsRange.startDate,
          trendsRange.endDate,
        )
  ).map((row) => ({
    ...row,
    // Match transformMonthlySpending: expenses plotted as negative.
    expenses: -Math.abs(row.expenses),
  }));

  const totalBudget = budgets.reduce(
    (sum, budget) => sum + toAmount(budget.amount),
    0,
  );
  const loans = (loansData?.pages ?? []).flatMap((page) => page.loans);
  const monthlyDebt = totalMonthlyDebtFromLoans(loans);

  return {
    summary,
    expenseBreakdown: expenseBreakdownFromTransactions(periodFilteredTransactions),
    merchantBreakdown: merchantBreakdownFromTransactions(periodFilteredTransactions),
    subcategoryBreakdown: subcategoryBreakdownFromTransactions(
      periodFilteredTransactions,
    ),
    weeklySpending: weeklySpendingFromTransactions(periodFilteredTransactions),
    monthlySpending,
    healthScores: healthScoresFromLocalData({
      summary,
      periodDays: periodDaysBetween(startDate, endDate),
      totalBudget,
      monthlyDebt,
    }),
  };
};
