import type { AxiosInstance } from "axios";
import type { QueryClient } from "@tanstack/react-query";

import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";

import { fetchMonthlyFinancialSummaries } from "./queries";
import type { DashboardData } from "@/types/spaceTypes";
import type { ExchangeRateLookup } from "@/services/insights/space-currency-amount";

import { combineMonthlyFinancialSummaries, financialSummaryForDateRange } from "./combine";
import {
  hydrateMonthlyFinancialSummariesFromLocalTransactions,
  mergeSummariesPreferNonEmpty,
  summariesNeedLocalHydration,
} from "./hydrate-from-local-transactions";
import {
  normalizeMonthlyFinancialSummaries,
} from "./normalize";
import type { MonthlyFinancialSummary } from "./types";

const summariesKey = (spaceCode: string): string =>
  `monthlyFinancialSummaries:${spaceCode}`;

const spaceRequestConfig = (spaceCode: string) => ({
  headers: { "X-Space-Code": spaceCode },
});

const dashboardShellKey = (spaceCode: string): string =>
  `dashboardShell:${spaceCode}`;

export type DashboardShell = {
  id: string;
  categoryOptions: DashboardData["categoryOptions"];
  accountOptions: DashboardData["accountOptions"];
  expenseCategoryOptions: DashboardData["expenseCategoryOptions"];
  incomeCategoryOptions: DashboardData["incomeCategoryOptions"];
  goalDescription: string;
  earliestTransactionDate?: string | null;
};

export const dashboardShellFromDashboard = (
  dashboard: DashboardData,
): DashboardShell => ({
  id: dashboard.id,
  categoryOptions: dashboard.categoryOptions,
  accountOptions: dashboard.accountOptions,
  expenseCategoryOptions: dashboard.expenseCategoryOptions,
  incomeCategoryOptions: dashboard.incomeCategoryOptions,
  goalDescription: dashboard.goalDescription,
  earliestTransactionDate: dashboard.earliestTransactionDate ?? null,
});

/** Dashboard payload with financialSummary computed from monthly buckets. */
export const buildDashboardDataFromBuckets = (
  shell: DashboardShell,
  summaries: MonthlyFinancialSummary[],
  startDate: string,
  endDate: string,
  options?: {
    transactions?: IndexTransaction[];
    spaceCurrency?: string;
    rateLookup?: ExchangeRateLookup;
  },
): DashboardData => ({
  id: shell.id,
  categoryOptions: shell.categoryOptions,
  accountOptions: shell.accountOptions,
  expenseCategoryOptions: shell.expenseCategoryOptions,
  incomeCategoryOptions: shell.incomeCategoryOptions,
  goalDescription: shell.goalDescription,
  earliestTransactionDate: shell.earliestTransactionDate ?? null,
  financialSummary:
    options?.transactions && options.transactions.length > 0
      ? financialSummaryForDateRange({
          summaries,
          transactions: options.transactions,
          startDate,
          endDate,
          spaceCurrency: options.spaceCurrency,
          rateLookup: options.rateLookup,
        })
      : combineMonthlyFinancialSummaries(
          summaries,
          startDate,
          endDate,
        ),
});

export const cacheMonthlyFinancialSummaries = async (
  spaceCode: string,
  summaries: MonthlyFinancialSummary[] | null | undefined,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  const normalized = normalizeMonthlyFinancialSummaries(summaries);

  try {
    await putLocalResponseSnapshot(summariesKey(spaceCode), normalized);
  } catch (error) {
    console.warn(
      "[local-db] Failed to cache monthly financial summaries",
      error,
    );
  }
};

/**
 * Ensure `monthlyFinancialSummaries:{spaceCode}` exists in IndexedDB meta.
 * Fetches from the API when the key was never written or is still empty after bootstrap.
 */
export const ensureMonthlyFinancialSummariesCached = async (
  api: AxiosInstance,
  spaceCode: string,
  options?: { refetchWhenEmpty?: boolean },
): Promise<MonthlyFinancialSummary[]> => {
  if (!spaceCode) {
    return [];
  }

  const cached = await loadCachedMonthlyFinancialSummaries(spaceCode);
  const shouldRefetchFromApi =
    cached === undefined
    || (options?.refetchWhenEmpty
      && (cached.length === 0 || await summariesNeedLocalHydration(spaceCode, cached)));

  if (cached !== undefined && !shouldRefetchFromApi) {
    return cached;
  }

  try {
    const fetched = await fetchMonthlyFinancialSummaries(api, {
      requestConfig: spaceRequestConfig(spaceCode),
    });
    const merged = mergeSummariesPreferNonEmpty(cached ?? [], fetched);
    await cacheMonthlyFinancialSummaries(spaceCode, merged);

    if (await summariesNeedLocalHydration(spaceCode, merged)) {
      return await hydrateMonthlyFinancialSummariesFromLocalTransactions(
        spaceCode,
        { existingSummaries: merged },
      );
    }

    return merged;
  } catch (error) {
    console.warn(
      "[local-db] Failed to fetch monthly financial summaries",
      spaceCode,
      error,
    );
    await cacheMonthlyFinancialSummaries(spaceCode, []);
    return [];
  }
};

