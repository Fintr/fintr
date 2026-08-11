import { getColorByIndex } from "@/lib/utils";
import type { InsightCard } from "./types";

const parsePercentage = (value: string | undefined): number => {
  if (!value) return 0;
  return parseFloat(value.replace("%", ""));
};

const parseWeeklyAmount = (value: string | number): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const aggregateWeeklySpending = (
  spending:
    | Array<{ date: string; amount: string | number }>
    | undefined,
): { day: string; amount: number }[] => {
  if (!spending?.length) {
    return [];
  }

  if (spending.length === 7) {
    return spending.map((item) => ({
      day: item.date.slice(0, 3),
      amount: parseWeeklyAmount(item.amount),
    }));
  }

  const aggregation: Record<string, number> = {};

  spending.forEach((item) => {
    const day = item.date.slice(0, 3);
    const amount = parseWeeklyAmount(item.amount);
    aggregation[day] = (aggregation[day] || 0) + amount;
  });

  const today = new Date();
  const currentDayIndex = today.getDay();
  const allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const orderedDays: string[] = [];

  for (let i = 1; i < 7; i++) {
    orderedDays.push(allDays[(currentDayIndex + i) % 7]);
  }
  orderedDays.push(allDays[currentDayIndex]);

  return orderedDays.map((day) => ({
    day,
    amount: aggregation[day] || 0,
  }));
};

export const transformSummary = (data: {
  totalIncome?: string;
  totalExpenses?: string;
  netSavings?: string;
}) => ({
  totalIncome: parseFloat(data?.totalIncome || "0"),
  totalExpenses: parseFloat(data?.totalExpenses || "0"),
  netSavings: parseFloat(data?.netSavings || "0"),
});

type ApiMetricCalculation = {
  labeledFormula?: string;
  labeled_formula?: string;
  formula?: string;
  inputs?: Array<{ label: string; value: string }>;
  notes?: string[];
};

export const transformMetricCalculation = (
  calculation?: ApiMetricCalculation,
) => {
  if (!calculation) {
    return undefined;
  }

  return {
    labeledFormula:
      calculation.labeledFormula ??
      calculation.labeled_formula ??
      calculation.formula ??
      "",
    formula: calculation.formula,
    inputs: calculation.inputs ?? [],
    notes: calculation.notes ?? [],
  };
};

export const transformHealthScores = (apiData: {
  savingsPercentage?: {
    percentage: string;
    score: number;
    calculation?: ApiMetricCalculation;
  };
  debtToIncomeRatio?: {
    percentage?: string;
    score?: number;
    monthlyDebt?: string;
    calculation?: ApiMetricCalculation;
  };
  budgetUsage?: {
    percentage: string;
    score: number;
    calculation?: ApiMetricCalculation;
  };
  financialHealthScore?: string;
  calculation?: ApiMetricCalculation;
}) => {
  const score = parsePercentage(apiData?.financialHealthScore);
  let rating = "Fair";
  let description = "Consider reviewing your spending and savings habits.";

  if (score >= 80) {
    rating = "Excellent";
    description = "Outstanding financial health! Keep up the great work.";
  } else if (score >= 60) {
    rating = "Good";
    description = "You're on track to meet your financial goals.";
  } else if (score >= 40) {
    rating = "Fair";
    description = "There's room for improvement, but you're making progress.";
  } else {
    rating = "Poor";
    description = "Consider reviewing your spending and savings habits.";
  }

  const debtRatio = apiData?.debtToIncomeRatio;
  const debtPercentage =
    typeof debtRatio === "object" && debtRatio !== null
      ? debtRatio.percentage || "0%"
      : `${debtRatio || 0}%`;

  return {
    savingsPercentage: {
      percentage: apiData?.savingsPercentage?.percentage || "0%",
      score: apiData?.savingsPercentage?.score || 0,
      calculation: transformMetricCalculation(
        apiData?.savingsPercentage?.calculation,
      ),
    },
    debtToIncomeRatio: {
      percentage: debtPercentage,
      score:
        typeof debtRatio === "object" && debtRatio !== null
          ? debtRatio.score || 0
          : 100,
      monthlyDebt: parseFloat(
        (typeof debtRatio === "object" && debtRatio?.monthlyDebt) || "0",
      ),
      calculation: transformMetricCalculation(
        typeof debtRatio === "object" && debtRatio !== null
          ? debtRatio.calculation
          : undefined,
      ),
    },
    budgetUsage: {
      percentage: apiData?.budgetUsage?.percentage || "0%",
      score: apiData?.budgetUsage?.score || 0,
      calculation: transformMetricCalculation(apiData?.budgetUsage?.calculation),
    },
    score,
    rating,
    description,
    calculation: transformMetricCalculation(apiData?.calculation),
  };
};

