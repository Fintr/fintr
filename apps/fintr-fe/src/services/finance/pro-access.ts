import { AxiosInstance } from "axios";

import type { ProFeature } from "@/lib/pro-features";

export type ProAccessSource =
  | "admin"
  | "revenuecat"
  | "subscription"
  | "trial"
  | "none";

export interface ProAccess {
  pro: boolean;
  source: ProAccessSource;
  appUserId: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  proExpiresAt: string | null;
  features: ProFeature[];
}

const CACHE_KEY = "fintr.proAccess";

export function readCachedProAccess(): ProAccess | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ProAccess>;
    if (typeof parsed.pro !== "boolean" || typeof parsed.source !== "string") {
      return null;
    }

    return parsed as ProAccess;
  } catch {
    return null;
  }
}

export function writeCachedProAccess(access: ProAccess): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CACHE_KEY, JSON.stringify(access));
}

export async function fetchProAccess(api: AxiosInstance): Promise<ProAccess> {
  const response = await api.get("/finance/pro_access");
  const access = response.data.data as ProAccess;
  writeCachedProAccess(access);
  return access;
}

export async function syncRevenueCatCustomer(
  api: AxiosInstance,
): Promise<ProAccess> {
  const response = await api.post("/finance/revenuecat_sync");
  const access = response.data.data as ProAccess;
  writeCachedProAccess(access);
  return access;
}
