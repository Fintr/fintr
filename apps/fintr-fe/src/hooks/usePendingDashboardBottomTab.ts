"use client";

import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { pendingDashboardBottomTabAtom } from "@/atoms/dashboardBottomTabAtoms";
import {
  getDashboardCommittedPathname,
  resolveVisibleDashboardBottomTab,
  subscribeDashboardCommittedPathname,
} from "@/lib/dashboard-nav-routes";

export const usePendingDashboardBottomTab = () => {
  const routerPathname = usePathname();
  const committedPathname = useSyncExternalStore(
    subscribeDashboardCommittedPathname,
    getDashboardCommittedPathname,
    () => null,
  );
  const pathname = committedPathname ?? routerPathname;
  const [pendingTab, setPendingTab] = useAtom(pendingDashboardBottomTabAtom);
  const visibleTab = resolveVisibleDashboardBottomTab({
    pathname,
    pendingTab,
  });

  useEffect(() => {
    setPendingTab(null);
  }, [pathname, setPendingTab]);

  return {
    pendingTab,
    setPendingTab,
    visibleTab,
    pathname,
  };
};
