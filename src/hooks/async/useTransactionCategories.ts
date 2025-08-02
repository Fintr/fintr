import { fetchTransactionCategories, updateTransactionCategory, deleteTransactionCategory, createTransactionCategory } from "@/services/transactions/categories/mutation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { CategoryTypeEnum } from "@/types/categoryTypes";

export const useTransactionCategories = () => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  
  // Use the SSR-safe useLocalStorage hook
  const [spaceCode] = useLocalStorage("spaceCode", "");
  
  const { data, error, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ["transactionCategories", spaceCode],
    queryFn: () => fetchTransactionCategories(api),
    enabled: !!spaceCode,
    retry: 2, // Retry failed requests twice
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Mutation for creating categories
  const createCategoryMutation = useMutation({
    mutationFn: ({ name, categoryType }: { name: string; categoryType: CategoryTypeEnum }) =>
      createTransactionCategory(api, { name, categoryType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
    },
    onError: (error) => {
      console.error("Error creating category:", error);
    },
  });

  // Mutation for updating categories
  const updateCategoryMutation = useMutation({
    mutationFn: ({ categoryId, updateData }: { categoryId: string; updateData: { name: string } }) =>
      updateTransactionCategory(api, categoryId, updateData),
    onMutate: async ({ categoryId, updateData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transactionCategories", spaceCode] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["transactionCategories", spaceCode]);

      // Optimistically update the cache
      queryClient.setQueryData(["transactionCategories", spaceCode], (old: any) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: {
            ...old.data,
            expenseCategories: old.data.expenseCategories?.map((category: any) =>
              category.id === categoryId ? { ...category, name: updateData.name } : category
            ) || [],
            incomeCategories: old.data.incomeCategories?.map((category: any) =>
              category.id === categoryId ? { ...category, name: updateData.name } : category
            ) || [],
          },
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["transactionCategories", spaceCode], context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
    },
  });

  // Mutation for deleting categories
  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => deleteTransactionCategory(api, categoryId),
    // onMutate is removed to disable optimistic updates for deletion.
    onError: (err, categoryId) => {
      // Rollback is not explicitly needed here as onMutate is removed, 
      // and no optimistic update is performed.
      console.error("Error deleting category:", err);
    },
    onSuccess: (data) => {
      // Only invalidate and refetch if the backend operation was successful
      if (data?.success === true) {
        queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
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
    expenseCategories: data?.data?.expenseCategories || [],
    incomeCategories: data?.data?.incomeCategories || [],
    updateCategoryMutation,
    deleteCategoryMutation,
    createCategoryMutation,
  };
}; 
