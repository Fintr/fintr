import { atom } from "jotai";

import type { DashboardBottomTab } from "@/lib/dashboard-nav-routes";

export const pendingDashboardBottomTabAtom = atom<DashboardBottomTab | null>(
  null,
);
