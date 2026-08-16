"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { Account } from "@/types/accountTypes";

import { buildAccountDetailHref } from "@/utils/detailHrefs";

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
      router.prefetch(buildAccountDetailHref(account.id));
    }
  }, [accounts, router]);
};
