import type { DashboardBottomTab } from "@/lib/dashboard-nav-routes";

/** Mobile has four bottom tabs. Desktop extras evict the oldest mounted screen. */
export const MAX_CACHED_BOTTOM_NAV_SCREENS = 4;

export function nextCachedBottomNavTabs(
  cached: readonly DashboardBottomTab[],
  activeTab: DashboardBottomTab | null,
  maxCached: number = MAX_CACHED_BOTTOM_NAV_SCREENS,
): DashboardBottomTab[] {
  if (activeTab == null) {
    return [...cached];
  }

  const rest = cached.filter((tab) => tab !== activeTab);
  return [...rest, activeTab].slice(-maxCached);
}
