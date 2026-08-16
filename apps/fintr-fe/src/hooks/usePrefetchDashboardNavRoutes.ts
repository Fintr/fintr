"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { DASHBOARD_OFFLINE_PREFETCH_ROUTES } from "@/lib/dashboard-nav-routes";
import { warmDashboardNavTabChunks } from "@/lib/warm-dashboard-nav-chunks";

/**
 * Prefetch dashboard and Menu route payloads and JS chunks while online so the
 * service worker can serve RSC + static chunks during offline client navigations.
 */
export const usePrefetchDashboardNavRoutes = (): void => {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    for (const route of DASHBOARD_OFFLINE_PREFETCH_ROUTES) {
      router.prefetch(route);
    }

    void warmDashboardNavTabChunks();
  }, [router]);
};
