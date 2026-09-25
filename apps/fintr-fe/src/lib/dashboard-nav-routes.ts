import { shouldShowImmediateBackButton } from "@/lib/dashboard-back-button-routes";

export type DashboardBottomTab =
  | "home"
  | "transactions"
  | "insights"
  | "menu"
  | "space_settings"
  | "recurring"
  | "budgets"
  | "loans";

export type MobileBottomNavTab =
  | "home"
  | "transactions"
  | "insights"
  | "menu";

export const DASHBOARD_CACHED_INDEX_HREF = {
  space_settings: "/dashboard/space_settings",
  recurring: "/dashboard/recurring",
  budgets: "/dashboard/budgets",
  loans: "/dashboard/loans",
} as const satisfies Partial<Record<DashboardBottomTab, string>>;

export const DASHBOARD_BOTTOM_TAB_HREF: Record<DashboardBottomTab, string> = {
  home: "/dashboard/home",
  transactions: "/dashboard/",
  insights: "/dashboard/insights",
  menu: "/dashboard/app_settings",
  ...DASHBOARD_CACHED_INDEX_HREF,
};

export function dashboardTabShouldSlide(tab: DashboardBottomTab): boolean {
  return shouldShowImmediateBackButton(DASHBOARD_BOTTOM_TAB_HREF[tab]);
}

export function isDashboardCachedIndexPath(
  pathname: string,
  path: string,
): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const normalizedPath = path.replace(/\/$/, "") || "/";
  return normalized === normalizedPath;
}

export function isDashboardSpaceSettingsIndex(pathname: string): boolean {
  return isDashboardCachedIndexPath(pathname, "/dashboard/space_settings");
}

export function getDashboardBottomTab(
  pathname: string,
): DashboardBottomTab | null {
  if (pathname.startsWith("/dashboard/home")) {
    return "home";
  }

  if (pathname.startsWith("/dashboard/insights")) {
    return "insights";
  }

  if (pathname.startsWith("/dashboard/app_settings")) {
    return "menu";
  }

  for (const [tab, href] of Object.entries(DASHBOARD_CACHED_INDEX_HREF)) {
    if (isDashboardCachedIndexPath(pathname, href)) {
      return tab as DashboardBottomTab;
    }
  }

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "transactions";
  }

  return null;
}

const MOBILE_BOTTOM_NAV_TABS = new Set<DashboardBottomTab>([
  "home",
  "transactions",
  "insights",
  "menu",
]);

export function toMobileBottomNavTab(
  tab: DashboardBottomTab | null,
): MobileBottomNavTab | null {
  if (!tab) {
    return null;
  }

  if (MOBILE_BOTTOM_NAV_TABS.has(tab)) {
    return tab as MobileBottomNavTab;
  }

  return "menu";
}

export type DashboardTabClickEvent = {
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  preventDefault: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
};

/**
 * Stop unmodified left-clicks from doing a document navigation.
 * Pending-tab UI already swapped; history.pushState updates the URL.
 */
export function interceptDashboardTabClick(
  event: DashboardTabClickEvent,
): boolean {
  if ((event.button ?? 0) !== 0) {
    return false;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (!event.defaultPrevented) {
    event.preventDefault();
  }

  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
  return true;
}

let committedDashboardPathname: string | null = null;
const committedPathnameListeners = new Set<() => void>();

function emitCommittedDashboardPathname() {
  for (const listener of committedPathnameListeners) {
    listener();
  }
}

export function getDashboardCommittedPathname(): string | null {
  if (
    typeof window !== "undefined" &&
    committedDashboardPathname &&
    committedDashboardPathname !== window.location.pathname
  ) {
    return window.location.pathname;
  }

  return committedDashboardPathname;
}

export function resetDashboardCommittedPathname(): void {
  committedDashboardPathname = null;
}

export function subscribeDashboardCommittedPathname(
  listener: () => void,
): () => void {
  committedPathnameListeners.add(listener);
  return () => {
    committedPathnameListeners.delete(listener);
  };
}

export function syncDashboardCommittedPathnameFromLocation(): void {
  if (typeof window === "undefined") {
    return;
  }

  committedDashboardPathname = window.location.pathname;
  emitCommittedDashboardPathname();
}

export type DashboardClientRouteKey =
  | "loan_detail"
  | "transaction_detail"
  | "recurring_detail"
  | "account_detail"
  | "entity_detail"
  | "category_detail"
  | "accounts"
  | "entities"
  | "categories"
  | "tags"
  | "import"
  | "space_subscriptions"
  | "settings"
  | "goals"
  | "investments"
  | "subscriptions";

const DASHBOARD_CLIENT_ROUTE_KEYS: Record<string, DashboardClientRouteKey> = {
  "/dashboard/loans/detail": "loan_detail",
  "/dashboard/transactions/detail": "transaction_detail",
  "/dashboard/recurring/detail": "recurring_detail",
  "/dashboard/space_settings/accounts/detail": "account_detail",
  "/dashboard/space_settings/entities/detail": "entity_detail",
  "/dashboard/space_settings/categories/detail": "category_detail",
  "/dashboard/space_settings/accounts": "accounts",
  "/dashboard/space_settings/entities": "entities",
  "/dashboard/space_settings/categories": "categories",
  "/dashboard/space_settings/tags": "tags",
  "/dashboard/space_settings/import": "import",
  "/dashboard/space_settings/subscriptions": "space_subscriptions",
  "/dashboard/settings": "settings",
  "/dashboard/goals": "goals",
  "/dashboard/investments": "investments",
  "/dashboard/subscriptions": "subscriptions",
};

export function resolveDashboardClientRouteKey(
  pathname: string,
): DashboardClientRouteKey | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return DASHBOARD_CLIENT_ROUTE_KEYS[normalized] ?? null;
}

