import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  cacheEntitiesResponse,
  loadCachedEntitiesResponse,
} from "@/services/entities/local-cache";
import { fetchEntities } from "@/services/entities/mutation";
import { applyAccountsResponseToCaches } from "@/services/transactions/accounts/account-cache-ops";
import {
  cacheTransactionCategoriesResponse,
  loadCachedTransactionCategoriesResponse,
} from "@/services/transactions/categories/local-cache";
import {
  cacheTransactionTagsResponse,
  normalizeTransactionTags,
} from "@/services/transactions/tags/local-cache";
import { hydrateBudgetsFromServer } from "@/services/budgets/hydrate-from-server";
import { fetchTransactionTags } from "@/services/transactions/tags/mutation";

const spaceRequestConfig = (spaceCode: string) => ({
  headers: {
    "X-Space-Code": spaceCode,
  },
});

/**
 * Refreshes reference-data snapshots after a successful pull so accounts,
 * categories, tags, and entities stay aligned with the server without a
 * full bootstrap.
 */
export const refreshReferenceDataCaches = async (params: {
  api: AxiosInstance;
  spaceCode: string;
  queryClient: QueryClient;
}): Promise<void> => {
  const { api, spaceCode, queryClient } = params;
  const config = spaceRequestConfig(spaceCode);

  try {
    const accountsResponse = await api.get("/transactions/accounts", config);
    await applyAccountsResponseToCaches({
      spaceId: spaceCode,
      response: accountsResponse.data,
      queryClient,
    });
    queryClient.setQueryData(
      ["accounts", spaceCode || "default"],
      accountsResponse.data,
    );
  } catch (error) {
    console.warn("[sync] Reference refresh accounts failed", spaceCode, error);
  }

  try {
    const categoriesResponse = await api.get("/transactions/categories", config);
    await cacheTransactionCategoriesResponse(spaceCode, categoriesResponse.data);
    queryClient.setQueryData(
      ["transactionCategories", "local", spaceCode],
      categoriesResponse.data,
    );
    queryClient.setQueryData(
      ["transactionCategories", spaceCode],
      categoriesResponse.data,
    );
  } catch (error) {
    console.warn("[sync] Reference refresh categories failed", spaceCode, error);
  }

  try {
    const tags = await fetchTransactionTags(api);
    const normalizedTags = normalizeTransactionTags(tags);
    await cacheTransactionTagsResponse(spaceCode, normalizedTags);
    queryClient.setQueryData(["transactionTags", "local", spaceCode], normalizedTags);
    queryClient.setQueryData(["transactionTags", spaceCode], normalizedTags);
  } catch (error) {
    console.warn("[sync] Reference refresh tags failed", spaceCode, error);
  }

  try {
    const merchantsResponse = await fetchEntities(api, { entityType: "transaction" });
    const loanContactsResponse = await fetchEntities(api, { entityType: "loan" });
    const entities = [
      ...(merchantsResponse?.data ?? []),
      ...(loanContactsResponse?.data ?? []),
    ];
    await cacheEntitiesResponse(spaceCode, entities);
    const cachedEntities =
      (await loadCachedEntitiesResponse(spaceCode)) ?? entities;
    queryClient.setQueryData(
      ["entities", "local", spaceCode],
      cachedEntities,
    );
  } catch (error) {
    console.warn("[sync] Reference refresh entities failed", spaceCode, error);
  }

  try {
    await hydrateBudgetsFromServer(
      api,
      { spaceCode },
      { queryClient },
    );
  } catch (error) {
    console.warn("[sync] Reference refresh budgets failed", spaceCode, error);
  }

  void queryClient.invalidateQueries({ queryKey: ["accounts", spaceCode] });
  void queryClient.invalidateQueries({ queryKey: ["transactionCategories", spaceCode] });
  void queryClient.invalidateQueries({ queryKey: ["transactionTags", spaceCode] });
  void queryClient.invalidateQueries({ queryKey: ["entities", spaceCode] });

  // Ensure category-id resolution for offline edit forms stays current.
  void loadCachedTransactionCategoriesResponse(spaceCode);
};
