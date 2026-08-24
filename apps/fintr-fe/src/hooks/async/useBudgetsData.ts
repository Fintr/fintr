import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  cacheBudgetsResponse,
  loadCachedBudgetsResponse,
} from "@/services/budgets/local-cache";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { createBudgetLocalFirst } from "@/services/budgets/create-local-first";
import { updateBudgetLocalFirst } from "@/services/budgets/update-local-first";
import { deleteBudgetLocalFirst } from "@/services/budgets/delete-local-first";
import { UpdateBudgetPayload } from "@/services/budgets/mutations";
import { CreateBudgetPayload } from "@/types/budgetTypes";

export const useBudgetsData = (startDate: string, endDate: string) => {
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:budgets",
  });

  const localBudgetsQuery = useQuery({
    queryKey: ["budgets", "local", spaceCode, startDate, endDate],
    queryFn: async () =>
      (await loadCachedBudgetsResponse(spaceCode, startDate, endDate)) ?? null,
    enabled: Boolean(spaceCode && startDate && endDate),
    staleTime: Infinity,
    networkMode: "always",
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localBudgetsQuery, spaceCode);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", spaceCode, startDate, endDate],
    queryFn: async () => {
      if (skipNetworkFetch) {
        return (
          (await loadCachedBudgetsResponse(spaceCode, startDate, endDate))
          ?? localBudgetsQuery.data
          ?? {
            budgets: [],
            summary: null,
            nextPage: null,
            totalPages: null,
            totalCount: null,
          }
        );
      }

      const page = await fetchBudgetsPage(api, {
        queryKey: ["budgets", spaceCode, startDate, endDate],
      });
      void cacheBudgetsResponse(spaceCode, startDate, endDate, page).then(() => {
        queryClient.setQueryData(
          ["budgets", "local", spaceCode, startDate, endDate],
          page,
        );
      });
      return page;
    },
    enabled: !!spaceCode && !!startDate && !!endDate,
    placeholderData: localBudgetsQuery.data ?? undefined,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    networkMode: "always",
  });

  const budgetsPage = data ?? localBudgetsQuery.data ?? undefined;

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
    isLoading: isLoading && !budgetsPage,
    isError,
    refetch,
    updateBudgetMutation,
    createBudgetMutation,
    deleteBudgetMutation,
  };
};
