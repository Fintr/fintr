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
      categoryName,
      amount,
      date,
    }: {
      categoryName: string;
      amount: number;
      date: string;
    }) => {
      const payload: CreateBudgetPayload = {
        categoryName,
        amount,
        date,
      };
      return createBudget(api, payload);
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
                date: variables.date,
                category_name: variables.categoryName,
                amount: variables.amount,
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
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
    },
    onError: (error, newData, context) => {
      queryClient.setQueryData(
        ["budgets", spaceCode, budgetDateFilter],
        context?.previousData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId: string) => deleteBudget(api, budgetId),
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
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["budgets", spaceCode, budgetDateFilter],
      });
    },
    onError: (error, newData, context) => {
      queryClient.setQueryData(
        ["budgets", spaceCode, budgetDateFilter],
        context?.previousData
      );
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
