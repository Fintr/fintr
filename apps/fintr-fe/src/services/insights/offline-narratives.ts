import { loadCachedAccountsResponse } from "@/services/transactions/accounts/local-cache";
import { insightsSummaryHybrid, summaryFromTransactions } from "@/services/insights/from-monthly-buckets";
import {
  estimateMonthlyLoanPayment,
  loadLocalBudgetsForRange,
} from "@/services/insights/offline-calculations";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import { loadCachedMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import {
  filterTransactionsByInsightsCategory,
  type InsightsCategoryFilter,
} from "@/utils/transactionListFilter";

import { filterInsightsTransactions } from "./filter-insights-transactions";

import {
  buildOfflineProfileCards,
  extractInvestmentAccountNames,
  profileHeadline,
} from "@/services/insights/offline-profiles";
import type {
  InsightCard,
  InsightMetric,
  InsightMetricTrend,
  InsightsNarratives,
  InsightsSummary,
  MetricCalculation,
} from "./types";

const EMERGENCY_FUND_LOOKBACK_MONTHS = 12;
const MAX_INSIGHTS = 3;
const BUSINESS_COGS_PATTERN =
  /inventory|supplies|materials|cogs|cost of goods|raw materials/i;

const toNumber = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatPercentage = (value: number): string => `${value.toFixed(2)}%`;

const formatMoney = (amount: number, currency: string): string => {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${currency} ${sign}${formatted}`;
};

const periodDaysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return 30;
  }
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
};

const isValidIsoDate = (value: string | undefined): boolean =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const shiftDateByDays = (isoDate: string, days: number): string => {
  if (!isValidIsoDate(isoDate)) {
    return isoDate;
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const emergencyFundLookbackStart = (endDate: string): string => {
  if (!isValidIsoDate(endDate)) {
    return endDate;
  }

  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) {
    return endDate;
  }

  end.setUTCMonth(end.getUTCMonth() - EMERGENCY_FUND_LOOKBACK_MONTHS);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString().slice(0, 10);
};

const percentChange = (current: number, prior: number): number | null => {
  if (prior === 0) {
    return null;
  }
  return ((current - prior) / prior) * 100;
};

const flowIconForChange = (
  current: number,
  prior: number,
  risingMeans: "income" | "expense",
): InsightMetricTrend => {
  const change = percentChange(current, prior);
  if (change == null || change === 0) {
    return null;
  }
  const rose = change > 0;
  if (risingMeans === "expense") {
    return rose ? "expense" : "income";
  }
  return rose ? "income" : "expense";
};

const expenseChangeLabel = (change: number): string => {
  const magnitude = formatPercentage(Math.abs(change));
  return change < 0 ? `${magnitude} less` : `${magnitude} more`;
};

const insightCard = (
  card: Omit<InsightCard, "actionLabel" | "actionHref"> & {
    actionLabel: string;
    actionHref: string;
  },
): InsightCard => card;

const severityRank = (severity: InsightCard["severity"]): number =>
  ({ warning: 0, neutral: 1, positive: 2 })[severity] ?? 3;

const calculationBlock = (
  labeledFormula: string,
  inputs: MetricCalculation["inputs"],
  notes: string[],
  formula?: string,
): MetricCalculation => ({
  labeledFormula,
  formula,
  inputs,
  notes,
});

const extractCashTotal = (accountsResponse: unknown): number => {
  if (!accountsResponse || typeof accountsResponse !== "object") {
    return 0;
  }

  const root = accountsResponse as Record<string, unknown>;
  const data = root.data;
  const totalsCandidates = [
    root.balanceTotals,
    data && typeof data === "object"
      ? (data as Record<string, unknown>).balanceTotals
      : undefined,
  ];

  for (const totals of totalsCandidates) {
    if (totals && typeof totals === "object") {
      const cash = (totals as { cashTotal?: number | string }).cashTotal;
      if (cash != null) {
        return toNumber(cash);
      }
    }
  }

  return 0;
};

const expensesByCategory = (
  transactions: IndexTransaction[],
): Map<string, number> => {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== CombinedTransactionTypeEnum.EXPENSE) {
      continue;
    }
    const name = tx.categoryName || "Uncategorized";
    map.set(name, (map.get(name) ?? 0) + Math.abs(toAmount(tx.amount)));
  }
  return map;
};

const toAmount = (value: IndexTransaction["amount"]): number => toNumber(value);

export const buildOfflineNarratives = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  summary: InsightsSummary;
  currency?: string;
  isBusiness?: boolean;
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagIds?: string[];
  categoryOptions?: InsightsCategoryFilter["categoryOptions"];
}): Promise<InsightsNarratives> => {
  const {
    spaceCode,
    startDate,
    endDate,
    summary,
    currency = "PHP",
    isBusiness = false,
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

  const periodDays = periodDaysBetween(startDate, endDate);
  const priorEnd = shiftDateByDays(startDate, -1);
  const priorStart = shiftDateByDays(priorEnd, -(periodDays - 1));
  const lookbackStart = emergencyFundLookbackStart(endDate);

  const [
    summaries,
    transactions,
    priorTransactions,
    lookbackTransactions,
    budgets,
    loansData,
    accountsResponse,
  ] = await Promise.all([
    loadCachedMonthlyFinancialSummaries(spaceCode),
    loadCachedTransactionsInRange(spaceCode, startDate, endDate),
    loadCachedTransactionsInRange(spaceCode, priorStart, priorEnd),
    loadCachedTransactionsInRange(spaceCode, lookbackStart, endDate),
    loadLocalBudgetsForRange(spaceCode, startDate, endDate),
    loadCachedLoansInfiniteData(spaceCode),
    loadCachedAccountsResponse(spaceCode),
  ]);

  const applyTransactionFilters = (txs: IndexTransaction[]) => {
    let next = filterTransactionsByInsightsCategory(
      filterInsightsTransactions(txs),
      categoryFilter,
    );

    if (tagIds.length > 0) {
      const allowed = new Set(tagIds);
      next = next.filter((tx) => {
        const transactionTagIds =
          tx.tagIds ?? tx.tags?.map((tag) => tag.id) ?? [];
        return transactionTagIds.some((tagId) => allowed.has(tagId));
      });
    }

    return next;
  };

  const currentTx = applyTransactionFilters(transactions);
  const priorTx = applyTransactionFilters(priorTransactions);

  const useFilteredSummary =
    Boolean(categoryId || subcategoryId || categoryName?.trim())
    || tagIds.length > 0;

  const priorSummary = useFilteredSummary
    ? summaryFromTransactions(priorTx)
    : insightsSummaryHybrid({
        summaries: summaries ?? [],
        transactions: priorTransactions,
        startDate: priorStart,
        endDate: priorEnd,
      });

  const income = summary.totalIncome;
  const expenses = summary.totalExpenses;
  const net = summary.netSavings;
  const priorIncome = priorSummary.totalIncome;
  const priorExpenses = priorSummary.totalExpenses;
  const priorNet = priorSummary.netSavings;

  const savingsRate = income === 0 ? 0 : (net / income) * 100;
  const priorSavingsRate =
    priorIncome === 0 ? 0 : (priorNet / priorIncome) * 100;

  const trailingExpenses = applyTransactionFilters(lookbackTransactions)
    .filter((tx) => tx.type === CombinedTransactionTypeEnum.EXPENSE)
    .reduce((sum, tx) => sum + Math.abs(toAmount(tx.amount)), 0);
  const liquid = extractCashTotal(accountsResponse);
  const monthlyExpenses = trailingExpenses / EMERGENCY_FUND_LOOKBACK_MONTHS;
  let emergencyDisplay = "—";
  let emergencyMonths = 0;
  if (monthlyExpenses > 0) {
    emergencyMonths = liquid / monthlyExpenses;
    emergencyDisplay = isBusiness
      ? `${(emergencyMonths * 4.33).toFixed(1)} weeks`
      : `${emergencyMonths.toFixed(1)} months`;
  }

  const metrics: InsightMetric[] = [];

  if (isBusiness) {
    const cogs = currentTx
      .filter((tx) => tx.type === CombinedTransactionTypeEnum.EXPENSE)
      .filter((tx) => BUSINESS_COGS_PATTERN.test(tx.categoryName || ""))
      .reduce((sum, tx) => sum + Math.abs(toAmount(tx.amount)), 0);
    const grossProfit = income - cogs;
    const grossMargin = income === 0 ? 0 : (grossProfit / income) * 100;
    metrics.push({
      key: "gross_margin",
      label: "Gross margin",
      value: formatPercentage(grossMargin),
      benchmark: "30%+",
      trend: null,
      calculation: calculationBlock(
        "(Revenue − COGS) ÷ Revenue × 100",
        [
          { label: "Revenue", value: formatMoney(income, currency) },
          { label: "COGS", value: formatMoney(cogs, currency) },
          { label: "Gross profit", value: formatMoney(grossProfit, currency) },
          { label: "Gross margin", value: formatPercentage(grossMargin) },
        ],
        [
          "COGS includes expense categories matching inventory, supplies, materials, and similar names.",
        ],
        `${formatMoney(grossProfit, currency)} ÷ ${formatMoney(income, currency)} × 100 = ${formatPercentage(grossMargin)}`,
      ),
    });
  }

  metrics.push({
    key: "savings_rate",
    label: isBusiness ? "Net margin" : "Savings rate",
    value: formatPercentage(savingsRate),
    benchmark: isBusiness ? "15–25%" : "10–20%",
    trend: flowIconForChange(savingsRate, priorSavingsRate, "income"),
    calculation: calculationBlock(
      `(${isBusiness ? "Net profit" : "Net savings"} ÷ ${isBusiness ? "Revenue" : "Total income"}) × 100`,
      [
        {
          label: isBusiness ? "Revenue" : "Total income",
          value: formatMoney(income, currency),
        },
        { label: "Total expenses", value: formatMoney(expenses, currency) },
        {
          label: isBusiness ? "Net profit" : "Net savings",
          value: formatMoney(net, currency),
        },
        {
          label: isBusiness ? "Net margin" : "Savings rate",
          value: formatPercentage(savingsRate),
        },
      ],
      [
        income === 0
          ? "No income in this period, so the rate shows as 0%."
          : "Uses transactions in your selected date range.",
        "The flow icon compares this period’s rate to the prior period of equal length.",
      ],
      income === 0
        ? undefined
        : `${formatMoney(net, currency)} ÷ ${formatMoney(income, currency)} × 100 = ${formatPercentage(savingsRate)}`,
    ),
  });

  metrics.push({
    key: "emergency_fund",
    label: isBusiness ? "Cash runway" : "Emergency fund",
    value: emergencyDisplay,
    benchmark: isBusiness ? "8+ weeks" : "3–6 months",
    trend: null,
    calculation: calculationBlock(
      "Total cash ÷ Average monthly expenses",
      [
        {
          label: "Total cash (liquid accounts)",
          value: formatMoney(liquid, currency),
        },
        {
          label: `Expenses (last ${EMERGENCY_FUND_LOOKBACK_MONTHS} months)`,
          value: formatMoney(trailingExpenses, currency),
        },
        ...(monthlyExpenses > 0
          ? [
              {
                label: "Avg monthly expenses",
                value: formatMoney(monthlyExpenses, currency),
              },
            ]
          : []),
        {
          label: isBusiness ? "Cash runway" : "Emergency fund",
          value: emergencyDisplay,
        },
      ],
      monthlyExpenses === 0
        ? [
            `Add expenses in the last ${EMERGENCY_FUND_LOOKBACK_MONTHS} months to calculate coverage.`,
          ]
        : [
            `Avg monthly expenses = expenses in the last ${EMERGENCY_FUND_LOOKBACK_MONTHS} months ÷ ${EMERGENCY_FUND_LOOKBACK_MONTHS} months (${lookbackStart}–${endDate}).`,
            "Cash is the sum of liquid account balances converted to your space currency.",
            "Independent of your selected insights date range.",
          ],
      monthlyExpenses > 0
        ? `${formatMoney(liquid, currency)} ÷ ${formatMoney(monthlyExpenses, currency)} = ${emergencyDisplay}`
        : undefined,
    ),
  });

  const expenseChange = percentChange(expenses, priorExpenses);
  if (expenseChange != null) {
    metrics.push({
      key: "expense_change",
      label: "Expense vs prior period",
      value: expenseChangeLabel(expenseChange),
      benchmark: "Stable",
      trend: flowIconForChange(expenses, priorExpenses, "expense"),
      calculation: calculationBlock(
        "(This period expenses − Prior period expenses) ÷ Prior period expenses × 100",
        [
          {
            label: "This period expenses",
            value: formatMoney(expenses, currency),
          },
          {
            label: "Prior period expenses",
            value: formatMoney(priorExpenses, currency),
          },
          { label: "Change", value: expenseChangeLabel(expenseChange) },
        ],
        [
          "Prior period is the same number of days immediately before your selected range.",
        ],
        `(${formatMoney(expenses, currency)} − ${formatMoney(priorExpenses, currency)}) ÷ ${formatMoney(priorExpenses, currency)} × 100 = ${formatPercentage(expenseChange)}`,
      ),
    });
  }

  const cards: InsightCard[] = [];
  const categorizedCount = currentTx.filter(
    (tx) => Boolean(tx.categoryName) && tx.categoryName !== "Uncategorized",
  ).length;
  const count = currentTx.length;
  const categorizedPercent = count === 0 ? 0 : (categorizedCount / count) * 100;
  const completenessTier =
    count < 10
      ? "sparse"
      : count < 30 || categorizedPercent < 70
        ? "building"
        : "complete";

  const totalBudget = budgets.reduce(
    (sum, budget) => sum + toNumber(budget.amount),
    0,
  );
  const budgetUsagePercent = totalBudget > 0 ? (expenses / totalBudget) * 100 : null;

  const months = Math.max(periodDays / 30, 1);
  const monthlyIncome = income / months;
  const loans = (loansData?.pages ?? []).flatMap((page) => page.loans);
  const monthlyDebt = monthlyIncome > 0
    ? loans
      .filter((loan) => loan.loanType === "borrowed" && loan.status === "active")
      .reduce((sum, loan) => sum + estimateMonthlyLoanPayment(loan), 0)
    : 0;

  const profileCards = buildOfflineProfileCards({
    income,
    expenses,
    net,
    priorIncome,
    savingsRate,
    monthlyDebt,
    periodDays,
    totalBudget,
    budgetUsagePercent,
    transactions: currentTx,
    investmentAccountNames: extractInvestmentAccountNames(accountsResponse),
    currency,
    isBusiness,
    completenessTier,
  });
  const profileKeys = new Set(
    profileCards.map((card) => card.profileKey).filter(Boolean),
  );

  if (income > 0 && !profileKeys.has("strong_saver")) {
    if (savingsRate >= 20) {
      cards.push(
        insightCard({
          type: "savings",
          severity: "positive",
          title: isBusiness ? "Healthy net margin" : "Strong savings rate",
          body: `You retained ${formatPercentage(savingsRate)} of ${isBusiness ? "revenue" : "income"} this period.`,
          actionLabel: "View transactions",
          actionHref: "/dashboard",
        }),
      );
    } else if (savingsRate >= 10) {
      cards.push(
        insightCard({
          type: "savings",
          severity: "neutral",
          title: isBusiness ? "Moderate profitability" : "Room to save more",
          body: `You retained ${formatPercentage(savingsRate)}. Aim for ${isBusiness ? "15–25%" : "10–20%"} to build a stronger buffer.`,
          actionLabel: "View transactions",
          actionHref: "/dashboard",
        }),
      );
    } else {
      cards.push(
        insightCard({
          type: "savings",
          severity: "warning",
          title: isBusiness ? "Thin margins" : "Low savings rate",
          body: net < 0
            ? "Expenses exceeded income. Review your largest spending categories."
            : "Consider trimming discretionary spending to improve cash flow.",
          actionLabel: "View transactions",
          actionHref: "/dashboard",
        }),
      );
    }
  }

  if (totalBudget > 0 && budgetUsagePercent != null && budgetUsagePercent >= 100) {
    const over = Math.max(0, expenses - totalBudget);
    cards.push(
      insightCard({
        type: "budget",
        severity: budgetUsagePercent >= 120 ? "warning" : "neutral",
        title: "Over budget",
        body: `You've used ${formatPercentage(budgetUsagePercent)} of your budget (${formatMoney(over, currency)} over).`,
        actionLabel: "Review budgets",
        actionHref: "/dashboard/budgets",
      }),
    );
  }

  if (monthlyIncome > 0 && monthlyDebt > 0 && !profileKeys.has("debt_crusher")) {
    const ratio = (monthlyDebt / monthlyIncome) * 100;
    cards.push(
      insightCard({
        type: "debt",
        severity: ratio >= 40 ? "warning" : ratio >= 30 ? "neutral" : "positive",
        title: isBusiness ? "Debt service load" : "Debt-to-income",
        body: `Estimated debt payments are ${formatPercentage(ratio)} of monthly income. Lenders often prefer below 36%.`,
        actionLabel: "View loans",
        actionHref: "/dashboard/loans",
      }),
    );
  }

  const currentByCategory = expensesByCategory(currentTx);
  const priorByCategory = expensesByCategory(priorTx);
  const spikes: InsightCard[] = [];
  for (const [name, amount] of currentByCategory) {
    const priorAmount = priorByCategory.get(name) ?? 0;
    if (priorAmount === 0 || amount <= priorAmount) {
      continue;
    }
    const change = ((amount - priorAmount) / priorAmount) * 100;
    if (change < 15) {
      continue;
    }
    spikes.push(
      insightCard({
        type: "category_trend",
        severity: change >= 30 ? "warning" : "neutral",
        title: `${name} spending up`,
        body: `${name} is ${formatPercentage(change)} higher than the prior period.`,
        actionLabel: "Filter transactions",
        actionHref: `/dashboard?category=${encodeURIComponent(name)}`,
      }),
    );
  }
  if (spikes.length > 0) {
    spikes.sort((a, b) => b.body.length - a.body.length);
    cards.push(spikes[0]);
  }

  const remainingSlots = Math.max(0, MAX_INSIGHTS - Math.min(profileCards.length, MAX_INSIGHTS));
  cards.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const merged = [
    ...profileCards.slice(0, MAX_INSIGHTS),
    ...cards.slice(0, remainingSlots),
  ].slice(0, MAX_INSIGHTS);

  const strongestProfile = merged.find((card) => card.type === "profile");
  const headlineText = strongestProfile
    ? profileHeadline({
      title: strongestProfile.title,
      net,
      income,
      currency,
      isBusiness,
    })
    : isBusiness
    ? net >= 0
      ? `Profitable period — net ${formatMoney(net, currency)} after expenses.`
      : `Cash negative this period — net ${formatMoney(net, currency)}. Review operating costs.`
    : net >= 0
    ? `You kept ${formatMoney(net, currency)} this period.`
    : `You spent ${formatMoney(Math.abs(net), currency)} more than you earned.`;

  return {
    headline: {
      text: headlineText,
      sentiment: strongestProfile || net >= 0 ? "positive" : "negative",
    },
    metrics,
    insights: merged,
    dataQuality: {
      transactionCount: count,
      categorizedPercent: formatPercentage(categorizedPercent),
      completenessTier,
    },
  };
};
