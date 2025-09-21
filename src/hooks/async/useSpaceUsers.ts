import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { spacesApi } from '@/services/spaces/api';
import { SpaceUser, GrantAccessRequest } from '@/types/spaceTypes';
import { toast } from 'sonner';

export const useSpaceUsers = () => {
  const { api } = useAuthApi();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const queryClient = useQueryClient();

  // Fetch space users
  const {
    data: users,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['spaceUsers', spaceCode],
    queryFn: () => spacesApi.getSpaceUsers(api, spaceCode),
    enabled: !!spaceCode,
    staleTime: 30000, // 30 seconds
  });


  // Grant access mutation
  const grantAccessMutation = useMutation({
    mutationFn: (data: GrantAccessRequest) => 
      spacesApi.grantAccess(api, spaceCode, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['spaceUsers', spaceCode] });
      toast.success('Access granted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to grant access: ${error.response?.data?.message || error.message}`);
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => 
      spacesApi.removeUser(api, spaceCode, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaceUsers', spaceCode] });
      toast.success('User removed successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to remove user: ${error.response?.data?.message || error.message}`);
    },
  });

  const grantAccess = (data: GrantAccessRequest) => {
    grantAccessMutation.mutate(data);
  };

  const removeUser = (userId: string) => {
    removeUserMutation.mutate(userId);
  };

  // Access users from the correct path: response.data.data.users
  const usersList = users?.data?.data?.users || [];
  
  return {
    users: usersList,
    isLoading,
    isError,
    refetch,
    grantAccess,
    removeUser,
    isGrantingAccess: grantAccessMutation.isLoading,
    isRemovingUser: removeUserMutation.isLoading,
  };
};
