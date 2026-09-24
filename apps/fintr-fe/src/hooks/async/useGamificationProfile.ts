"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthApi } from "@/hooks/useAuthApi";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { achievementsApi } from "@/services/achievements/api";
import {
  cacheGamificationProfile,
  GAMIFICATION_PROFILE_LOCAL_QUERY_KEY,
  GAMIFICATION_PROFILE_QUERY_KEY,
  loadCachedGamificationProfile,
  normalizeGamificationProfile,
} from "@/services/achievements/local-cache";
import type { GamificationProfile } from "@/types/badgeTypes";

export const useGamificationProfile = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  const localQuery = useQuery({
    queryKey: GAMIFICATION_PROFILE_LOCAL_QUERY_KEY,
    queryFn: async () => (await loadCachedGamificationProfile()) ?? null,
    staleTime: Infinity,
    networkMode: "always",
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localQuery);

  const networkQuery = useQuery({
    queryKey: GAMIFICATION_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const response = await achievementsApi.getProfile(api);
      const profile = normalizeGamificationProfile(response.data.data);

      if (!profile) {
        throw new Error("Invalid gamification profile");
      }

      await cacheGamificationProfile(profile);
      queryClient.setQueryData(
        GAMIFICATION_PROFILE_LOCAL_QUERY_KEY,
        profile,
      );
      return profile;
    },
    enabled: !skipNetworkFetch,
    placeholderData: localQuery.data ?? undefined,
    retry: skipNetworkFetch ? false : 2,
    refetchOnMount: skipNetworkFetch ? false : "always",
    staleTime: skipNetworkFetch ? Infinity : 0,
  });

  const data: GamificationProfile | undefined | null = skipNetworkFetch
    ? (localQuery.data ?? networkQuery.data)
    : (networkQuery.data ?? localQuery.data);

  return {
    ...networkQuery,
    data: data ?? undefined,
    isLoading: skipNetworkFetch ? localQuery.isPending : networkQuery.isPending,
  };
};
