import {
  createTransactionTag,
  deleteTransactionTag,
  fetchTransactionTags,
  generateTransactionTagStyleImage,
  toggleDefaultTransactionTag,
  updateTransactionTag,
} from "@/services/transactions/tags/mutation";
import { loadCachedTransactionTagsResponse } from "@/services/transactions/tags/local-cache";
import type { TransactionTag } from "@/types/transactionTagTypes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";

export const useTransactionTags = () => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localTagsQuery = useQuery({
    queryKey: ["transactionTags", "local", spaceCode],
    queryFn: async () =>
      (await loadCachedTransactionTagsResponse(spaceCode)) ?? [],
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localTagsQuery, spaceCode);

  const { data, error, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ["transactionTags", spaceCode],
    queryFn: () => fetchTransactionTags(api),
    enabled: Boolean(spaceCode) && !skipNetworkFetch,
    placeholderData: localTagsQuery.data ?? undefined,
    retry: skipNetworkFetch ? false : 2,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
  });

  const createTagMutation = useMutation({
    mutationFn: async ({
      name,
      color,
    }: {
      name: string;
      color?: string;
    }) => {
      const result = await createTransactionTag(api, { name, color });
      return result;
    },
    onSuccess: (result) => {
      const created = (result as { data?: TransactionTag })?.data;
      if (!created?.id) {
        void queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
        return;
      }

      queryClient.setQueryData<TransactionTag[]>(
        ["transactionTags", spaceCode],
        (current = []) => {
          if (current.some((tag) => tag.id === created.id)) {
            return current;
          }

          return [
            ...current,
            {
              id: created.id,
              name: created.name,
              color: created.color,
              isDefault: Boolean(
                (created as TransactionTag).isDefault ??
                  (created as { is_default?: boolean }).is_default,
              ),
              styleImageUrl:
                (created as TransactionTag).styleImageUrl ??
                (created as { style_image_url?: string }).style_image_url,
            },
          ];
        },
      );
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({
      tagId,
      updateData,
    }: {
      tagId: string;
      updateData: { name: string; color?: string };
    }) => {
      const result = await updateTransactionTag(api, tagId, updateData);
      await queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
      return result;
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await deleteTransactionTag(api, tagId);
      await queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
      return result;
    },
  });

  const toggleDefaultTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await toggleDefaultTransactionTag(api, tagId);
      await queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
      return result;
    },
  });

  const generateStyleImageMutation = useMutation({
    mutationFn: async ({
      tagId,
      prompt,
    }: {
      tagId: string;
      prompt: string;
    }) => {
      const result = await generateTransactionTagStyleImage(api, tagId, prompt);
      await queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
      return result;
    },
  });

  const tags = data ?? [];

  return {
    tags,
    defaultTag: tags.find((tag) => tag.isDefault),
    error,
    isLoading: skipNetworkFetch ? localTagsQuery.isLoading : isLoading,
    isError,
    isSuccess,
    refetch,
    createTag: createTagMutation.mutateAsync,
    updateTag: updateTagMutation.mutateAsync,
    deleteTag: deleteTagMutation.mutateAsync,
    toggleDefaultTag: toggleDefaultTagMutation.mutateAsync,
    generateStyleImage: (tagId: string, prompt: string) =>
      generateStyleImageMutation.mutateAsync({ tagId, prompt }),
    isCreating: createTagMutation.isPending,
    isUpdating: updateTagMutation.isPending,
    isDeleting: deleteTagMutation.isPending,
    isTogglingDefault: toggleDefaultTagMutation.isPending,
    isGeneratingStyleImage: generateStyleImageMutation.isPending,
  };
};
