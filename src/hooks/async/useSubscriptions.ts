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
  createSponsorSubscription,
  CreateSponsorSubscriptionRequest,
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
    onError: (error: any) => {
      // Extract readable error message
      let message = "Failed to create subscription";
      if (error?.response?.data?.error?.message) {
        message = error.response.data.error.message;
        const details = error.response.data.error.details;
        if (details && typeof details === "object") {
          const detailStr = Object.entries(details)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ");
          if (detailStr) message += ` (${detailStr})`;
        }
      } else if (error?.message) {
        message = error.message;
      }
      // Attach processed message for components to use
      error.displayMessage = message;
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

// Admin hooks for sponsor codes and free subscriptions
import {
  fetchSponsorCodes,
  fetchSponsorCode,
  createSponsorCode,
  updateSponsorCode,
  deleteSponsorCode,
  fetchSpacesForFreeSubscription,
  createFreeSubscription,
  CreateSponsorCodeRequest,
  SponsorCode,
  SponsorCodeWithUsers,
  SpaceForFreeSubscription,
  CreateFreeSubscriptionRequest,
} from "@/services/finance/subscriptions/admin";

export const useSponsorCodes = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const { data, isLoading, error, refetch } = useQuery<SponsorCode[]>({
    queryKey: ["sponsorCodes"],
    queryFn: () => fetchSponsorCodes(api),
    staleTime: 1 * 60 * 1000,
  });

  return {
    sponsorCodes: data || [],
    isLoading,
    error,
    refetch,
  };
};

export const useSponsorCode = (id: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const { data, isLoading, error } = useQuery<SponsorCodeWithUsers>({
    queryKey: ["sponsorCode", id],
    queryFn: () => fetchSponsorCode(api, id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });

  return {
    sponsorCode: data,
    isLoading,
    error,
  };
};

export const useCreateSponsorCode = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateSponsorCodeRequest) => createSponsorCode(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsorCodes"] });
    },
  });

  return {
    createSponsorCode: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useUpdateSponsorCode = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { active: boolean } }) =>
      updateSponsorCode(api, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsorCodes"] });
      queryClient.invalidateQueries({ queryKey: ["sponsorCode"] });
    },
  });

  return {
    updateSponsorCode: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
};

export const useDeleteSponsorCode = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => deleteSponsorCode(api, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsorCodes"] });
    },
  });

  return {
    deleteSponsorCode: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
};

// Free subscriptions admin hooks
export const useSpacesForFreeSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const { data, isLoading, error, refetch } = useQuery<SpaceForFreeSubscription[]>({
    queryKey: ["spacesForFreeSubscription"],
    queryFn: () => fetchSpacesForFreeSubscription(api),
    staleTime: 1 * 60 * 1000,
  });

  return {
    spaces: data || [],
    isLoading,
    error,
    refetch,
  };
};

export const useCreateFreeSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateFreeSubscriptionRequest) => createFreeSubscription(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spacesForFreeSubscription"] });
      queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
    },
  });

  return {
    createFreeSubscription: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

