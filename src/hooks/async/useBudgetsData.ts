import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  isError,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { updateBudget, createBudget, deleteBudget } from "@/services/budgets/mutations";
import { UpdateBudgetPayload } from "@/services/budgets/mutations";
import { BudgetsPage, CreateBudgetPayload } from "@/types/budgetTypes";
export const useBudgetsData = (budgetDateFilter: string) => {
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:budgets",
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", spaceCode, budgetDateFilter],
    queryFn: () =>
      fetchBudgetsPage(api, {
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      }),
    enabled: !!spaceCode && isAuthenticated, // Only run if spaceCode exists and user is authenticated
  });

  const updateBudgetMutation = useMutation(
    {
      mutationFn: ({ budgetId, data }: { budgetId: string; data: UpdateBudgetPayload }) => updateBudget(api, budgetId, data),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["budgets", spaceCode, budgetDateFilter],
          refetchType: "active",
        });
      },
      onError: (error) => {
        console.error("Error updating budget:", error);
      },
    }
  );

  const createBudgetMutation = useMutation({
    mutationFn: (payload: CreateBudgetPayload) => createBudget(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
        refetchType: "active",
      });
    },
    onError: (error) => {
      console.error("Error creating budget:", error);
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId: string) => deleteBudget(api, budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
        refetchType: "active",
      });
    },
    onError: (error) => {
      console.error("Error deleting budget:", error);
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
