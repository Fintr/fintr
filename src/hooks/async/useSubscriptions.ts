import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  fetchSubscriptionPlans,
  fetchCurrentSubscription,
  SubscriptionPlan,
  SpaceSubscription,
} from "@/services/finance/subscriptions/queries";
import {
  createSubscription,
  CreateSubscriptionRequest,
  cancelSubscription,
  simulateCyclePayment,
  SimulateCyclePaymentRequest,
  forceAttemptCycle,
  ForceAttemptCycleRequest,
  updateSubscription,
  UpdateSubscriptionRequest,
} from "@/services/finance/subscriptions/mutations";

export const useSubscriptionPlans = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const { data, isLoading, isError, error, refetch } = useQuery<SubscriptionPlan[]>({
    queryKey: ["subscriptionPlans"],
    queryFn: () => fetchSubscriptionPlans(api),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    plans: data || [],
    isLoading,
    isError,
    error,
    refetch,
  };
};

export const useCurrentSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const { data, isLoading, isError, error, refetch } = useQuery<SpaceSubscription[]>({
    queryKey: ["currentSubscription"],
    queryFn: () => fetchCurrentSubscription(api),
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const subscriptions = data || [];
  const activeSubscription = subscriptions.find((sub) => sub.status === "active");
  const cancelledSubscriptions = subscriptions.filter((sub) => sub.status === "inactive");

  return {
    subscriptions,
    subscription: activeSubscription || cancelledSubscriptions[0] || null, // For backward compatibility
    activeSubscription,
    cancelledSubscriptions,
    isLoading,
    isError,
    error,
    refetch,
  };
};

export const useCreateSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) =>
      createSubscription(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
    },
  });

  return {
    createSubscription: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useCancelSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (subscriptionId: string) => cancelSubscription(api, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
    },
  });

  return {
    cancelSubscription: mutation.mutateAsync,
    isCancelling: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useSimulateCyclePayment = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: SimulateCyclePaymentRequest) =>
      simulateCyclePayment(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
    },
  });

  return {
    simulateCyclePayment: mutation.mutateAsync,
    isSimulating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useForceAttemptCycle = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: ForceAttemptCycleRequest) =>
      forceAttemptCycle(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
    },
  });

  return {
    forceAttemptCycle: mutation.mutateAsync,
    isForcing: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useUpdateSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ subscriptionId, data }: { subscriptionId: string; data: UpdateSubscriptionRequest }) =>
      updateSubscription(api, subscriptionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
    },
  });

  return {
    updateSubscription: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