/**
 * Update the URL immediately. App Router `router.push` waits on the RSC
 * payload and remounts the private shell (full-app splash) while it hangs.
 */
export function commitDashboardClientNavigation(
  href: string,
  options?: { replace?: boolean },
): void {
  if (typeof window === "undefined") {
    return;
  }

  const next = new URL(href, window.location.origin);
  const nextHref = `${next.pathname}${next.search}${next.hash}`;
  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  committedDashboardPathname = next.pathname;

  if (nextHref !== currentHref) {
    if (options?.replace) {
      window.history.replaceState({}, "", nextHref);
    } else {
      window.history.pushState({}, "", nextHref);
    }
  }

  emitCommittedDashboardPathname();
}

function resolveSameOriginHref(
  href: string | null | undefined,
  origin: string,
): string | null {
  if (!href) {
    return null;
  }

  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  if (/^(mailto|tel|javascript):/i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function resolveInternalDashboardHref(
  href: string | null | undefined,
  origin: string,
): string | null {
  const resolved = resolveSameOriginHref(href, origin);
  if (!resolved) {
    return null;
  }

  const pathname = new URL(resolved, origin).pathname;
  if (!pathname.startsWith("/dashboard")) {
    return null;
  }

  return resolved;
}

const DASHBOARD_SHELL_EXIT_PREFIXES = ["/admin", "/crm"] as const;

export function resolveDashboardShellExitHref(params: {
  href: string | null | undefined;
  origin: string;
  target?: string | null;
  download?: boolean;
  event: DashboardTabClickEvent;
}): string | null {
  if (params.download) {
    return null;
  }

  if (params.target && params.target !== "_self") {
    return null;
  }

  const href = resolveSameOriginHref(params.href, params.origin);
  if (!href) {
    return null;
  }

  const pathname = new URL(href, params.origin).pathname;
  const leavesShell = DASHBOARD_SHELL_EXIT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!leavesShell) {
    return null;
  }

  if (!interceptDashboardTabClick(params.event)) {
    return null;
  }

  return href;
}

export function resolveDashboardClientNavigation(params: {
  href: string | null | undefined;
  origin: string;
  target?: string | null;
  download?: boolean;
  event: DashboardTabClickEvent;
}): { href: string; tab: DashboardBottomTab | null } | null {
  if (params.download) {
    return null;
  }

  if (params.target && params.target !== "_self") {
    return null;
  }

  const href = resolveInternalDashboardHref(params.href, params.origin);
  if (!href) {
    return null;
  }

  const pathname = new URL(href, params.origin).pathname;

  if (!interceptDashboardTabClick(params.event)) {
    return null;
  }

  return {
    href,
    tab: getDashboardBottomTab(pathname),
  };
}

export function resolveVisibleDashboardBottomTab(params: {
  pathname: string;
  pendingTab: DashboardBottomTab | null;
}): DashboardBottomTab | null {
  const routeTab = getDashboardBottomTab(params.pathname);

  if (routeTab === null && params.pathname.startsWith("/dashboard")) {
    return null;
  }

  if (params.pendingTab) {
    return params.pendingTab;
  }

  return routeTab;
}

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
  "/dashboard/space_settings",
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
