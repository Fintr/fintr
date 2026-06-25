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