export const transformExpenseBreakdown = (
  items:
    | Array<{
        categoryName: string;
        amount: string;
        percentage: string;
      }>
    | undefined,
) =>
  items?.map((item, index) => ({
    name: item.categoryName,
    value: parseFloat(item.amount),
    color: getColorByIndex(index),
    percentage: item.percentage,
  })) || [];

export const transformMonthlySpending = (
  items:
    | Array<{
        month_year: string;
        total_income: number;
        total_expense: number;
        net_amount: number;
      }>
    | undefined,
) =>
  items?.map((item) => ({
    month: new Date(item.month_year).toLocaleString("default", {
      month: "short",
      timeZone: "UTC",
    }),
    income: item.total_income,
    expenses: -Math.abs(item.total_expense),
    savings: item.net_amount,
  })) || [];

export const transformAccountBreakdown = (apiData?: {
  totalBalance?: string;
  breakdown?: Array<{
    name: string;
    balance:
      | { cents: number; currencyIso?: string; currency_iso?: string }
      | number
      | string;
    percentage?: string;
    category?: string;
  }>;
}) => ({
  totalBalance: parseFloat(
    (apiData?.totalBalance || "0").replace(/,/g, ""),
  ),
  breakdown:
    apiData?.breakdown?.map((item, index) => {
      const balance = item.balance;
      const value =
        typeof balance === "object" && balance !== null && "cents" in balance
          ? balance.cents / 100
          : parseFloat(String(balance ?? 0).replace(/,/g, "")) || 0;
      return {
        name: item.name,
        value,
        color: getColorByIndex(index),
        percentage: item.percentage ?? "0%",
        category: item.category ?? "",
      };
    }) ?? [],
});

export const transformNarratives = (apiData: {
  headline?: { text: string; sentiment: string };
  metrics?: Array<{
    key: string;
    label: string;
    value: string;
    benchmark: string;
    trend: string | null;
    calculation?: {
      labeledFormula?: string;
      labeled_formula?: string;
      formula?: string;
      inputs: Array<{ label: string; value: string }>;
      notes?: string[];
    };
  }>;
  insights?: Array<{
    type: string;
    severity: string;
    title: string;
    body: string;
    actionLabel?: string;
    action_label?: string;
    actionHref?: string;
    action_href?: string;
    profileKey?: string;
    profile_key?: string;
    imageKey?: string;
    image_key?: string;
  }>;
  dataQuality?: {
    transactionCount?: number;
    transaction_count?: number;
    categorizedPercent?: string;
    categorized_percent?: string;
    completenessTier?: string;
    completeness_tier?: string;
  };
}) => ({
  headline: {
    text: apiData?.headline?.text || "",
    sentiment: (apiData?.headline?.sentiment || "neutral") as
      | "positive"
      | "negative"
      | "neutral",
  },
  metrics:
    apiData?.metrics?.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      benchmark: metric.benchmark,
      trend: normalizeMetricTrend(metric.trend),
      calculation: transformMetricCalculation(metric.calculation),
    })) || [],
  insights:
    apiData?.insights?.map((card) => ({
      type: card.type,
      severity: card.severity as "positive" | "neutral" | "warning",
      title: card.title,
      body: card.body,
      actionLabel: card.actionLabel ?? card.action_label ?? "",
      actionHref: card.actionHref ?? card.action_href ?? "",
      profileKey: (card.profileKey ?? card.profile_key) as
        | InsightCard["profileKey"]
        | undefined,
      imageKey: card.imageKey ?? card.image_key,
    })) || [],
  dataQuality: {
    transactionCount:
      apiData?.dataQuality?.transactionCount
      ?? apiData?.dataQuality?.transaction_count
      ?? 0,
    categorizedPercent:
      apiData?.dataQuality?.categorizedPercent
      ?? apiData?.dataQuality?.categorized_percent
      ?? "0%",
    completenessTier: (apiData?.dataQuality?.completenessTier
      ?? apiData?.dataQuality?.completeness_tier
      ?? "sparse") as "sparse" | "building" | "complete",
  },
});

const normalizeMetricTrend = (
  trend: string | null | undefined,
): "income" | "expense" | null => {
  if (trend === "income" || trend === "expense") {
    return trend;
  }
  return null;
};

export { aggregateWeeklySpending, parsePercentage };
