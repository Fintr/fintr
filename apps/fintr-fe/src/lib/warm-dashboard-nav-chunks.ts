/**
 * Dynamic imports for bottom-nav routes. Loading these while online pulls the
 * route page modules and their `/_next/static/chunks/*` deps into the dev SW cache.
 *
 * Next.js App Router splits each `page.tsx` into its own chunk — tapping a bottom
 * nav link navigates to a new route and fetches new JS unless we warm it here.
 */
export const warmDashboardNavTabChunks = async (): Promise<void> => {
  await Promise.allSettled([
    import("@/app/(private)/dashboard/home/page"),
    import("@/app/(private)/dashboard/page"),
    import("@/app/(private)/dashboard/insights/page"),
    import("@/app/(private)/dashboard/app_settings/page"),
    import("@/components/dashboard/tabs/home"),
    import("@/components/dashboard/tabs/transactions/index"),
    import("@/components/dashboard/tabs/insights-tab"),
  ]);
};
