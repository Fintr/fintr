import { useQuery } from "@tanstack/react-query";

import { useAuthApi } from "@/hooks/useAuthApi";
import {
  fetchProAccess,
  readCachedProAccess,
  type ProAccess,
} from "@/services/finance/pro-access";

export const PRO_ACCESS_QUERY_KEY = ["finance", "proAccess"] as const;

export const useProAccess = () => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user",
  });

  return useQuery<ProAccess>({
    queryKey: PRO_ACCESS_QUERY_KEY,
    queryFn: () => fetchProAccess(api),
    enabled: isAuthenticated,
    placeholderData: () => readCachedProAccess() ?? undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    networkMode: "offlineFirst",
  });
};
