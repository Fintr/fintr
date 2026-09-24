"use client";

import { useEffect } from "react";

import { useProAccess } from "@/hooks/async/useProAccess";
import { identifyRevenueCatUser } from "@/lib/revenuecat/purchase-pro";

export function RevenueCatBootstrap() {
  const { data } = useProAccess();
  const appUserId = data?.appUserId;

  useEffect(() => {
    if (!appUserId) {
      return;
    }

    let cancelled = false;
    void identifyRevenueCatUser(appUserId).catch((error: unknown) => {
      if (cancelled) {
        return;
      }
      console.error("RevenueCat identify failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [appUserId]);

  return null;
}
