"use client";

import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getEarliestSpaceTransactionDate } from "@/lib/local-db/transactions";
import { loadCachedDashboardShell } from "@/services/monthly-financial-summaries/local-cache";
import { type PresetDateRangeOptions } from "@/utils/dateFilterPresets";

const minDateString = (
  ...values: Array<string | null | undefined>
): string | null => {
  const dates = values.filter((value): value is string => Boolean(value));

  if (dates.length === 0) {
    return null;
  }

  return dates.reduce((earliest, value) =>
    value < earliest ? value : earliest,
  );
};

export const usePresetDateRangeOptions = (): PresetDateRangeOptions & {
  isAllTimeAnchorReady: boolean;
} => {
  const spaceCreatedAt = useAtomValue(currentSpaceAtom)?.createdAt ?? null;
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const { data: shell } = useQuery({
    queryKey: ["dashboard", "shell", spaceCode],
    queryFn: async () => (await loadCachedDashboardShell(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const { data: earliestFromIndex, isFetched: earliestIndexFetched } = useQuery({
    queryKey: ["earliestTransactionDate", spaceCode],
    queryFn: () => getEarliestSpaceTransactionDate(spaceCode),
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  return useMemo(
    () => ({
      earliestTransactionDate: minDateString(
        shell?.earliestTransactionDate,
        earliestFromIndex,
      ),
      spaceCreatedAt,
      isAllTimeAnchorReady: !spaceCode || earliestIndexFetched,
    }),
    [
      earliestFromIndex,
      earliestIndexFetched,
      shell?.earliestTransactionDate,
      spaceCode,
      spaceCreatedAt,
    ],
  );
};
