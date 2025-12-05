import { AxiosInstance } from "axios";
import { SpaceSubscription } from "./queries";

export interface CreateSubscriptionRequest {
  subscriptionPlanId: string;
  totalCycles?: number;
  anchorDate?: string;
  successReturnUrl?: string;
  failureReturnUrl?: string;
}

export interface CreateSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: SpaceSubscription;
    actionUrl?: string;
    status: string;
  };
}

export const createSubscription = async (
  api: AxiosInstance,
  data: CreateSubscriptionRequest
): Promise<CreateSubscriptionResponse["data"]> => {
  const response = await api.post<CreateSubscriptionResponse>(
    "/finance/subscriptions",
    data
  );
  return response.data.data;
};

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: SpaceSubscription;
  };
}

export const cancelSubscription = async (
  api: AxiosInstance,
  subscriptionId: string
): Promise<CancelSubscriptionResponse["data"]> => {
  const response = await api.post<CancelSubscriptionResponse>(
    `/finance/subscriptions/${subscriptionId}/cancel`
  );
  return response.data.data;
};

export interface SimulateCyclePaymentRequest {
  billingCycleId: string;
  amount: number;
}

export interface SimulateCyclePaymentResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    plan_id: string;
    status: string;
    amount: number;
  };
}

export const simulateCyclePayment = async (
  api: AxiosInstance,
  data: SimulateCyclePaymentRequest
): Promise<SimulateCyclePaymentResponse["data"]> => {
  const response = await api.post<SimulateCyclePaymentResponse>(
    "/finance/subscriptions/simulate_cycle_payment",
    data
  );
  return response.data.data;
};

export interface ForceAttemptCycleRequest {
  billingCycleId: string;
}

export interface ForceAttemptCycleResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    plan_id: string;
    status: string;
  };
}

export const forceAttemptCycle = async (
  api: AxiosInstance,
  data: ForceAttemptCycleRequest
): Promise<ForceAttemptCycleResponse["data"]> => {
  const response = await api.post<ForceAttemptCycleResponse>(
    "/finance/subscriptions/force_attempt_cycle",
    data
  );
  return response.data.data;
};

export interface UpdateSubscriptionRequest {
  subscriptionPlanId: string;
  effectiveDate?: string;
}

export interface UpdateSubscriptionResponse {
  success: boolean;
  message: string;
  data: {
    subscription: SpaceSubscription;
    paymentSessionUrl?: string;
  };
}

export const updateSubscription = async (
  api: AxiosInstance,
  subscriptionId: string,
  data: UpdateSubscriptionRequest
): Promise<UpdateSubscriptionResponse["data"]> => {
  const response = await api.put<UpdateSubscriptionResponse>(
    `/finance/subscriptions/${subscriptionId}`,
    data
  );
  return response.data.data;
};

