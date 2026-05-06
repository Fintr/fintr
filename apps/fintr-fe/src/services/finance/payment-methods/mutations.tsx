import { AxiosInstance } from "axios";
import { PaymentMethod } from "./queries";

export interface InitializeLinkingRequest {
  type: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeLinkingResponse {
  success: boolean;
  message: string;
  data: {
    actionUrl: string;
    linkedAccountId: string;
    customerId: string;
  };
}

export interface CreatePaymentMethodRequest {
  type: string;
  linkedAccountId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentMethodResponse {
  success: boolean;
  message: string;
  data: PaymentMethod;
}

export const initializeAccountLinking = async (
  api: AxiosInstance,
  data: InitializeLinkingRequest
): Promise<InitializeLinkingResponse["data"]> => {
  const response = await api.post<InitializeLinkingResponse>(
    "/finance/payment_methods/initialize_linking",
    data
  );
  return response.data.data;
};

export const createPaymentMethod = async (
  api: AxiosInstance,
  data: CreatePaymentMethodRequest
): Promise<PaymentMethod> => {
  const response = await api.post<CreatePaymentMethodResponse>(
    "/finance/payment_methods",
    data
  );
  return response.data.data;
};

export const deletePaymentMethod = async (
  api: AxiosInstance,
  paymentMethodId: string
): Promise<void> => {
  await api.delete(`/finance/payment_methods/${paymentMethodId}`);
};


