import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import {
  cacheEntityIdentifiers,
  loadCachedEntityDetail,
} from "@/services/entities/local-cache";
import {
  fetchEntityDetail,
  type EntityDetail,
} from "@/services/entities/mutation";

export const ENTITY_DETAIL_KEY = "entityDetail" as const;

export const useEntityDetail = (entityId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localCacheQuery = useQuery({
    queryKey: [ENTITY_DETAIL_KEY, "local", spaceCode, entityId],
    queryFn: async () =>
      (await loadCachedEntityDetail(spaceCode, entityId)) ?? null,
    enabled: Boolean(spaceCode && entityId),
    staleTime: Infinity,
    networkMode: "always",
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(
    localCacheQuery,
    spaceCode,
  );

  const query = useQuery<EntityDetail>({
    queryKey: [ENTITY_DETAIL_KEY, spaceCode, entityId],
    queryFn: async () => {
      if (skipNetworkFetch) {
        const cached = await loadCachedEntityDetail(spaceCode, entityId);

        if (cached) {
          return cached;
        }

        throw new Error("No cached entity detail");
      }

      try {
        const detail = await fetchEntityDetail(api, entityId);
        await cacheEntityIdentifiers({
          spaceCode,
          entityId,
          identifiers: detail.identifiers,
        });
        return detail;
      } catch (error) {
        const cached = await loadCachedEntityDetail(spaceCode, entityId);

        if (cached) {
          return cached;
        }

        throw error;
      }
    },
    enabled:
      Boolean(entityId) &&
      Boolean(spaceCode) &&
      (!skipNetworkFetch || localCacheQuery.isSuccess),
    placeholderData: localCacheQuery.data || undefined,
    retry: false,
    refetchOnMount: !skipNetworkFetch,
    refetchOnWindowFocus: false,
    staleTime: skipNetworkFetch ? Infinity : 0,
    networkMode: "always",
  });

  return {
    ...query,
    data: query.data ?? localCacheQuery.data ?? undefined,
    isLoading:
      localCacheQuery.isPending ||
      (query.isPending && !query.data && !localCacheQuery.data),
  };
};
