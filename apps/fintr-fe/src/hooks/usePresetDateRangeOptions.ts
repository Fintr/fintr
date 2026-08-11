"use client";

import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { loadCachedDashboardShell } from "@/services/monthly-financial-summaries/local-cache";
import { type PresetDateRangeOptions } from "@/utils/dateFilterPresets";

export const usePresetDateRangeOptions = (): PresetDateRangeOptions => {
  const spaceCreatedAt = useAtomValue(currentSpaceAtom)?.createdAt ?? null;
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const { data: shell } = useQuery({
    queryKey: ["dashboard", "shell", spaceCode],
    queryFn: async () => (await loadCachedDashboardShell(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  return useMemo(
    () => ({
      earliestTransactionDate: shell?.earliestTransactionDate ?? null,
      spaceCreatedAt,
    }),
    [shell?.earliestTransactionDate, spaceCreatedAt],
  );
};
