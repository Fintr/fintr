"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { DASHBOARD_BOTTOM_NAV_ROUTES } from "@/lib/dashboard-nav-routes";
import { warmDashboardNavTabChunks } from "@/lib/warm-dashboard-nav-chunks";

/**
 * Prefetch bottom-nav route payloads and JS chunks while online so the service
 * worker can serve RSC + static chunks during offline client navigations.
 */
export const usePrefetchDashboardNavRoutes = (): void => {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    for (const route of DASHBOARD_BOTTOM_NAV_ROUTES) {
      router.prefetch(route);
    }

    void warmDashboardNavTabChunks();
  }, [router]);
};
