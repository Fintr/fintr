import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthApi from '../useAuthApi';
import { fetchWhitelists } from '@/services/admin/whitelist/queries';
import {
  createWhitelist,
  updateWhitelist,
  deleteWhitelist,
} from '@/services/admin/whitelist/mutations';
import { CreateWhitelistPayload, UpdateWhitelistPayload, DeleteWhitelistPayload, WhitelistEntry } from '@/types/adminTypes';
import { toast } from 'sonner';

export const useWhitelists = () => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: 'openid profile email',
  });

  // Query to fetch all whitelisted emails
  const whitelistsQuery = useQuery<WhitelistEntry[]>(
    {
      queryKey: ['admin', 'whitelists'],
      queryFn: () => fetchWhitelists(api),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  // Mutation to create a new whitelist entry
  const createWhitelistMutation = useMutation(
    {
      mutationFn: (payload: CreateWhitelistPayload) => createWhitelist(api, payload),
      onSuccess: () => {
        toast.success('User has been whitelisted!');
        // Invalidate and refetch all whitelists to show the new entry
        queryClient.invalidateQueries({ queryKey: ['admin', 'whitelists'], refetchType: 'active' });
        // Special handling for the create form to remain open and clear the email field
        // The form component will handle clearing its own state, this just ensures the list refreshes
      },
      onError: (error) => {
        console.error('Error creating whitelist:', error);
        toast.error('Failed to whitelist user.');
      },
    }
  );

  // Mutation to update an existing whitelist entry
  const updateWhitelistMutation = useMutation(
    {
      mutationFn: (payload: UpdateWhitelistPayload) =>
        updateWhitelist(api, payload),
      onSuccess: () => {
        toast.success('Whitelist updated successfully!');
        queryClient.invalidateQueries({ queryKey: ['admin', 'whitelists'], refetchType: 'active' });
      },
      onError: (error) => {
        console.error('Error updating whitelist:', error);
        toast.error('Failed to update whitelist.');
      },
    }
  );

  // Mutation to delete a whitelist entry
  const deleteWhitelistMutation = useMutation(
    {
      mutationFn: (payload: DeleteWhitelistPayload) => deleteWhitelist(api, payload),
      onSuccess: () => {
        toast.success('Whitelist deleted successfully!');
        queryClient.invalidateQueries({ queryKey: ['admin', 'whitelists'], refetchType: 'active' });
      },
      onError: (error) => {
        console.error('Error deleting whitelist:', error);
        toast.error('Failed to delete whitelist.');
      },
    }
  );

  return {
    whitelistsQuery,
    createWhitelistMutation,
    updateWhitelistMutation,
    deleteWhitelistMutation,
  };
}; 
