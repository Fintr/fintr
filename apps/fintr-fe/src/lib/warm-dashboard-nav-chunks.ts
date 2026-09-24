/**
 * Dynamic imports for dashboard + Menu routes. Loading these while online pulls
 * the route page modules and their `/_next/static/chunks/*` deps into the SW cache.
 *
 * Next.js App Router splits each `page.tsx` into its own chunk — tapping a Menu
 * link navigates to a new route and fetches new JS unless we warm it here.
 *
 * Load one module per idle slice. Importing every page at once spikes RAM on
 * dashboard open and can take the machine down.
 */
let didWarmDashboardNavTabChunks = false;

const DASHBOARD_NAV_CHUNK_LOADERS: Array<() => Promise<unknown>> = [
  () => import("@/app/(private)/dashboard/home/page"),
  () => import("@/app/(private)/dashboard/page"),
  () => import("@/app/(private)/dashboard/insights/page"),
  () => import("@/app/(private)/dashboard/app_settings/page"),
  () => import("@/app/(private)/dashboard/budgets/page"),
  () => import("@/app/(private)/dashboard/loans/page"),
  () => import("@/app/(private)/dashboard/recurring/page"),
  () => import("@/app/(private)/dashboard/recurring/detail/page"),
  () => import("@/components/dashboard/tabs/recurring"),
  () => import("@/app/(private)/dashboard/loans/detail/page"),
  () => import("@/app/(private)/dashboard/transactions/detail/page"),
  () => import("@/app/(private)/dashboard/settings/page"),
  () => import("@/app/(private)/dashboard/space_settings/page"),
  () => import("@/app/(private)/dashboard/space_settings/entities/page"),
  () => import("@/app/(private)/dashboard/space_settings/entities/detail/page"),
  () => import("@/app/(private)/dashboard/space_settings/accounts/page"),
  () => import("@/app/(private)/dashboard/space_settings/accounts/detail/page"),
  () => import("@/app/(private)/dashboard/space_settings/categories/page"),
  () => import("@/app/(private)/dashboard/space_settings/categories/detail/page"),
  () => import("@/app/(private)/dashboard/space_settings/tags/page"),
  () => import("@/app/(private)/dashboard/space_settings/import/page"),
  () => import("@/app/(private)/dashboard/space_settings/subscriptions/page"),
  () => import("@/components/dashboard/tabs/home"),
  () => import("@/components/dashboard/tabs/transactions/index"),
  () => import("@/components/dashboard/tabs/insights-tab"),
  () => import("@/components/dashboard/tabs/space-settings-tab"),
  () => import("@/components/dashboard/entities/entities-page-content"),
];

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}

export const warmDashboardNavTabChunks = async (): Promise<void> => {
  if (didWarmDashboardNavTabChunks) {
    return;
  }

  didWarmDashboardNavTabChunks = true;

  for (const load of DASHBOARD_NAV_CHUNK_LOADERS) {
    await waitForIdle();
    await load().catch(() => undefined);
  }
};
