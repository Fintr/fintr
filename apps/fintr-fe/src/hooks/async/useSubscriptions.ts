import { useQuery, useMutation, useQueryClient, useInfiniteQuery, InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const subscriptions = data || [];
  const activeSubscription = subscriptions.find((sub) => sub.status === "active");
  const cancelledSubscriptions = subscriptions.filter((sub) => sub.status === "inactive");

  return {
    subscriptions,
    subscription: activeSubscription || cancelledSubscriptions[0] || null,
    activeSubscription,
    cancelledSubscriptions,
    isLoading,
    isError,
    error,
    refetch,
  };
};

export const useHasPaidSubscription = () => {
  const { activeSubscription, isLoading } = useCurrentSubscription();

  const hasPaidSubscription =
    activeSubscription != null &&
    activeSubscription.status === "active" &&
    activeSubscription.subscriptionType !== "free";

  return {
    hasPaidSubscription,
    isLoading,
  };
};

const attachSubscriptionErrorMessage = (error: any) => {
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
  error.displayMessage = message;
  return error;
};

export const useCreateSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateSubscriptionRequest) => {
      try {
        const result = await createSubscription(api, data);
        await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
        await queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
        return result;
      } catch (error: any) {
        throw attachSubscriptionErrorMessage(error);
      }
    },
  });

  return {
    createSubscription: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useCreateSponsorSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateSponsorSubscriptionRequest) => {
      const result = await createSponsorSubscription(api, data);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      await queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
      return result;
    },
  });

  return {
    createSponsorSubscription: mutation.mutateAsync,
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
    mutationFn: async (subscriptionId: string) => {
      const result = await cancelSubscription(api, subscriptionId);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      await queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
      return result;
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
    mutationFn: async (data: SimulateCyclePaymentRequest) => {
      const result = await simulateCyclePayment(api, data);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      return result;
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
    mutationFn: async (data: ForceAttemptCycleRequest) => {
      const result = await forceAttemptCycle(api, data);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      return result;
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
    mutationFn: async ({ subscriptionId, data }: { subscriptionId: string; data: UpdateSubscriptionRequest }) => {
      const result = await updateSubscription(api, subscriptionId, data);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      await queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
      return result;
    },
  });

  return {
    updateSubscription: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

import {
  fetchSponsorCodes,
  fetchSponsorCode,
  createSponsorCode,
  updateSponsorCode,
  deleteSponsorCode,
  fetchSpacesForFreeSubscriptionPage,
  createFreeSubscription,
  removeFreeSubscription,
  CreateSponsorCodeRequest,
  SponsorCode,
  SponsorCodeWithUsers,
  CreateFreeSubscriptionRequest,
  RemoveFreeSubscriptionRequest,
  SpacesForFreeSubscriptionPage,
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
    mutationFn: async (data: CreateSponsorCodeRequest) => {
      const result = await createSponsorCode(api, data);
      await queryClient.invalidateQueries({ queryKey: ["sponsorCodes"] });
      return result;
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
    mutationFn: async ({ id, data }: { id: string; data: { active: boolean } }) => {
      const result = await updateSponsorCode(api, id, data);
      await queryClient.invalidateQueries({ queryKey: ["sponsorCodes"] });
      await queryClient.invalidateQueries({ queryKey: ["sponsorCode"] });
      return result;
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
    mutationFn: async (id: string) => {
      const result = await deleteSponsorCode(api, id);
      await queryClient.invalidateQueries({ queryKey: ["sponsorCodes"] });
      return result;
    },
  });

  return {
    deleteSponsorCode: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
};

export const useInfiniteSpacesForFreeSubscription = ({
  searchQuery,
  loadMoreRef,
}: {
  searchQuery: string;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<
    SpacesForFreeSubscriptionPage,
    Error,
    InfiniteData<SpacesForFreeSubscriptionPage>,
    string[],
    number
  >({
    queryKey: ["spacesForFreeSubscription", searchQuery],
    queryFn: ({ pageParam }) =>
      fetchSpacesForFreeSubscriptionPage(api, {
        pageParam,
        searchQuery,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        threshold: 0.1,
      },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, loadMoreRef]);

  const spaces =
    data?.pages.flatMap((page) => page.spaces) ?? [];
  const totalCount = data?.pages[0]?.pagination.totalCount ?? 0;

  return {
    spaces,
    totalCount,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  };
};

export const useCreateFreeSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateFreeSubscriptionRequest) => {
      const result = await createFreeSubscription(api, data);
      await queryClient.invalidateQueries({ queryKey: ["spacesForFreeSubscription"] });
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      return result;
    },
  });

  return {
    createFreeSubscription: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};

export const useRemoveFreeSubscription = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: RemoveFreeSubscriptionRequest) => {
      const result = await removeFreeSubscription(api, data);
      await queryClient.invalidateQueries({ queryKey: ["spacesForFreeSubscription"] });
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      return result;
    },
  });

  return {
    removeFreeSubscription: mutation.mutateAsync,
    isRemoving: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
};
