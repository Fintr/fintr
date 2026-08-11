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
import { updateBudget, createBudget, deleteBudget } from "@/services/budgets/mutations";
import { UpdateBudgetPayload } from "@/services/budgets/mutations";
import { CreateBudgetPayload } from "@/types/budgetTypes";
export const useBudgetsData = (startDate: string, endDate: string) => {
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:budgets",
  });

  const localBudgetsQuery = useQuery({
    queryKey: ["budgets", "local", spaceCode, startDate, endDate],
    queryFn: async () =>
      (await loadCachedBudgetsResponse(spaceCode, startDate, endDate)) ?? null,
    enabled: Boolean(spaceCode && startDate && endDate),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localBudgetsQuery);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", spaceCode, startDate, endDate],
    queryFn: async () => {
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
    enabled: !!spaceCode && !!startDate && !!endDate && !skipNetworkFetch,
    placeholderData: localBudgetsQuery.data ?? undefined,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
  });

  const invalidateBudgets = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["budgets", spaceCode, startDate, endDate],
      refetchType: "active",
    });
  };

  const updateBudgetMutation = useMutation(
    {
      mutationFn: async ({ budgetId, data }: { budgetId: string; data: UpdateBudgetPayload }) => {
        try {
          const result = await updateBudget(api, budgetId, data);
          await invalidateBudgets();
          return result;
        } catch (error) {
          console.error("Error updating budget:", error);
          throw error;
        }
      },
    }
  );

  const createBudgetMutation = useMutation({
    mutationFn: async (payload: CreateBudgetPayload) => {
      try {
        const result = await createBudget(api, payload);
        await invalidateBudgets();
        return result;
      } catch (error) {
        console.error("Error creating budget:", error);
        throw error;
      }
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      try {
        const result = await deleteBudget(api, budgetId);
        await invalidateBudgets();
        return result;
      } catch (error) {
        console.error("Error deleting budget:", error);
        throw error;
      }
    },
  });

  return {
    data,
    isLoading,
    isError,
    refetch,
    updateBudgetMutation,
    createBudgetMutation,
    deleteBudgetMutation,
  };
};
