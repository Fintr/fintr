import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import {
  buildDashboardDataFromBuckets,
  loadCachedDashboardShell,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import type { DashboardData } from "@/types/spaceTypes";

const dashboardCacheKey = (
  spaceId: string,
  startDate?: string,
  endDate?: string
): string =>
  `dashboardResponse:${spaceId}:${startDate ?? ""}:${endDate ?? ""}`;

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

  if (!shell || !summaries) {
    return undefined;
  }

  return buildDashboardDataFromBuckets(shell, summaries, startDate, endDate);
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
    if (fromBuckets) {
      return fromBuckets;
    }

    return await getLocalResponseSnapshot<DashboardData>(
      dashboardCacheKey(spaceId, startDate, endDate)
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached dashboard", error);
    return undefined;
  }
};
