import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { fetchPaymentMethods, PaymentMethod } from "@/services/finance/payment-methods/queries";
import {
  initializeAccountLinking,
  createPaymentMethod,
  deletePaymentMethod,
  InitializeLinkingRequest,
  CreatePaymentMethodRequest,
} from "@/services/finance/payment-methods/mutations";

export const usePaymentMethods = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<PaymentMethod[]>({
    queryKey: ["paymentMethods"],
    queryFn: () => fetchPaymentMethods(api),
    staleTime: 30000,
    cacheTime: 300000,
  });

  const initializeLinkingMutation = useMutation({
    mutationFn: (data: InitializeLinkingRequest) =>
      initializeAccountLinking(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentMethodRequest) =>
      createPaymentMethod(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      deletePaymentMethod(api, paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
  });

  return {
    paymentMethods: data || [],
    isLoading,
    isError,
    error,
    refetch,
    initializeLinking: initializeLinkingMutation.mutateAsync,
    isInitializingLinking: initializeLinkingMutation.isPending,
    createPaymentMethod: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deletePaymentMethod: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

