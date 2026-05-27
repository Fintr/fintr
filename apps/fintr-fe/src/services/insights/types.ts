export interface InsightsSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
}

export interface HealthScoreFactor {
  percentage: string;
  score: number;
  calculation?: MetricCalculation;
}

export interface FinancialHealthScore {
  score: number;
  rating: string;
  description: string;
  calculation?: MetricCalculation;
  savingsPercentage: HealthScoreFactor;
  debtToIncomeRatio: HealthScoreFactor & {
    monthlyDebt: number;
  };
  budgetUsage: HealthScoreFactor;
}

export interface ExpenseBreakdown {
  name: string;
  value: number;
  color: string;
  percentage: string;
}

export interface WeeklySpending {
  day: string;
  amount: number;
}

export interface MonthlySpending {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface AccountBreakdownItem {
  name: string;
  value: number;
  color: string;
  percentage: string;
  category: string;
}

export interface AccountBreakdown {
  totalBalance: number;
  breakdown: AccountBreakdownItem[];
}

/** Income/expense flow icon key — same semantics as transaction totals (not good/bad). */
export type InsightMetricTrend = "income" | "expense" | null;

export interface MetricCalculationInput {
  label: string;
  value: string;
}

export interface MetricCalculation {
  labeledFormula: string;
  formula?: string;
  inputs: MetricCalculationInput[];
  notes: string[];
}

export interface InsightMetric {
  key: string;
  label: string;
  value: string;
  benchmark: string;
  trend: InsightMetricTrend;
  calculation?: MetricCalculation;
}

export interface InsightCard {
  type: string;
  severity: "positive" | "neutral" | "warning";
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}

export interface InsightsNarratives {
  headline: {
    text: string;
    sentiment: "positive" | "negative" | "neutral";
  };
  metrics: InsightMetric[];
  insights: InsightCard[];
  dataQuality: {
    transactionCount: number;
    categorizedPercent: string;
    completenessTier: "sparse" | "building" | "complete";
  };
}

export interface InsightsSections {
  summary: InsightsSummary | undefined;
  narratives: InsightsNarratives | undefined;
  healthScores: FinancialHealthScore | undefined;
  expenseBreakdown: ExpenseBreakdown[];
  weeklySpending: WeeklySpending[];
  monthlySpending: MonthlySpending[];
  accountBreakdown: AccountBreakdown | undefined;
}
