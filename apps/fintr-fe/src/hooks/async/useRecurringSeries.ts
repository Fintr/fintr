"use client";

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuthApi } from "@/hooks/useAuthApi";
import { listRecurringSpaceTransactions } from "@/lib/local-db/transactions";
import { enrichTransactionsWithSeriesSchedule } from "@/services/transactions/enrich-series-schedule";
import type { IndexTransaction } from "@/types/transactionTypes";
import {
  buildRecurringSeriesSummaries,
  partitionRecurringSeries,
  type RecurringSeriesSummary,
} from "@/utils/recurringSchedule";

export const recurringSeriesQueryKey = (spaceCode: string) =>
  ["recurringSeries", spaceCode] as const;

export const loadRecurringSeriesFromLocal = async (
  spaceCode: string,
): Promise<IndexTransaction[]> => {
  if (!spaceCode) {
    return [];
  }

  return listRecurringSpaceTransactions(spaceCode);
};

export const prefetchRecurringSeries = (
  queryClient: QueryClient,
  spaceCode: string,
): Promise<void> => {
  if (!spaceCode) {
    return Promise.resolve();
  }

  return queryClient.prefetchQuery({
    queryKey: recurringSeriesQueryKey(spaceCode),
    queryFn: () => loadRecurringSeriesFromLocal(spaceCode),
    staleTime: 30_000,
    networkMode: "always",
  });
};

const scheduleFingerprint = (rows: IndexTransaction[]): string =>
  rows
    .map((row) =>
      [
        row.id,
        row.repeatInterval ?? "",
        row.scheduleType ?? "",
        row.installmentPeriod ?? "",
      ].join(":"),
    )
    .join("|");

export const useRecurringSeries = () => {
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const refinedFingerprintRef = useRef<string>("");

  const query = useQuery({
    queryKey: recurringSeriesQueryKey(spaceCode),
    queryFn: () => loadRecurringSeriesFromLocal(spaceCode),
    enabled: Boolean(spaceCode),
    staleTime: 30_000,
    networkMode: "always",
  });

  useEffect(() => {
    if (!spaceCode || !query.isSuccess || !query.data) {
      return;
    }

    const fingerprint = scheduleFingerprint(query.data);
    if (refinedFingerprintRef.current === fingerprint) {
      return;
    }

    let cancelled = false;

    void enrichTransactionsWithSeriesSchedule(spaceCode, query.data, api)
      .then((enriched) => {
        if (cancelled) {
          return;
        }

        const nextFingerprint = scheduleFingerprint(enriched);
        refinedFingerprintRef.current = nextFingerprint;

        if (nextFingerprint === fingerprint) {
          return;
        }

        queryClient.setQueryData(
          recurringSeriesQueryKey(spaceCode),
          enriched,
        );
      })
      .catch(() => {
        refinedFingerprintRef.current = fingerprint;
      });

    return () => {
      cancelled = true;
    };
  }, [
    api,
    query.data,
    query.isSuccess,
    queryClient,
    spaceCode,
  ]);

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
