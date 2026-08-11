import type { QueryClient } from "@tanstack/react-query";
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import {
  ACCOUNT_ADJUSTMENT_HISTORY_KEY,
  ACCOUNT_DETAIL_TRANSACTIONS_KEY,
} from "@/hooks/async/useAccountDetailTransactions";

const FINANCIAL_QUERY_KEYS = [
  "transactions",
  "dashboard",
  "accounts",
  "insights",
  "budgets",
  "loans",
  ACCOUNT_DETAIL_ACTIVITIES_KEY,
  ACCOUNT_DETAIL_TRANSACTIONS_KEY,
  ACCOUNT_ADJUSTMENT_HISTORY_KEY,
] as const;

export async function invalidateSpaceFinancialQueries(
  queryClient: QueryClient,
) {
  await Promise.all(
    FINANCIAL_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [queryKey] }),
    ),
  );
}

/**
 * Recompute insights from IndexedDB (monthly buckets + all-time transactions).
 * Safe immediately after local-first writes — does not hit the network.
 */
export function invalidateLocalInsightsQueries(
  queryClient: QueryClient,
): void {
  void queryClient.invalidateQueries({
    queryKey: ["insights"],
    refetchType: "active",
    exact: false,
  });
}

export async function invalidateSpaceSwitchQueries(
  queryClient: QueryClient,
) {
  await Promise.all([
    invalidateSpaceFinancialQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: ["spaces"] }),
    queryClient.invalidateQueries({ queryKey: ["space-context"] }),
    queryClient.invalidateQueries({ queryKey: ["transactionCategories"] }),
    queryClient.invalidateQueries({ queryKey: ["transactionDrafts"] }),
    queryClient.invalidateQueries({ queryKey: ["spaceUsers"] }),
    queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    queryClient.invalidateQueries({ queryKey: ["messages"] }),
    queryClient.invalidateQueries({ queryKey: ["ai", "usage"] }),
  ]);
}

const SPACE_SWITCH_CRITICAL_QUERY_ROOTS = new Set([
  "space-context",
  "dashboard",
  "transactions",
  "monthlyFinancialSummaries",
]);

function isCriticalSpaceSwitchFetch(
  queryClient: QueryClient,
): boolean {
  return (
    queryClient.isFetching({
      predicate: (query) => {
        const root = query.queryKey[0];
        return (
          typeof root === "string" &&
          SPACE_SWITCH_CRITICAL_QUERY_ROOTS.has(root)
        );
      },
    }) > 0
  );
}

function waitForCriticalSpaceSwitchFetches(
  queryClient: QueryClient,
): Promise<void> {
  if (!isCriticalSpaceSwitchFetch(queryClient)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (!isCriticalSpaceSwitchFetch(queryClient)) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/** Minimum overlay time + critical refetches, capped so switches feel snappy. */
export async function waitForSpaceSwitchReady(
  queryClient: QueryClient,
  {
    minMs = 500,
    maxMs = 1200,
  }: {
    minMs?: number;
    maxMs?: number;
  } = {},
): Promise<void> {
  const minDelay = new Promise<void>((resolve) => {
    setTimeout(resolve, minMs);
  });

  await Promise.race([
    Promise.all([
      minDelay,
      waitForCriticalSpaceSwitchFetches(queryClient),
    ]),
    new Promise<void>((resolve) => {
      setTimeout(resolve, maxMs);
    }),
  ]);
}
