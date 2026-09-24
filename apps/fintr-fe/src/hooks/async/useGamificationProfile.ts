"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthApi } from "@/hooks/useAuthApi";
import { useBrowserOnline } from "@/hooks/useOfflineReadMode";
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
  const isOnline = useBrowserOnline();

  const localQuery = useQuery({
    queryKey: GAMIFICATION_PROFILE_LOCAL_QUERY_KEY,
    queryFn: async () => (await loadCachedGamificationProfile()) ?? null,
    staleTime: Infinity,
    networkMode: "always",
  });

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
    enabled: isOnline,
    placeholderData: localQuery.data ?? undefined,
    retry: isOnline ? 2 : false,
    refetchOnMount: isOnline ? "always" : false,
    staleTime: isOnline ? 0 : Infinity,
  });

  const data: GamificationProfile | undefined | null = isOnline
    ? (networkQuery.data ?? localQuery.data)
    : (localQuery.data ?? networkQuery.data);

  return {
    ...networkQuery,
    data: data ?? undefined,
    isLoading: data ? false : (isOnline ? networkQuery.isPending : localQuery.isPending),
  };
};
