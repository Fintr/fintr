import { AxiosInstance } from "axios";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tokenLimit: number;
  priceCents: number;
  priceCurrency: string;
  interval: "month" | "year";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanResponse {
  success: boolean;
  message: string;
  data: {
    subscriptionPlans: SubscriptionPlan[];
  };
}

export interface BillingCycle {
  id: string;
  cycleNumber: number;
  status: string;
  actionUrl?: string;
  startedAt?: string;
  endsAt?: string;
  paidAt?: string;
  scheduledTimestamp?: string;
  tokensAllocated: number;
  xenditCycleId?: string;
}

export interface SpaceSubscription {
  id: string;
  subscriptionPlan: SubscriptionPlan;
  status: string;
  startedAt: string;
  endedAt?: string;
  gracePeriodEndsAt?: string;
  currentCycleCount: number;
  totalCycles?: number;
  currentFailedCycle?: BillingCycle;
  billingCycles?: BillingCycle[];
  actionUrl?: string;
  canChangePlan?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscriptions: SpaceSubscription[];
  };
}

export const fetchSubscriptionPlans = async (
  api: AxiosInstance
): Promise<SubscriptionPlan[]> => {
  const response = await api.get<SubscriptionPlanResponse>(
    "/finance/subscriptions"
  );
  // The backend transforms subscription_plans to subscriptionPlans via LowerCamelKeys
  return response.data.data.subscriptionPlans || [];
};

export const fetchCurrentSubscription = async (
  api: AxiosInstance
): Promise<SpaceSubscription[]> => {
  const response = await api.get<CurrentSubscriptionResponse>(
    "/finance/subscriptions/current_subscriptions"
  );
  return response.data.data.subscriptions || [];
};
