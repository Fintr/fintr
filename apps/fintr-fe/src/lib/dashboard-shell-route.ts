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
