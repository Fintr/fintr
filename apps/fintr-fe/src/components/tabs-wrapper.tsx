"use client";

import { Tabs } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";
import { useAtomValue } from "jotai";
import { useSyncExternalStore } from "react";
import { shouldShowV2Features, cn } from "@/lib/utils";
import { pendingDashboardBottomTabAtom } from "@/atoms/dashboardBottomTabAtoms";
import {
  getDashboardCommittedPathname,
  resolveVisibleDashboardBottomTab,
  subscribeDashboardCommittedPathname,
  type DashboardBottomTab,
} from "@/lib/dashboard-nav-routes";

function tabValueFromPending(
  pendingTab: DashboardBottomTab | null,
): string | null {
  if (pendingTab === "menu" || pendingTab === "space_settings") {
    return "space_settings";
  }

  return pendingTab;
}

// path is like /landlords/inbox/123
function getDefaultValue(path: string) {
  let defaultValue: string = "transactions";
  const showV2Features = shouldShowV2Features();

  if (path.includes("/dashboard/home")) {
    defaultValue = "home";
  } else   if (path.includes("/dashboard/budgets")) {
    defaultValue = "budgets";
  } else if (path.includes("/dashboard/recurring")) {
    defaultValue = "recurring";
  } else if (path.includes("/dashboard/loans")) {
    defaultValue = "loans";
  } else if (path.includes("/dashboard/goals")) {
    defaultValue = "goals";
  } else if (showV2Features && path.includes("/dashboard/investments")) {
    defaultValue = "investments";
  } else if (path.includes("/dashboard/insights")) {
    defaultValue = "insights";
  } else if (
    path.includes("/dashboard/space_settings") ||
    path.includes("/dashboard/app_settings")
  ) {
    defaultValue = "space_settings";
  }

  return defaultValue;
}

export function TabsWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const routerPathname = usePathname();
  const committedPathname = useSyncExternalStore(
    subscribeDashboardCommittedPathname,
    getDashboardCommittedPathname,
    () => null,
  );
  const pathname = committedPathname ?? routerPathname;
  const pendingTab = useAtomValue(pendingDashboardBottomTabAtom);
  const visibleBottomTab = resolveVisibleDashboardBottomTab({
    pathname,
    pendingTab,
  });
  const value =
    tabValueFromPending(visibleBottomTab) ?? getDefaultValue(pathname);

  return (
    <Tabs value={value} className={cn("gap-0 md:gap-2", className)}>
      {children}
    </Tabs>
  );
}
