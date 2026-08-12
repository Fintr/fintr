import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import {
  buildDashboardDataFromBuckets,
  loadCachedDashboardShell,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import type { DashboardData, FinancialSummary } from "@/types/spaceTypes";

export const dashboardResponseCacheKey = (
  spaceId: string,
  startDate?: string,
  endDate?: string,
): string =>
  `dashboardResponse:${spaceId}:${startDate ?? ""}:${endDate ?? ""}`;

const dashboardCacheKey = dashboardResponseCacheKey;

const financialSummaryHasSignal = (
  financialSummary: FinancialSummary | undefined,
): boolean => {
  if (!financialSummary) {
    return false;
  }

  const totalIncome = Number.parseFloat(financialSummary.totalIncome) || 0;
  const totalExpenses = Number.parseFloat(financialSummary.totalExpenses) || 0;

  return totalIncome !== 0 || totalExpenses !== 0;
};

export const cacheDashboardResponse = async (
  spaceId: string,
  data: DashboardData,
  startDate?: string,
  endDate?: string
): Promise<void> => {
  if (!spaceId) {
    return;
  }

  try {
    await putLocalResponseSnapshot(
      dashboardCacheKey(spaceId, startDate, endDate),
      data
    );
  } catch (error) {
    console.warn("[local-db] Failed to cache dashboard response", error);
  }
};

const buildDashboardFromMonthlyBuckets = async (
  spaceId: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardData | undefined> => {
  if (!startDate || !endDate) {
    return undefined;
  }

  const [shell, summaries] = await Promise.all([
    loadCachedDashboardShell(spaceId),
    loadCachedMonthlyFinancialSummaries(spaceId),
  ]);

  if (!shell || !summaries || summaries.length === 0) {
    return undefined;
  }

  return buildDashboardDataFromBuckets(shell, summaries, startDate, endDate);
};

/** Range-scoped dashboard financialSummary stored in IndexedDB response cache. */
export const loadCachedDashboardFinancialSummary = async (
  spaceId: string,
  startDate: string,
  endDate: string,
): Promise<FinancialSummary | undefined> => {
  if (!spaceId || !startDate || !endDate) {
    return undefined;
  }

  try {
    const cached = await getLocalResponseSnapshot<DashboardData>(
      dashboardCacheKey(spaceId, startDate, endDate),
    );

    return cached?.financialSummary;
  } catch (error) {
    console.warn(
      "[local-db] Failed to load cached dashboard financial summary",
      error,
    );
    return undefined;
  }
};

export const loadCachedDashboardResponse = async (
  spaceId: string,
  startDate?: string,
  endDate?: string
): Promise<DashboardData | undefined> => {
  if (!spaceId) {
    return undefined;
  }

  try {
    // Always prefer bucket composition so the summary matches offline/online.
    const fromBuckets = await buildDashboardFromMonthlyBuckets(
      spaceId,
      startDate,
      endDate,
    );
    if (fromBuckets && financialSummaryHasSignal(fromBuckets.financialSummary)) {
      return fromBuckets;
    }

    return await getLocalResponseSnapshot<DashboardData>(
      dashboardCacheKey(spaceId, startDate, endDate),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached dashboard", error);
    return undefined;
  }
};
