import { AccountCategory } from "@/types/accountTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import type { InsightCard, InsightProfileKey } from "./types";

const INVESTMENT_CATEGORY_PATTERN =
  /invest|stocks?|crypto|mutual\s*fund|etf|brokerage|securities|portfolio/i;

export const PROFILE_PRIORITY: InsightProfileKey[] = [
  "strong_saver",
  "debt_crusher",
  "steady_investor",
  "high_earner",
  "balanced_budgeter",
  "avid_spender",
];

const INVESTMENT_FLOOR_UNITS = 1000;
const HIGH_EARNER_INCOME_LIFT = 15;
const AVID_SPENDER_EXPENSE_SHARE = 70;
const STRONG_SAVER_RATE = 20;
const HEALTHY_DEBT_RATIO_MAX = 30;

const formatPercentage = (value: number): string => `${value.toFixed(2)}%`;

const formatMoney = (amount: number, currency: string): string => {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${currency} ${sign}${formatted}`;
};

const profileCard = (
  profileKey: InsightProfileKey,
  title: string,
  body: string,
  actionLabel: string,
  actionHref: string,
): InsightCard => ({
  type: "profile",
  severity: "positive",
  title,
  body,
  actionLabel,
  actionHref,
  profileKey,
  imageKey: profileKey,
});

export const buildOfflineProfileCards = (params: {
  income: number;
  expenses: number;
  net: number;
  priorIncome: number;
  savingsRate: number;
  monthlyDebt: number;
  periodDays: number;
  totalBudget: number;
  budgetUsagePercent: number | null;
  transactions: IndexTransaction[];
  investmentAccountNames: Set<string>;
  currency: string;
  isBusiness: boolean;
  completenessTier: "sparse" | "building" | "complete";
}): InsightCard[] => {
  if (params.completenessTier === "sparse") {
    return [];
  }

  const {
    income,
    expenses,
    net,
    priorIncome,
    savingsRate,
    monthlyDebt,
    periodDays,
    totalBudget,
    budgetUsagePercent,
    transactions,
    investmentAccountNames,
    currency,
    isBusiness,
  } = params;

  const candidates: InsightCard[] = [];

  if (savingsRate >= STRONG_SAVER_RATE) {
    candidates.push(
      profileCard(
        "strong_saver",
        isBusiness ? "Healthy Margin" : "Strong Saver",
        `You retained ${formatPercentage(savingsRate)} of ${isBusiness ? "revenue" : "income"} this period — outstanding buffer-building.`,
        "View transactions",
        "/dashboard",
      ),
    );
  }

  const months = Math.max(periodDays / 30, 1);
  const monthlyIncome = income / months;
  if (monthlyIncome > 0 && monthlyDebt > 0) {
    const ratio = (monthlyDebt / monthlyIncome) * 100;
    if (ratio < HEALTHY_DEBT_RATIO_MAX) {
      candidates.push(
        profileCard(
          "debt_crusher",
          isBusiness ? "Debt Service Healthy" : "Debt Crusher",
          `Debt payments are only ${formatPercentage(ratio)} of monthly income — you’re in a strong repayment zone.`,
          "View loans",
          "/dashboard/loans",
        ),
      );
    }
  }

  const invested = transactions.reduce((sum, tx) => {
    if (tx.type === CombinedTransactionTypeEnum.EXPENSE) {
      const amount = Math.abs(Number(tx.amount) || 0);
      const categoryMatch = INVESTMENT_CATEGORY_PATTERN.test(
        tx.categoryName || "",
      );
      const accountMatch = investmentAccountNames.has(tx.fromAccountName || "");
      if (categoryMatch || accountMatch) {
        return sum + amount;
      }
    }
    if (tx.type === CombinedTransactionTypeEnum.TRANSFER) {
      const amount = Math.abs(Number(tx.amount) || 0);
      if (investmentAccountNames.has(tx.toAccountName || "")) {
        return sum + amount;
      }
    }
    return sum;
  }, 0);
  const investmentFloor = Math.max(INVESTMENT_FLOOR_UNITS, income * 0.05);
  if (invested >= investmentFloor) {
    candidates.push(
      profileCard(
        "steady_investor",
        isBusiness ? "Capital Deployed" : "Steady Investor",
        `You put ${formatMoney(invested, currency)} toward investments this period — future-you is cheering.`,
        "View accounts",
        "/dashboard",
      ),
    );
  }

  if (income > 0 && priorIncome > 0) {
    const lift = ((income - priorIncome) / priorIncome) * 100;
    if (lift >= HIGH_EARNER_INCOME_LIFT) {
      candidates.push(
        profileCard(
          "high_earner",
          isBusiness ? "Revenue Climb" : "High Earner",
          `${isBusiness ? "Revenue" : "Income"} rose ${formatPercentage(lift)} vs the prior period (${formatMoney(income, currency)}) — celebrate the climb.`,
          "View transactions",
          "/dashboard",
        ),
      );
    }
  }

  if (
    totalBudget > 0
    && budgetUsagePercent != null
    && budgetUsagePercent <= 100
  ) {
    candidates.push(
      profileCard(
        "balanced_budgeter",
        isBusiness ? "On-Budget Operator" : "Balanced Budgeter",
        `You stayed at ${formatPercentage(budgetUsagePercent)} of budget this period — disciplined and on track.`,
        "Review budgets",
        "/dashboard/budgets",
      ),
    );
  }

  if (income > 0 && expenses > 0) {
    const share = (expenses / income) * 100;
    if (share >= AVID_SPENDER_EXPENSE_SHARE) {
      const body = net < 0
        ? `You put ${formatPercentage(share)} of ${isBusiness ? "revenue" : "income"} into action this period — living your money. Keep an eye on the buffer.`
        : `You put ${formatPercentage(share)} of ${isBusiness ? "revenue" : "income"} into action this period — living your money with intention.`;
      candidates.push(
        profileCard(
          "avid_spender",
          isBusiness ? "Active Operator" : "Avid Spender",
          body,
          "View transactions",
          "/dashboard",
        ),
      );
    }
  }

  return candidates.sort(
    (a, b) =>
      PROFILE_PRIORITY.indexOf(a.profileKey!)
      - PROFILE_PRIORITY.indexOf(b.profileKey!),
  );
};

export const extractInvestmentAccountNames = (
  accountsResponse: unknown,
): Set<string> => {
  const names = new Set<string>();
  if (!accountsResponse || typeof accountsResponse !== "object") {
    return names;
  }

  const root = accountsResponse as Record<string, unknown>;
  const data = root.data;
  const lists = [
    root.accounts,
    data && typeof data === "object"
      ? (data as Record<string, unknown>).accounts
      : undefined,
    Array.isArray(data) ? data : undefined,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const item of list) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const account = item as {
        name?: string;
        accountCategory?: string;
        account_category?: string;
      };
      const category = account.accountCategory ?? account.account_category;
      if (category === AccountCategory.INVESTMENT && account.name) {
        names.add(account.name);
      }
    }
  }

  return names;
};

export const profileHeadline = (params: {
  title: string;
  net: number;
  income: number;
  currency: string;
  isBusiness: boolean;
}): string => {
  const highlight = params.net >= 0
    ? `kept ${formatMoney(params.net, params.currency)}`
    : params.income > 0
    ? `earned ${formatMoney(params.income, params.currency)}`
    : "kept moving";
  if (params.isBusiness) {
    return `Your space looks like a ${params.title} — ${highlight} this period.`;
  }
  return `You’re a ${params.title} — ${highlight} this period.`;
};
