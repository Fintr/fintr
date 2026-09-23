import {
  resolveVisibleDashboardBottomTab,
  type DashboardBottomTab,
} from "@/lib/dashboard-nav-routes";

/**
 * Routes that use `app/(private)/dashboard/layout.tsx` as their shell.
 * For these, that layout already applies mobile bottom padding and BottomNavigation;
 * the parent `app/(private)/layout.tsx` must not duplicate them (double padding / stacked navs).
 */
export function isDashboardShellRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/dashboard/subscriptions/create")
  );
}

/** Routes with a full-bleed primary hero that replace the mobile sticky header. */
export function hasEmbeddedHeroHeader(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/home") ||
    pathname.startsWith("/dashboard/insights")
  );
}

/**
 * Settings and Insights routes compute their own local data pipelines.
 * Blocking the whole layout on summary fetch causes a full-screen splash offline.
 */
export function isDashboardDataLightRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/insights")
    || pathname.startsWith("/dashboard/space_settings")
    || pathname.startsWith("/dashboard/app_settings")
    || pathname.startsWith("/dashboard/settings")
  );
}

/** @deprecated Use isDashboardDataLightRoute */
export function isDashboardSettingsRoute(pathname: string): boolean {
  return isDashboardDataLightRoute(pathname);
}

export function resolveDashboardShellPresentation(params: {
  pathname: string;
  pendingTab: DashboardBottomTab | null;
}): {
  visibleTab: DashboardBottomTab | null;
  usesEmbeddedHeroHeader: boolean;
  isLightDashboardRoute: boolean;
  showRouteChildren: boolean;
} {
  const visibleTab = resolveVisibleDashboardBottomTab(params);

  return {
    visibleTab,
    usesEmbeddedHeroHeader:
      visibleTab === "home" ||
      visibleTab === "insights" ||
      (visibleTab === null && hasEmbeddedHeroHeader(params.pathname)),
    isLightDashboardRoute:
      visibleTab === "insights" ||
      visibleTab === "menu" ||
      visibleTab === "space_settings" ||
      (visibleTab === null && isDashboardDataLightRoute(params.pathname)),
    showRouteChildren: visibleTab === null,
  };
}
