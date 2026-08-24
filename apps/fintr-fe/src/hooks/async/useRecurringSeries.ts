"use client";

import { useQuery } from "@tanstack/react-query";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuthApi } from "@/hooks/useAuthApi";
import { listSpaceTransactions } from "@/lib/local-db/transactions";
import { enrichTransactionsWithSeriesSchedule } from "@/services/transactions/enrich-series-schedule";
import {
  buildRecurringSeriesSummaries,
  partitionRecurringSeries,
  type RecurringSeriesSummary,
} from "@/utils/recurringSchedule";

export const useRecurringSeries = () => {
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api } = useAuthApi();

  const query = useQuery({
    queryKey: ["recurringSeries", spaceCode],
    queryFn: async () => {
      const rows = await listSpaceTransactions(spaceCode);
      return enrichTransactionsWithSeriesSchedule(spaceCode, rows, api);
    },
    enabled: Boolean(spaceCode),
    staleTime: 30_000,
    networkMode: "always",
  });

  const summaries = buildRecurringSeriesSummaries(query.data ?? []);
  const partitioned = partitionRecurringSeries(summaries);

  return {
    summaries,
    upcoming: partitioned.upcoming,
    active: partitioned.active,
    inactive: partitioned.inactive,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

export type { RecurringSeriesSummary };
