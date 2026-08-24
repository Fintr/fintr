import { fetchTransactionCategories } from "@/services/transactions/categories/mutation";
import { deleteCategoryLocalFirst } from "@/services/transactions/categories/delete-local-first";
import { updateCategoryLocalFirst } from "@/services/transactions/categories/update-local-first";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { loadCachedTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { createCategoryLocalFirst } from "@/services/transactions/categories/create-local-first";
import { convertCategoryLocalFirst } from "@/services/transactions/categories/convert-local-first";
import { extractCategoryTrees } from "@/services/transactions/categories/category-cache-ops";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import type { CategoryConversionType } from "@/types/categoryConversionTypes";
import { mapApiCategoryTree } from "@/utils/categoryTreeOptions";

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
    networkMode: "always",
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCategoriesQuery, spaceCode);
  
  const { data, error, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ["transactionCategories", spaceCode],
    queryFn: () => fetchTransactionCategories(api),
    enabled: !!spaceCode && !skipNetworkFetch,
    placeholderData: localCategoriesQuery.data ?? undefined,
    retry: 2,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    networkMode: "always",
  });

  const categoriesResponse = localCategoriesQuery.data ?? data;

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
      return createCategoryLocalFirst(
        api,
        {
          spaceCode,
          data: {
            name,
            categoryType,
            parentId,
            icon,
            color,
          },
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  const convertCategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      conversionType,
      newParentId,
    }: {
      categoryId: string;
      conversionType: CategoryConversionType;
      newParentId?: string | null;
    }) => {
      return convertCategoryLocalFirst(
        api,
        {
          spaceCode,
          categoryId,
          conversionType,
          newParentId,
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

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
      return updateCategoryLocalFirst(
        api,
        {
          spaceCode,
          categoryId,
          updateData,
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const result = await deleteCategoryLocalFirst(
        api,
        { spaceCode, categoryId },
        { queryClient, waitForSync: false },
      );

      void result.syncPromise.then((synced) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["budgets"] });

        if (
          synced.serverResponse
          && typeof synced.serverResponse === "object"
          && "success" in synced.serverResponse
        ) {
          return synced.serverResponse;
        }

        return { success: true };
      });

      return { success: true, pendingSync: result.pendingSync };
    },
    networkMode: "always",
  });

  // Log errors for debugging
  if (isError) {
    console.error('Transaction categories fetch error:', error);
  }

  const categoryTrees = extractCategoryTrees(categoriesResponse);

  return { 
    data, 
    error, 
    isLoading, 
    isError, 
    isSuccess, 
    refetch,
    expenseCategories: categoryTrees.expenseCategories,
    incomeCategories: categoryTrees.incomeCategories,
    expenseCategoryOptions: mapApiCategoryTree(categoryTrees.expenseCategories),
    incomeCategoryOptions: mapApiCategoryTree(categoryTrees.incomeCategories),
    updateCategoryMutation,
    deleteCategoryMutation,
    createCategoryMutation,
    convertCategoryMutation,
  };
};
