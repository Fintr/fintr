import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthApi from '../useAuthApi';
import { fetchAccounts } from '@/services/transactions/accounts/queries';
import { createAccount, updateAccount, deleteAccount, CreateAccountType, UpdateAccountType } from '@/services/transactions/accounts/mutation';
import { Account } from '@/types/accountTypes';
import { toast } from 'sonner';

export const useAccounts = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  // Fetch accounts query
  const {
    data: accounts,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts(api),
    enabled: !!api,
  });

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: (accountData: CreateAccountType) => 
      createAccount(api, accountData),
    onSuccess: (newAccount, variables) => {
      // Invalidate and refetch accounts
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      // Invalidate dashboard query to refresh account options
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Account "${variables.name}" created successfully`);
    },
    onError: (error: any) => {
      console.error('Error creating account:', error);
      toast.error('Failed to create account. Please try again.');
    },
  });

  // Update account mutation
  const updateAccountMutation = useMutation({
    mutationFn: ({ accountId, updateData }: { accountId: string; updateData: UpdateAccountType }) => 
      updateAccount(api, accountId, updateData),
    onSuccess: (updatedAccount, variables) => {
      // Invalidate and refetch accounts
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      // Don't show toast here since the EditAccountDialog handles it
    },
    onError: (error: any) => {
      console.error('Error updating account:', error);
      // Don't show toast here since the EditAccountDialog handles it
      throw error; // Re-throw to let the dialog handle the error
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) => deleteAccount(api, accountId),
    onSuccess: (response, accountId) => {
      // Invalidate and refetch accounts only if the deletion was successful
      if (response?.success === true) {
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        // Invalidate dashboard query to refresh account options
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        toast.success(`Account deleted successfully`);
      } else {
        // If backend returns success: false, re-throw to display error from dialog
        throw new Error(response?.error?.message || "Failed to delete account.");
      }
    },
    onError: (error: any) => {
      console.error('Error deleting account:', error);
      // Re-throw to let the dialog handle the error message and not close
      throw error;
    },
  });

  // Helper function to get accounts data from response
  const getAccountsData = (): Account[] => {
    if (!accounts) return [];
    
    console.log('Raw accounts data from API:', accounts);
    
    // Handle the actual API response structure based on the provided data
    let accountsArray: Account[] = [];
    
    if (accounts.data?.accounts) {
      accountsArray = accounts.data.accounts;
    } else if (accounts.accounts) {
      accountsArray = accounts.accounts;
    } else if (Array.isArray(accounts.data)) {
      accountsArray = accounts.data;
    } else if (Array.isArray(accounts)) {
      accountsArray = accounts;
    }
    
    console.log('Parsed accounts array:', accountsArray);
    
    return accountsArray;
  };

  // Helper function to get account category options from response
  const getAccountCategoryOptions = (): { label: string; value: string }[] => {
    if (!accounts) return [];
    
    // Handle the response structure to extract account category options
    if (accounts.data?.accountCategoryOptions) {
      return accounts.data.accountCategoryOptions;
    }
    if (accounts.accountCategoryOptions) {
      return accounts.accountCategoryOptions;
    }
    
    return [];
  };

  return {
    accounts: getAccountsData(),
    accountCategoryOptions: getAccountCategoryOptions(),
    isLoading,
    isError,
    error,
    refetch,
    createAccount: createAccountMutation.mutateAsync,
    isCreating: createAccountMutation.isLoading,
    updateAccount: updateAccountMutation.mutateAsync,
    isUpdating: updateAccountMutation.isLoading,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeleting: deleteAccountMutation.isLoading,
  };
}; 
