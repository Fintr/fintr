/** Bottom-navigation targets prefetched while online for offline client navigations. */
export const DASHBOARD_BOTTOM_NAV_ROUTES = [
  "/dashboard/home",
  "/dashboard/",
  "/dashboard/insights",
  "/dashboard/app_settings",
] as const;

/** Menu cards on app_settings — not in the bottom nav, still reachable offline. */
export const DASHBOARD_MENU_ROUTES = [
  "/dashboard/budgets",
  "/dashboard/loans",
  "/dashboard/recurring",
  "/dashboard/space_settings/categories",
  "/dashboard/space_settings/accounts",
  "/dashboard/space_settings/entities",
  "/dashboard/space_settings/tags",
  "/dashboard/space_settings/import",
  "/dashboard/space_settings/subscriptions",
  "/dashboard/settings",
] as const;

/** List → detail pages. Each is its own App Router chunk; skip these and offline nav 503s. */
export const DASHBOARD_DETAIL_ROUTES = [
  "/dashboard/loans/detail",
  "/dashboard/transactions/detail",
  "/dashboard/recurring/detail",
  "/dashboard/space_settings/accounts/detail",
  "/dashboard/space_settings/entities/detail",
  "/dashboard/space_settings/categories/detail",
] as const;

export const DASHBOARD_OFFLINE_PREFETCH_ROUTES = [
  ...DASHBOARD_BOTTOM_NAV_ROUTES,
  ...DASHBOARD_MENU_ROUTES,
  ...DASHBOARD_DETAIL_ROUTES,
] as const;
