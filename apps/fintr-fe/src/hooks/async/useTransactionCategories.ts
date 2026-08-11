import { fetchTransactionCategories, updateTransactionCategory, deleteTransactionCategory, createTransactionCategory } from "@/services/transactions/categories/mutation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { loadCachedTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { normalizeCategoryTreeNodes } from "@/utils/categoryTreeOptions";

export const useTransactionCategories = () => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localCategoriesQuery = useQuery({
    queryKey: ["transactionCategories", "local", spaceCode],
    queryFn: async () =>
      (await loadCachedTransactionCategoriesResponse(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCategoriesQuery);
  
  const { data, error, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ["transactionCategories", spaceCode],
    queryFn: () => fetchTransactionCategories(api),
    enabled: !!spaceCode && !skipNetworkFetch,
    placeholderData: localCategoriesQuery.data ?? undefined,
    retry: 2,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
  });

  // Mutation for creating categories
  const createCategoryMutation = useMutation({
    mutationFn: async ({
      name,
      categoryType,
      parentId,
      icon,
      color,
    }: {
      name: string;
      categoryType: CategoryTypeEnum;
      parentId?: string | null;
      icon?: string;
      color?: string;
    }) => {
      try {
        const result = await createTransactionCategory(api, {
          name,
          categoryType,
          parentId,
          icon,
          color,
        });
        await queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
        if (categoryType === CategoryTypeEnum.EXPENSE) {
          await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
        return result;
      } catch (error) {
        console.error("Error creating category:", error);
        throw error;
      }
    },
  });

  // Mutation for updating categories
  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      updateData,
    }: {
      categoryId: string;
      updateData: {
        name: string;
        icon?: string;
        color?: string;
      };
    }) => {
      await queryClient.cancelQueries({ queryKey: ["transactionCategories", spaceCode] });

      const previousData = queryClient.getQueryData(["transactionCategories", spaceCode]);

      queryClient.setQueryData(["transactionCategories", spaceCode], (old: any) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: {
            ...old.data,
            expenseCategories: old.data.expenseCategories?.map((category: any) =>
              category.id === categoryId
                ? { ...category, ...updateData }
                : category
            ) || [],
            incomeCategories: old.data.incomeCategories?.map((category: any) =>
              category.id === categoryId
                ? { ...category, ...updateData }
                : category
            ) || [],
          },
        };
      });

      try {
        const result = await updateTransactionCategory(api, categoryId, updateData);
        return result;
      } catch (err) {
        if (previousData) {
          queryClient.setQueryData(["transactionCategories", spaceCode], previousData);
        }
        throw err;
      } finally {
        await queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
      }
    },
  });

  // Mutation for deleting categories
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      try {
        const result = await deleteTransactionCategory(api, categoryId);
        if (result?.success === true) {
          await queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
          await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
        return result;
      } catch (err) {
        console.error("Error deleting category:", err);
        throw err;
      }
    },
  });

  // Log errors for debugging
  if (isError) {
    console.error('Transaction categories fetch error:', error);
  }

  return { 
    data, 
    error, 
    isLoading, 
    isError, 
    isSuccess, 
    refetch,
    expenseCategories: normalizeCategoryTreeNodes(
      data?.data?.expenseCategories ?? data?.data?.expense_categories,
    ),
    incomeCategories: normalizeCategoryTreeNodes(
      data?.data?.incomeCategories ?? data?.data?.income_categories,
    ),
    updateCategoryMutation,
    deleteCategoryMutation,
    createCategoryMutation,
  };
};
