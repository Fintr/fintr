import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { 
  fetchLoanPayments, 
  createLoanPayment, 
  updateLoanPayment, 
  deleteLoanPayment,
  CreateLoanPaymentType,
  LoanPayment 
} from '@/services/loans/payments';
import { LOAN_DETAIL_KEY } from '@/hooks/async/useLoan';
import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from '@/hooks/async/useAccountDetailActivities';
import { ACCOUNT_DETAIL_TRANSACTIONS_KEY } from '@/hooks/async/useAccountDetailTransactions';

export const useLoanPayments = (loanId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const invalidateLoanPaymentQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["loanPayments", loanId] });
    await queryClient.invalidateQueries({ queryKey: ["loans"] });
    await queryClient.invalidateQueries({ queryKey: [LOAN_DETAIL_KEY, loanId] });
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({
      queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: [ACCOUNT_DETAIL_TRANSACTIONS_KEY],
      exact: false,
    });
  };

  const { data, isLoading, isError, error, refetch } = useQuery<LoanPayment[]>({
    queryKey: ['loanPayments', loanId],
    queryFn: () => fetchLoanPayments(api, loanId),
    enabled: !!loanId,
    staleTime: 30000,
    gcTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: async (paymentData: Omit<CreateLoanPaymentType, 'loanId'>) => {
      const result = await createLoanPayment(api, loanId, paymentData);
      await invalidateLoanPaymentQueries();
      return result;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ paymentId, paymentData }: { paymentId: string; paymentData: Partial<Omit<CreateLoanPaymentType, 'loanId'>> }) => {
      const result = await updateLoanPayment(api, loanId, paymentId, paymentData);
      await invalidateLoanPaymentQueries();
      return result;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const result = await deleteLoanPayment(api, loanId, paymentId);
      await invalidateLoanPaymentQueries();
      return result;
    },
  });

  return {
    payments: data || [],
    isLoading,
    isError,
    error,
    refetch,
    createPayment: createMutation.mutateAsync,
    updatePayment: updateMutation.mutateAsync,
    deletePayment: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
