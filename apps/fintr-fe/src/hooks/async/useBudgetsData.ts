import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { updateBudget, createBudget, deleteBudget } from "@/services/budgets/mutations";
import { UpdateBudgetPayload } from "@/services/budgets/mutations";
import { CreateBudgetPayload } from "@/types/budgetTypes";
export const useBudgetsData = (startDate: string, endDate: string) => {
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:budgets",
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", spaceCode, startDate, endDate],
    queryFn: () =>
      fetchBudgetsPage(api, {
        queryKey: ["budgets", spaceCode, startDate, endDate],
      }),
    enabled: !!spaceCode && !!startDate && !!endDate,
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
