import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { spacesApi } from '@/services/spaces/api';
import { GrantAccessRequest } from '@/types/spaceTypes';
import { toast } from 'sonner';

export const useSpaceUsers = () => {
  const { api, isAuthenticated } = useAuthApi();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const queryClient = useQueryClient();

  const {
    data: users,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['spaceUsers', spaceCode],
    queryFn: () => spacesApi.getSpaceUsers(api, spaceCode),
    enabled: !!spaceCode && isAuthenticated,
    staleTime: 30000,
  });

  const grantAccessMutation = useMutation({
    mutationFn: async (data: GrantAccessRequest) => {
      try {
        const response = await spacesApi.grantAccess(api, spaceCode, data);
        await queryClient.invalidateQueries({ queryKey: ['spaceUsers', spaceCode] });
        toast.success('Access granted successfully');
        return response;
      } catch (error: any) {
        toast.error(`Failed to grant access: ${error.response?.data?.message || error.message}`);
        throw error;
      }
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      try {
        const response = await spacesApi.removeUser(api, spaceCode, userId);
        await queryClient.invalidateQueries({ queryKey: ['spaceUsers', spaceCode] });
        toast.success('User removed successfully');
        return response;
      } catch (error: any) {
        toast.error(`Failed to remove user: ${error.response?.data?.message || error.message}`);
        throw error;
      }
    },
  });

  const grantAccess = (data: GrantAccessRequest) => {
    grantAccessMutation.mutate(data);
  };

  const removeUser = (userId: string) => {
    removeUserMutation.mutate(userId);
  };

  const usersList = (users as any)?.data?.data?.users || [];
  
  return {
    users: usersList,
    isLoading,
    isError,
    refetch,
    grantAccess,
    removeUser,
    isGrantingAccess: grantAccessMutation.isPending,
    isRemovingUser: removeUserMutation.isPending,
  };
};
