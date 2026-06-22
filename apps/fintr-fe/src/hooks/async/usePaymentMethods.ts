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
    gcTime: 300000,
  });

  const initializeLinkingMutation = useMutation({
    mutationFn: async (data: InitializeLinkingRequest) => {
      const result = await initializeAccountLinking(api, data);
      await queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
      return result;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreatePaymentMethodRequest) => {
      const result = await createPaymentMethod(api, data);
      await queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
      return result;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const result = await deletePaymentMethod(api, paymentMethodId);
      await queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
      return result;
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
