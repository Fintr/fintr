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
 * Settings routes do not need the dashboard financial summary shell.
 * Blocking the whole layout on summary fetch causes a full-screen splash offline.
 */
export function isDashboardSettingsRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/space_settings") ||
    pathname.startsWith("/dashboard/app_settings") ||
    pathname.startsWith("/dashboard/settings")
  );
}
