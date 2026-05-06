import { AxiosInstance } from "axios";

export interface PaymentMethod {
  id: string;
  xenditPaymentMethodId: string;
  type: string;
  status: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodsResponse {
  success: boolean;
  message: string;
  data: {
    paymentMethods: PaymentMethod[];
  };
}

export const fetchPaymentMethods = async (
  api: AxiosInstance
): Promise<PaymentMethod[]> => {
  const response = await api.get<PaymentMethodsResponse>(
    "/finance/payment_methods"
  );
  return response.data.data.paymentMethods;
};