export const loadCachedMonthlyFinancialSummaries = async (
  spaceCode: string,
): Promise<MonthlyFinancialSummary[] | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    const snapshot = await getLocalResponseSnapshot<unknown>(
      summariesKey(spaceCode),
    );

    if (snapshot == null) {
      return undefined;
    }

    return normalizeMonthlyFinancialSummaries(snapshot);
  } catch (error) {
    console.warn(
      "[local-db] Failed to load monthly financial summaries",
      error,
    );
    return undefined;
  }
};

export const cacheDashboardShell = async (
  spaceCode: string,
  shell: DashboardShell,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    await putLocalResponseSnapshot(dashboardShellKey(spaceCode), shell);
  } catch (error) {
    console.warn("[local-db] Failed to cache dashboard shell", error);
  }
};

export const loadCachedDashboardShell = async (
  spaceCode: string,
): Promise<DashboardShell | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<DashboardShell>(
      dashboardShellKey(spaceCode),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load dashboard shell", error);
    return undefined;
  }
};

const toSummaryNumber = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const lastDayOfMonth = (year: number, month: number): string => {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * Adjust the matching month bucket when a local transaction is added/removed.
 * Keeps dashboard/insights totals aligned while offline-ready.
 * Returns the next summaries snapshot (or null when nothing changed).
 */
export const applyLocalTransactionToMonthlySummaries = async (params: {
  spaceCode: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  mode: "add" | "remove";
  currency?: string;
}): Promise<MonthlyFinancialSummary[] | null> => {
  const { spaceCode, date, amount, type, mode, currency = "PHP" } = params;
  if (!spaceCode || !date || !Number.isFinite(amount)) {
    return null;
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  const signed = mode === "add" ? amount : -amount;
  const existing = (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? [];
  const index = existing.findIndex(
    (row) => row.year === year && row.month === month,
  );

  if (index < 0) {
    if (mode === "remove") {
      return null;
    }

    const income = type === "income" ? signed : 0;
    const expenses = type === "expense" ? signed : 0;
    const net = income - expenses;
    const created: MonthlyFinancialSummary = {
      id: `local:${year}-${String(month).padStart(2, "0")}`,
      year,
      month,
      currency,
      fxBased: false,
      calculatedAt: new Date().toISOString(),
      totalIncome: income,
      totalExpenses: expenses,
      netSavings: net,
      savingsPercentage: income === 0 ? 0 : (net / income) * 100,
      monthStartDate: `${year}-${String(month).padStart(2, "0")}-01`,
      monthEndDate: lastDayOfMonth(year, month),
    };
    const next = [...existing, created];
    await cacheMonthlyFinancialSummaries(spaceCode, next);
    return next;
  }

  const row = existing[index];
  const totalIncome =
    toSummaryNumber(row.totalIncome) + (type === "income" ? signed : 0);
  const totalExpenses =
    toSummaryNumber(row.totalExpenses) + (type === "expense" ? signed : 0);
  const netSavings = totalIncome - totalExpenses;

  const next = [...existing];
  next[index] = {
    ...row,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsPercentage:
      totalIncome === 0 ? 0 : (netSavings / totalIncome) * 100,
    calculatedAt: new Date().toISOString(),
  };

  await cacheMonthlyFinancialSummaries(spaceCode, next);
  return next;
};

export const repairOfflineSpaceCaches = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  spaceCodes: string[],
): Promise<void> => {
  for (const spaceCode of spaceCodes) {
    if (!spaceCode) {
      continue;
    }

    try {
      let summaries = await ensureMonthlyFinancialSummariesCached(
        api,
        spaceCode,
        { refetchWhenEmpty: true },
      );

      if (await summariesNeedLocalHydration(spaceCode, summaries)) {
        summaries = await hydrateMonthlyFinancialSummariesFromLocalTransactions(
          spaceCode,
          { existingSummaries: summaries },
        );
      }

      queryClient.setQueryData(
        ["monthlyFinancialSummaries", "local", spaceCode],
        summaries,
      );
      queryClient.setQueryData(
        ["monthlyFinancialSummaries", spaceCode],
        summaries,
      );
      queryClient.invalidateQueries({
        queryKey: ["insights", "local", spaceCode],
      });
    } catch (error) {
      console.warn(
        "[local-sync] Monthly summaries repair failed",
        spaceCode,
        error,
      );
    }
  }
};

/** Push monthly-summary buckets into React Query so Income/Expenses cards update immediately. */
export const setMonthlyFinancialSummariesQueryData = (
  queryClient: QueryClient,
  spaceCode: string,
  summaries: MonthlyFinancialSummary[],
): void => {
  if (!spaceCode) return;
  queryClient.setQueryData(
    ["monthlyFinancialSummaries", spaceCode],
    summaries,
  );
  queryClient.setQueryData(
    ["monthlyFinancialSummaries", "local", spaceCode],
    summaries,
  );
};
