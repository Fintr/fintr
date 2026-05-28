import { AxiosInstance } from "axios";

// Sponsor Code Types
export interface SponsorCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountPercentage?: number;
  discountAmountCents?: number;
  maxUses?: number;
  currentUses: number;
  usageCount: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
  };
}

export interface SponsorCodeWithUsers extends SponsorCode {
  users: {
    userId: string;
    userEmail: string;
    spaceSubscriptionId: string;
    discountPercentageApplied?: number;
    discountAmountCentsApplied?: number;
    createdAt: string;
  }[];
}

export interface CreateSponsorCodeRequest {
  code: string;
  name: string;
  description?: string;
  discountPercentage?: number;
  discountAmountCents?: number;
  maxUses?: number;
  expiresAt?: string;
  active?: boolean;
}

// Free Subscription Types
export interface SpaceForFreeSubscription {
  id: string;
  name: string;
  code: string;
  type: "Personal" | "Organization";
  currency: string;
  ownerEmail?: string;
  ownerName?: string;
  transactionsCount: number;
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  subscriptionType?: string;
  createdAt: string;
}

export interface SpacesForFreeSubscriptionPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export interface SpacesForFreeSubscriptionPage {
  spaces: SpaceForFreeSubscription[];
  nextPage: number | null;
  pagination: SpacesForFreeSubscriptionPagination;
}

export interface CreateFreeSubscriptionRequest {
  spaceId: string;
  subscriptionPlanId: string;
  notes?: string;
  anchorDate?: string;
}

export interface RemoveFreeSubscriptionRequest {
  spaceId: string;
}

// Sponsor Code API
export const fetchSponsorCodes = async (api: AxiosInstance): Promise<SponsorCode[]> => {
  const response = await api.get("/admin/finance/sponsor_codes");
  return response.data.data.sponsorCodes || [];
};

export const fetchSponsorCode = async (api: AxiosInstance, id: string): Promise<SponsorCodeWithUsers> => {
  const response = await api.get(`/admin/finance/sponsor_codes/${id}`);
  return response.data.data.sponsorCode;
};

export const createSponsorCode = async (
  api: AxiosInstance,
  data: CreateSponsorCodeRequest
): Promise<{ sponsorCode: { id: string; code: string; name: string } }> => {
  const response = await api.post("/admin/finance/sponsor_codes", data);
  return response.data.data;
};

export const updateSponsorCode = async (
  api: AxiosInstance,
  id: string,
  data: { active: boolean }
): Promise<{ sponsorCode: { id: string; code: string; active: boolean } }> => {
  const response = await api.put(`/admin/finance/sponsor_codes/${id}`, data);
  return response.data.data;
};

export const deleteSponsorCode = async (api: AxiosInstance, id: string): Promise<void> => {
  await api.delete(`/admin/finance/sponsor_codes/${id}`);
};

// Free Subscription API
const SPACES_PER_PAGE = 25;

export const fetchSpacesForFreeSubscriptionPage = async (
  api: AxiosInstance,
  {
    pageParam = 1,
    searchQuery = "",
    perPage = SPACES_PER_PAGE,
  }: {
    pageParam?: number;
    searchQuery?: string;
    perPage?: number;
  },
): Promise<SpacesForFreeSubscriptionPage> => {
  const response = await api.get("/admin/finance/free_subscriptions/spaces", {
    params: {
      page: pageParam,
      per_page: perPage,
      search_query: searchQuery.trim() || undefined,
    },
  });

  const spaces: SpaceForFreeSubscription[] = response.data.data.spaces || [];
  const pagination = response.data.data.pagination || {};
  const currentPage = pagination.currentPage ?? pagination.current_page ?? pageParam;
  const totalPages = pagination.totalPages ?? pagination.total_pages ?? 1;
  const totalCount = pagination.totalCount ?? pagination.total_count ?? 0;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return {
    spaces,
    nextPage,
    pagination: {
      currentPage,
      totalPages,
      totalCount,
    },
  };
};

export const createFreeSubscription = async (
  api: AxiosInstance,
  data: CreateFreeSubscriptionRequest
): Promise<{ subscription: unknown }> => {
  const response = await api.post("/admin/finance/free_subscriptions", data);
  return response.data.data;
};

export const removeFreeSubscription = async (
  api: AxiosInstance,
  data: RemoveFreeSubscriptionRequest
): Promise<{ subscription: unknown }> => {
  const response = await api.delete("/admin/finance/free_subscriptions/remove", {
    data,
  });
  return response.data.data;
};
