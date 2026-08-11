import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { fetchEntityDetail } from "@/services/entities/mutation";

export const ENTITY_DETAIL_KEY = "entityDetail" as const;

export const useEntityDetail = (entityId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  return useQuery({
    queryKey: [ENTITY_DETAIL_KEY, entityId],
    queryFn: () => fetchEntityDetail(api, entityId),
    enabled: Boolean(entityId),
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
};
