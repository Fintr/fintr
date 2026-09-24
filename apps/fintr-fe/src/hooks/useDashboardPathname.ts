"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import {
  getDashboardCommittedPathname,
  subscribeDashboardCommittedPathname,
} from "@/lib/dashboard-nav-routes";

export function useDashboardPathname(): string {
  const routerPathname = usePathname();
  const committedPathname = useSyncExternalStore(
    subscribeDashboardCommittedPathname,
    getDashboardCommittedPathname,
    () => null,
  );

  return committedPathname ?? routerPathname;
}
