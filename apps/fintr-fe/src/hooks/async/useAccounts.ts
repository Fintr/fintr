import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthApi from '../useAuthApi';
import { fetchAccounts } from '@/services/transactions/accounts/queries';
import {
  cacheAccountsResponse,
  extractAccountsFromResponse,
  loadCachedAccountsResponse,
} from '@/services/transactions/accounts/local-cache';
import { createAccount, updateAccount, deleteAccount, adjustAccountBalance, CreateAccountType, UpdateAccountType, AdjustAccountBalanceType } from '@/services/transactions/accounts/mutation';
import { Account, AccountBalanceTotals } from '@/types/accountTypes';
import { toast } from 'sonner';
import {
  ACCOUNT_ADJUSTMENT_HISTORY_KEY,
  ACCOUNT_DETAIL_TRANSACTIONS_KEY,
} from "@/hooks/async/useAccountDetailTransactions";
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";

export const useAccounts = () => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const invalidateAccountQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    await queryClient.invalidateQueries({ queryKey: [ACCOUNT_DETAIL_TRANSACTIONS_KEY] });
    await queryClient.invalidateQueries({ queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY] });
    await queryClient.invalidateQueries({ queryKey: [ACCOUNT_ADJUSTMENT_HISTORY_KEY] });
    await queryClient.invalidateQueries({ queryKey: ["accountTransactions"] });
  };

  const localCacheQuery = useQuery({
    queryKey: ['accounts', 'local', spaceCode],
    queryFn: async () =>
      (await loadCachedAccountsResponse(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  const {
    data: accounts,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['accounts', spaceCode || 'default'],
    queryFn: async () => {
      try {
        const response = await fetchAccounts(api);
        if (spaceCode) {
          void cacheAccountsResponse(spaceCode, response).then(() => {
            queryClient.setQueryData(
              ['accounts', 'local', spaceCode],
              response
            );
          });
        }
        return response;
      } catch (error) {
        if (spaceCode) {
          const cached = await loadCachedAccountsResponse(spaceCode);
          if (cached != null) {
            return cached;
          }
        }
        throw error;
      }
    },
    enabled: !!api && !!spaceCode && isAuthenticated && !skipNetworkFetch,
    placeholderData: localCacheQuery.data ?? undefined,
    staleTime: skipNetworkFetch ? Infinity : 5 * 60 * 1000,
    refetchOnMount: !skipNetworkFetch,
  });

  const createAccountMutation = useMutation({
    mutationFn: async (accountData: CreateAccountType) => {
      try {
        const newAccount = await createAccount(api, accountData);
        await invalidateAccountQueries();
        toast.success(`Account "${accountData.name}" created successfully`);
        return newAccount;
      } catch (error: any) {
        console.error('Error creating account:', error);
        toast.error('Failed to create account. Please try again.');
        throw error;
      }
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ accountId, updateData }: { accountId: string; updateData: UpdateAccountType }) => {
      try {
        const updatedAccount = await updateAccount(api, accountId, updateData);
        await invalidateAccountQueries();
        return updatedAccount;
      } catch (error: any) {
        console.error('Error updating account:', error);
        throw error;
      }
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      try {
        const response = await deleteAccount(api, accountId);
        if (response?.success !== true) {
          throw new Error(response?.error?.message || "Failed to delete account.");
        }
        await invalidateAccountQueries();
        toast.success(`Account deleted successfully`);
        return response;
      } catch (error: any) {
        console.error('Error deleting account:', error);
        throw error;
      }
    },
  });

  const adjustAccountBalanceMutation = useMutation({
    mutationFn: async ({ accountId, adjustmentData }: { accountId: string; adjustmentData: AdjustAccountBalanceType }) => {
      try {
        const response = await adjustAccountBalance(api, accountId, adjustmentData);
        await invalidateAccountQueries();
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        await queryClient.invalidateQueries({ queryKey: ['filteredTransactions'] });
        return response;
      } catch (error: any) {
        console.error('Error adjusting account balance:', error);
        throw error;
      }
    },
  });

  const getAccountsData = (): Account[] => {
    if (!accounts) return [];
    return extractAccountsFromResponse(accounts);
  };

  const getBalanceTotals = (): AccountBalanceTotals | null => {
    if (!accounts) return null;

    const totals =
      accounts.data?.balanceTotals ??
      accounts.balanceTotals ??
      accounts.data?.balance_totals ??
      accounts.balance_totals;

    if (!totals) return null;

    return {
      total: Number(totals.total ?? 0),
      cashTotal: Number(totals.cashTotal ?? totals.cash_total ?? 0),
      payableTotal: Number(totals.payableTotal ?? totals.payable_total ?? 0),
      currency: totals.currency ?? "PHP",
    };
  };

  const getAccountCategoryOptions = (): { label: string; value: string }[] => {
    if (!accounts) return [];
    
    if (accounts.data?.accountCategoryOptions) {
      return accounts.data.accountCategoryOptions;
    }
    if (accounts.accountCategoryOptions) {
      return accounts.accountCategoryOptions;
    }
    
    return [];
  };

  const showLocalPlaceholder =
    Boolean(localCacheQuery.data) &&
    (isLoading || accounts === undefined);

  return {
    accounts: getAccountsData(),
    balanceTotals: getBalanceTotals(),
    accountCategoryOptions: getAccountCategoryOptions(),
    isLoading: isLoading && !localCacheQuery.data,
    isShowingLocalCache: showLocalPlaceholder,
    isError,
    error,
    refetch,
    createAccount: createAccountMutation.mutateAsync,
    isCreating: createAccountMutation.isPending,
    updateAccount: updateAccountMutation.mutateAsync,
    isUpdating: updateAccountMutation.isPending,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeleting: deleteAccountMutation.isPending,
    adjustAccountBalance: adjustAccountBalanceMutation.mutateAsync,
    isAdjusting: adjustAccountBalanceMutation.isPending,
  };
};
