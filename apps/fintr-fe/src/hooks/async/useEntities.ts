import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import {
  EntityRecord,
  fetchEntities,
} from "@/services/entities/mutation";
import {
  filterCachedEntities,
  loadCachedEntitiesResponse,
} from "@/services/entities/local-cache";

export type EntityTypeFilter = "loan" | "transaction";

export const useEntities = (
  entityType: EntityTypeFilter,
  search?: string,
) => {
  const { api, isAuthenticated } = useAuthApi();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localEntitiesQuery = useQuery({
    queryKey: ["entities", "local", spaceCode],
    queryFn: async () =>
      (await loadCachedEntitiesResponse(spaceCode)) ?? [],
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(
    localEntitiesQuery,
    spaceCode,
  );

  const filteredLocalEntities = useMemo(
    () =>
      filterCachedEntities(
        localEntitiesQuery.data ?? [],
        entityType,
        search,
      ),
    [entityType, localEntitiesQuery.data, search],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["entities", spaceCode || "default", entityType, search ?? ""],
    queryFn: async () => {
      const response = await fetchEntities(api, {
        entityType,
        search: search?.trim() || undefined,
      });
      return (response?.data ?? []) as EntityRecord[];
    },
    enabled: Boolean(api) && Boolean(spaceCode) && isAuthenticated && !skipNetworkFetch,
    placeholderData: filteredLocalEntities,
    staleTime: skipNetworkFetch ? Infinity : 2 * 60 * 1000,
    retry: skipNetworkFetch ? false : 2,
  });

  return {
    entities: skipNetworkFetch ? filteredLocalEntities : (data ?? []),
    isLoading: skipNetworkFetch
      ? localEntitiesQuery.isLoading
      : isLoading,
    isError,
    error,
    refetch,
  };
};
