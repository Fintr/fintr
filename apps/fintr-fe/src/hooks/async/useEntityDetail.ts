import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import {
  loadCachedEntityDetail,
} from "@/services/entities/local-cache";
import { fetchEntityDetail } from "@/services/entities/mutation";

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
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  return useQuery({
    queryKey: [ENTITY_DETAIL_KEY, entityId],
    queryFn: async () => {
      if (skipNetworkFetch) {
        const cached = await loadCachedEntityDetail(spaceCode, entityId);

        if (cached) {
          return cached;
        }

        throw new Error("No cached entity detail");
      }

      try {
        return await fetchEntityDetail(api, entityId);
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
      (!skipNetworkFetch || Boolean(localCacheQuery.data)),
    placeholderData: localCacheQuery.data ?? undefined,
    retry: false,
    refetchOnMount: !skipNetworkFetch,
    refetchOnWindowFocus: false,
    staleTime: skipNetworkFetch ? Infinity : 0,
  });
};
