import { AxiosInstance } from "axios";

export interface UserData {
  id: string;
  fullName: string;
  email: string;
}

export interface AdminUsersPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export interface AdminUsersPagePayload {
  users: UserData[];
  pagination: AdminUsersPagination;
}

export const fetchAdminUsersPage = async (
  api: AxiosInstance,
  {
    page = 1,
    perPage = 25,
    searchQuery = "",
  }: {
    page?: number;
    perPage?: number;
    searchQuery?: string;
  },
): Promise<AdminUsersPagePayload> => {
  const response = await api.get(
    "/admin/users",
    {
      params: {
        page,
        per_page: perPage,
        search_query: searchQuery.trim() || undefined,
      },
    },
  );
  const users = response.data.data.users || [];
  const p = response.data.data.pagination || {};
  return {
    users,
    pagination: {
      currentPage: p.currentPage ?? 1,
      totalPages: p.totalPages ?? 1,
      totalCount: p.totalCount ?? 0,
    },
  };
};
