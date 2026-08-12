"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { Account } from "@/types/accountTypes";

const accountDetailPath = (accountId: string): string =>
  `/dashboard/space_settings/accounts/detail?accountId=${encodeURIComponent(accountId)}`;

/**
 * Prefetch account detail route payloads while online so the dev service worker
 * can serve them during offline client navigations.
 */
export const usePrefetchAccountDetailRoutes = (
  accounts: Account[] | undefined,
): void => {
  const router = useRouter();

  useEffect(() => {
    if (!accounts?.length) {
      return;
    }

    for (const account of accounts) {
      router.prefetch(accountDetailPath(account.id));
    }
  }, [accounts, router]);
};
