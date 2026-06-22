import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import {
  AdminUsersPagePayload,
  fetchAdminUsersPage,
} from "@/services/admin/user/queries";

export const useAdminUsers = ({
  page,
  perPage = 25,
  searchQuery,
}: {
  page: number;
  perPage?: number;
  searchQuery: string;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:admin",
  });

  return useQuery<AdminUsersPagePayload, Error>({
    queryKey: [
      "admin",
      "users",
      page,
      perPage,
      searchQuery,
    ],
    queryFn: () =>
      fetchAdminUsersPage(
        api,
        {
          page,
          perPage,
          searchQuery,
        },
      ),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};
