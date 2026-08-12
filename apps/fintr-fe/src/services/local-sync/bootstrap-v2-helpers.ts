import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import type { SyncBootstrapResponse } from "@/types/syncTypes";

/** Read monthly summaries from bootstrap payload (camelCase or legacy snake_case). */
export const resolveBootstrapMonthlySummaries = (
  bundle: SyncBootstrapResponse | Record<string, unknown>,
): MonthlyFinancialSummary[] => {
  const camel = (bundle as SyncBootstrapResponse).monthlyFinancialSummaries;
  if (Array.isArray(camel)) {
    return camel as MonthlyFinancialSummary[];
  }

  const snake = (bundle as Record<string, unknown>).monthly_financial_summaries;
  if (Array.isArray(snake)) {
    return snake as MonthlyFinancialSummary[];
  }

  return [];
};

export const verifyBootstrapTotals = (bundle: SyncBootstrapResponse): void => {
  if (bundle.totals.truncated) {
    throw new Error("Bootstrap snapshot was truncated");
  }

  if (bundle.transactions.length !== bundle.totals.transactions) {
    throw new Error(
      `Bootstrap transaction count mismatch: expected ${bundle.totals.transactions}, got ${bundle.transactions.length}`,
    );
  }
};
