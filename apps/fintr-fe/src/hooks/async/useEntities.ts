import { useQuery } from "@tanstack/react-query";

import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  EntityRecord,
  fetchEntities,
} from "@/services/entities/mutation";

export type EntityTypeFilter = "loan" | "transaction";

export const useEntities = (
  entityType: EntityTypeFilter,
  search?: string,
) => {
  const { api, isAuthenticated } = useAuthApi();
  const [spaceCode] = useLocalStorage("spaceCode", "");

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
    enabled: Boolean(api) && Boolean(spaceCode) && isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  return {
    entities: data ?? [],
    isLoading,
    isError,
    error,
    refetch,
  };
};
