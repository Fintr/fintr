"use client";

import type { Account } from "@/types/accountTypes";

import { usePrefetchDetailHrefs } from "@/hooks/usePrefetchDetailHrefs";
import { buildAccountDetailHref } from "@/utils/detailHrefs";

/**
 * Prefetch account detail route payloads while online so the dev service worker
 * can serve them during offline client navigations.
 */
export const usePrefetchAccountDetailRoutes = (
  accounts: Account[] | undefined,
): void => {
  const hrefs = (accounts ?? []).map((account) =>
    buildAccountDetailHref(account.id),
  );

  usePrefetchDetailHrefs(hrefs);
};
