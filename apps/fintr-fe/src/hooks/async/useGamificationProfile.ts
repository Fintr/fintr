"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { achievementsApi } from "@/services/achievements/api";

export const useGamificationProfile = () => {
  const { api } = useAuthApi();

  return useQuery({
    queryKey: ["gamification", "profile"],
    queryFn: async () => {
      const response = await achievementsApi.getProfile(api);
      return response.data.data;
    },
    staleTime: 0,
  refetchOnMount: "always",
  });
};
