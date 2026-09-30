import { listSpaceTransactionsInDateRange } from "@/lib/local-db";
import { budgetDeletionsForMonth } from "@/services/budgets/budget-deletions";
import type { BudgetsPage } from "@/types/budgetTypes";
import { pageWithoutOmittedBudgets } from "@/services/budgets/create-monthly-budget";
import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  applyBudgetsPageToCaches,
  budgetsPageForNetworkCache,
  mergeSavedLocalBudgets,
} from "@/services/budgets/budget-cache-ops";
import {
  applyBudgetSpendingToPage,
  ensureMonthlyBudgetsLocalFirst,
} from "@/services/budgets/ensure-monthly-budgets-local-first";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { createBudgetLocalFirst } from "@/services/budgets/create-local-first";
import { updateBudgetLocalFirst } from "@/services/budgets/update-local-first";
import { deleteBudgetLocalFirst } from "@/services/budgets/delete-local-first";
import { UpdateBudgetPayload } from "@/services/budgets/mutations";
import { CreateBudgetPayload } from "@/types/budgetTypes";

export const useBudgetsData = (
  startDate: string,
  endDate: string,
  active = true,
) => {
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:budgets",
  });

  const localBudgetsQuery = useQuery({
    queryKey: ["budgets", "local", spaceCode, startDate, endDate],
    queryFn: async () => {
      const ensured = await ensureMonthlyBudgetsLocalFirst(
        api,
        {
          spaceCode,
          startDate,
          endDate,
        },
        { queryClient, waitForSync: false },
      );
      const localKey = [
        "budgets",
        "local",
        spaceCode,
        startDate,
        endDate,
      ] as const;
      const current = queryClient.getQueryData<BudgetsPage>(localKey);
      if (!current) {
        return ensured.page;
      }

      const omissions = await budgetDeletionsForMonth(spaceCode, startDate);
      return mergeSavedLocalBudgets(
        pageWithoutOmittedBudgets(ensured.page, omissions),
        pageWithoutOmittedBudgets(current, omissions),
      );
    },
    enabled: Boolean(spaceCode && startDate && endDate),
    staleTime: Infinity,
    refetchOnMount: "always",
    networkMode: "always",
  });

  const refetchLocalBudgets = localBudgetsQuery.refetch;
  const previousActiveRef = useRef(active);

  useEffect(() => {
    const becameActive = active && !previousActiveRef.current;
    previousActiveRef.current = active;

    if (!becameActive || !spaceCode || !startDate || !endDate) {
      return;
    }

    void refetchLocalBudgets();
  }, [
    active,
    endDate,
    refetchLocalBudgets,
    spaceCode,
    startDate,
  ]);

  const skipNetworkFetch = useSkipCachedNetworkFetch(localBudgetsQuery, spaceCode);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", spaceCode, startDate, endDate],
    queryFn: async () => {
      const fetchedPage = await fetchBudgetsPage(api, {
        queryKey: ["budgets", spaceCode, startDate, endDate],
      });
      const transactions = await listSpaceTransactionsInDateRange(
        spaceCode,
        startDate,
        endDate,
      );
      const omittedBudgets = await budgetDeletionsForMonth(
        spaceCode,
        startDate,
      );
      const page = applyBudgetSpendingToPage(
        pageWithoutOmittedBudgets(fetchedPage, omittedBudgets),
        transactions,
      );
      const localKey = [
        "budgets",
        "local",
        spaceCode,
        startDate,
        endDate,
      ] as const;
      const localPage = queryClient.getQueryData<typeof page>(localKey);
      const localKept = localPage
        ? pageWithoutOmittedBudgets(localPage, omittedBudgets)
        : undefined;
      const pageToStore = budgetsPageForNetworkCache({
        fetched: page,
        local: localKept,
      });

      return applyBudgetsPageToCaches({
        spaceCode,
        startDate,
        endDate,
        page: pageToStore,
        queryClient,
      });
    },
    enabled: Boolean(spaceCode && startDate && endDate && !skipNetworkFetch),
    placeholderData: localBudgetsQuery.data ?? undefined,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    networkMode: "always",
  });

  const budgetsPage = localBudgetsQuery.data ?? data ?? undefined;

  const updateBudgetMutation = useMutation({
    mutationFn: async ({
      budgetId,
      data: payload,
    }: {
      budgetId: string;
      data: UpdateBudgetPayload;
    }) => {
      return updateBudgetLocalFirst(
        api,
        {
          spaceCode,
          startDate,
          endDate,
          budgetId,
          data: payload,
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (payload: CreateBudgetPayload) => {
      return createBudgetLocalFirst(
        api,
        {
          spaceCode,
          startDate,
          endDate,
          data: payload,
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      return deleteBudgetLocalFirst(
        api,
        {
          spaceCode,
          startDate,
          endDate,
          budgetId,
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  return {
    data: budgetsPage,
    isLoading: (isLoading || localBudgetsQuery.isLoading) && !budgetsPage,
    isError,
    refetch,
    updateBudgetMutation,
    createBudgetMutation,
    deleteBudgetMutation,
  };
};
