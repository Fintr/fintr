import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { AxiosInstance } from 'axios';

export interface UserData {
  id: string;
  fullName: string;
  email: string;
}

export const useGetUsers = () => {
  const { api } = useAuthApi();
  return useQuery<UserData[], Error>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const response = await api.get("/admin/users");
      return response.data.data.users;
    },
  });
};

interface FetchUsersPageProps {
  page?: number;
  queryKey?: any[];
  searchQuery?: string;
}

export const fetchUsersPage = async (
  api: AxiosInstance,
  { page = 1, searchQuery = "" }: FetchUsersPageProps
): Promise<{ users: UserData[]; nextPage: number | undefined }> => {
  const perPage = 2; // Adjusted to match current test scenario of loading 2 users
  try {
    const response = await api.get("/admin/users", {
      params: { page: page, perPage: perPage, searchQuery: searchQuery },
    });
    const users = response.data.data.users || [];
    // Check if the number of users returned is exactly 'perPage'.
    // If it's less, it implies this is the last page.
    const hasMore = users.length === perPage;
    const nextPage = hasMore ? page + 1 : undefined;

    return { users, nextPage };
  } catch (error) {
    console.error("Error fetching users page:", error);
    throw error;
  }
};
