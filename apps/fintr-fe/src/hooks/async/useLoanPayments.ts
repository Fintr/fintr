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

export const useLoanPayments = (loanId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<LoanPayment[]>({
    queryKey: ['loanPayments', loanId],
    queryFn: () => fetchLoanPayments(api, loanId),
    enabled: !!loanId,
    staleTime: 30000,
    cacheTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: (paymentData: Omit<CreateLoanPaymentType, 'loanId'>) =>
      createLoanPayment(api, loanId, paymentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanPayments', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ paymentId, paymentData }: { paymentId: string; paymentData: Partial<Omit<CreateLoanPaymentType, 'loanId'>> }) =>
      updateLoanPayment(api, loanId, paymentId, paymentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanPayments', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) =>
      deleteLoanPayment(api, loanId, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanPayments', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  };
};


