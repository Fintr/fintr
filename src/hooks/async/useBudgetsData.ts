import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  isError,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { updateBudget } from "@/services/budgets/mutations";
import { UpdateBudgetPayload } from "@/services/budgets/mutations";
import { BudgetsPage } from "@/types/budgetTypes";
export const useBudgetsData = (budgetDateFilter: string) => {
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:budgets",
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["budgets", spaceCode, budgetDateFilter],
    queryFn: () =>
      fetchBudgetsPage(api, {
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      }),
    enabled: !!spaceCode,
  });

  const updateBudgetMutation = useMutation({
    mutationFn: (variables: { budgetId: string; data: UpdateBudgetPayload }) =>
      updateBudget(api, variables.budgetId, variables.data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
      const previousData = queryClient.getQueryData<BudgetsPage>([
        "budgets",
        spaceCode,
        budgetDateFilter,
      ]);
      queryClient.setQueryData(
        ["budgets", spaceCode, budgetDateFilter],
        (old: BudgetsPage | undefined) => {
          if (!old) return old;
          return {
            ...old,
            budgets: old?.budgets.map((budget) =>
              budget.id === variables.budgetId
                ? { ...budget, amount: variables.data.amount }
                : budget
            ),
          };
        }
      );

      return { previousData };
    },
    onSettled: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
    },
    onError: (error, newData, context) => {
      queryClient.setQueryData(
        ["budgets", spaceCode, budgetDateFilter],
        (old: BudgetsPage | undefined) => {
          if (!old) return old;
          return context?.previousData;
        }
      );
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: ({
      budgetCategory,
      budgetAmount,
    }: {
      budgetCategory: string;
      budgetAmount: number;
    }) => {
      console.log("CREATING BUDGET", budgetCategory, budgetAmount);
      return Promise.resolve();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
      const previousData = queryClient.getQueryData<BudgetsPage>([
        "budgets",
        spaceCode,
        budgetDateFilter,
      ]);
      queryClient.setQueryData(
        ["budgets", spaceCode, budgetDateFilter],
        (old: BudgetsPage | undefined) => {
          if (!old) return old;
          return {
            ...old,
            budgets: [
              {
                id: crypto.randomUUID(),
                date: budgetDateFilter,
                category_name: variables.budgetCategory,
                amount: variables.budgetAmount,
                amount_currency: "USD",
                total_spent: 0,
              },
              ...old.budgets,
            ],
          };
        }
      );
      return { previousData };
    },
    onSettled: (data, variables) => {
      //   queryClient.invalidateQueries({
      //     queryKey: ["budgets", spaceCode, budgetDateFilter],
      //   });
    },
    onError: (error, newData, context) => {
      //   queryClient.setQueryData(
      //     ["budgets", spaceCode, budgetDateFilter],
      //     (old: BudgetsPage | undefined) => {
      //       if (!old) return old;
      //       return context?.previousData;
      //     }
      //   );
    },
    onSuccess: (data, variables) => {
      //   queryClient.invalidateQueries({
      //     queryKey: ["budgets", spaceCode, budgetDateFilter],
      //   });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId: string) => Promise.resolve(),
    onMutate: async (budgetId: string) => {
      await queryClient.cancelQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
      const previousData = queryClient.getQueryData<BudgetsPage>([
        "budgets",
        spaceCode,
        budgetDateFilter,
      ]);
      queryClient.setQueryData(
        ["budgets", spaceCode, budgetDateFilter],
        (old: BudgetsPage | undefined) => {
          if (!old) return old;
          return {
            ...old,
            budgets: old.budgets.filter((budget) => budget.id !== budgetId),
          };
        }
      );
      return { previousData };
    },
    onSettled: (data, variables) => {
      //   queryClient.invalidateQueries({
      //     queryKey: ["budgets", spaceCode, budgetDateFilter],
      //   });
    },
    onError: (error, newData, context) => {
      //   queryClient.setQueryData(
      //     ["budgets", spaceCode, budgetDateFilter],
      //     (old: BudgetsPage | undefined) => {
      //       return context?.previousData;
      //     }
      //   );
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
