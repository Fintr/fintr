import {
  fetchTransactionTags,
  generateTransactionTagStyleImage,
  assignTransactionTagStyleImage,
  toggleDefaultTransactionTag,
} from "@/services/transactions/tags/mutation";
import { createTagLocalFirst } from "@/services/transactions/tags/create-local-first";
import { deleteTagLocalFirst } from "@/services/transactions/tags/delete-local-first";
import { updateTagLocalFirst } from "@/services/transactions/tags/update-local-first";
import {
  applyToggledDefaultTag,
  cacheTransactionTagsResponse,
  loadCachedTransactionTagsResponse,
} from "@/services/transactions/tags/local-cache";
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
    networkMode: "always",
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
      stylePresetKey,
    }: {
      name: string;
      color?: string;
      stylePresetKey?: string;
    }) => {
      return createTagLocalFirst(
        api,
        {
          spaceCode,
          data: { name, color, stylePresetKey },
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({
      tagId,
      updateData,
    }: {
      tagId: string;
      updateData: { name: string; color?: string };
    }) => {
      return updateTagLocalFirst(
        api,
        {
          spaceCode,
          tagId,
          updateData,
        },
        { queryClient, waitForSync: false },
      );
    },
    networkMode: "always",
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await deleteTagLocalFirst(
        api,
        {
          spaceCode,
          tagId,
        },
        { queryClient, waitForSync: false },
      );

      void result.syncPromise.then((synced) => {
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

  const toggleDefaultTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return toggleDefaultTransactionTag(api, tagId);
    },
    onSuccess: async (updated) => {
      const current =
        queryClient.getQueryData<TransactionTag[]>([
          "transactionTags",
          spaceCode,
        ]) ??
        queryClient.getQueryData<TransactionTag[]>([
          "transactionTags",
          "local",
          spaceCode,
        ]) ??
        [];
      const next = applyToggledDefaultTag(current, updated);

      queryClient.setQueryData(["transactionTags", spaceCode], next);
      queryClient.setQueryData(
        ["transactionTags", "local", spaceCode],
        next,
      );
      await cacheTransactionTagsResponse(spaceCode, next);
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

  const assignStyleImageMutation = useMutation({
    mutationFn: async ({
      tagId,
      presetKey,
    }: {
      tagId: string;
      presetKey: string;
    }) => {
      const result = await assignTransactionTagStyleImage(api, tagId, presetKey);
      await queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
      return result;
    },
  });

  const tags = (
    skipNetworkFetch
      ? (localTagsQuery.data ?? data)
      : (data ?? localTagsQuery.data)
  ) ?? [];

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
    assignStyleImage: (tagId: string, presetKey: string) =>
      assignStyleImageMutation.mutateAsync({ tagId, presetKey }),
    isCreating: createTagMutation.isPending,
    isUpdating: updateTagMutation.isPending,
    isDeleting: deleteTagMutation.isPending,
    isTogglingDefault: toggleDefaultTagMutation.isPending,
    isGeneratingStyleImage: generateStyleImageMutation.isPending,
    isAssigningStyleImage: assignStyleImageMutation.isPending,
  };
};
